import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase, logActivity } from './supabase';
import { Session } from '@supabase/supabase-js';
import { Bell, X, WifiOff } from 'lucide-react';
import { getIsAPK } from './utils/platform';
import { getAutoMoveTimestamp, isFeriaDataMissing } from './utils/workingDays';
import { fetchAllRows } from './utils/fetchAll';
import { archiveAndDelete } from './utils/archive';

import MenuScreen from './components/MenuScreen';
import MaterialScreen from './components/MaterialScreen';
import ListScreen from './components/ListScreen';
import FormScreen from './components/FormScreen';
import LoginScreen from './components/LoginScreen';
import InformesScreen from './components/InformesScreen';
import BackupScreen from './components/BackupScreen';
import ActivityScreen from './components/ActivityScreen';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'viewer' | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveryAlerts, setDeliveryAlerts] = useState<Array<{ id: string; client: string; message: string }>>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [feriaMissingYear, setFeriaMissingYear] = useState<number | null>(null);
  const location = useLocation();

  const isAPK = getIsAPK();
  const isAdmin = userRole === 'admin';
  const isViewer = userRole === 'viewer';
  const loadInFlight = useRef(false);
  const reloadPending = useRef(false);
  const activeEmail = useRef<string | null>(null);

  const loadData = async () => {
    // Si ya hay una carga en curso, no se descarta esta petición: se marca
    // pendiente y se repite en cuanto termine la actual (si no, una recarga
    // que coincide con otra en vuelo se perdía sin más, y la pantalla se
    // quedaba con datos viejos hasta la siguiente navegación).
    if (loadInFlight.current) { reloadPending.current = true; return; }
    loadInFlight.current = true;
    try {
      const { data: { session: cur } } = await supabase.auth.getSession();

      if (cur) {
        // Rechazar usuarios anónimos (sin email) o sin rol asignado
        if (!cur.user.email) {
          await supabase.auth.signOut();
          setSession(null);
          setUserRole(null);
          return;
        }

        // Solo consulta roles en la primera carga (no cambian durante la sesión)
        if (!userRole) {
          const { data: role, error: roleError } = await supabase.from('unico_roles').select('*').eq('email', cur.user.email);
          if (roleError) {
            // Fallo de red/consulta: no es lo mismo que "no tiene rol". No cerrar sesión, reintentar en la siguiente carga.
            console.error('No se pudo comprobar el rol:', roleError.message);
            return;
          }
          if (!role || role.length === 0) {
            await supabase.auth.signOut();
            setSession(null);
            setUserRole(null);
            return;
          }
          setUserRole(role[0].role as 'admin' | 'viewer');
        }

        activeEmail.current = cur.user.email ?? null;
        setSession(cur);

        // El paso a ARMANDOSE siempre lo decide el admin a mano (pantalla Material).
        // La fecha de entrega solo dispara avisos (banner + notificacion nativa/web,
        // ver los efectos de abajo que usan getAutoMoveTimestamp) -- nunca mueve nada sola.
        const [materials, ordersData] = await Promise.all([
          fetchAllRows('unico_materials'),
          fetchAllRows('unico_orders'),
        ]);

        const formattedM = materials.map((x: any) => ({ id: x.id, ...x.payload, category: 'MATERIALES', created_at: x.created_at }));
        const formattedO = ordersData.map((x: any) => {
          const p = x.payload || {};
          let cat = (x.category || p.category || p.status || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return { id: x.id, ...p, category: cat, image_url: p.image_url || p.image || null, created_at: x.created_at };
        });
        setOrders([...formattedM, ...formattedO]);
      } else {
        setSession(null);
        setUserRole(null);
      }
    } catch (e) { console.error(e); }
    finally {
      setLoading(false);
      loadInFlight.current = false;
      if (reloadPending.current) {
        reloadPending.current = false;
        loadData();
      }
    }
  };

  // Detecta cambios de conectividad para avisar al usuario cuando está offline
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Avisa al admin si falta el Lunes de Feria del año actual o del siguiente en FERIA_MONDAY
  useEffect(() => {
    const y = new Date().getFullYear();
    if (isFeriaDataMissing(y)) setFeriaMissingYear(y);
    else if (isFeriaDataMissing(y + 1)) setFeriaMissingYear(y + 1);
  }, []);

  // Carga inicial y detecta cambios de sesión (login/logout)
  useEffect(() => {
    loadData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email) {
        // Solo loguear si es un login fresco (no una sesión restaurada por recarga)
        const key = `logged_${session.access_token.slice(-10)}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          logActivity(session.user.email, 'login');
        }
      } else if (event === 'SIGNED_OUT' && activeEmail.current) {
        logActivity(activeEmail.current, 'logout');
        activeEmail.current = null;
        sessionStorage.clear();
      }
      loadData();
    });
    return () => subscription.unsubscribe();
  }, []);

  // Recarga datos frescos al navegar entre pantallas
  useEffect(() => {
    if (!loading) loadData();
  }, [location.pathname]);

  // Realtime: si otro dispositivo/pestaña crea, edita o borra un material o
  // pedido, recarga los datos aquí sin esperar a que el usuario navegue.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('unico_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unico_materials' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unico_orders' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  // Alarmas nativas Android (funcionan con app cerrada y pantalla bloqueada)
  useEffect(() => {
    if (!isAPK || !session) return;
    const bridge = (window as any).AndroidBridge;
    if (!bridge?.scheduleNotification) return;

    const now = Date.now();
    orders
      .filter(o => o.category === 'PROGRAMADA' && o.deliveryDatetime)
      .forEach(order => {
        const t = new Date(order.deliveryDatetime).getTime();
        const hora = new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const client = (order.client || 'CLIENTE').toUpperCase();

        // Alarma en el momento exacto de la entrega
        if (t > now) {
          bridge.scheduleNotification(
            `${order.id}_due`,
            `HORA DE ENTREGA: ${client}`,
            `Entrega programada para las ${hora}`,
            String(t)
          );
        }
        // Alarma 30 minutos antes
        const thirtyBefore = t - 30 * 60 * 1000;
        if (thirtyBefore > now) {
          bridge.scheduleNotification(
            `${order.id}_30min`,
            `ENTREGA EN 30 MIN: ${client}`,
            `Entrega a las ${hora}`,
            String(thirtyBefore)
          );
        }
      });

    // Alarma para materiales que pasan a ARMANDOSE (7:00h del día de auto-movimiento)
    orders
      .filter(o => o.category === 'MATERIALES' && o.deliveryDatetime)
      .forEach(order => {
        const t = getAutoMoveTimestamp(order.deliveryDatetime);
        if (t > now) {
          const client = (order.client || 'CLIENTE').toUpperCase();
          bridge.scheduleNotification(
            `${order.id}_armandose`,
            `PASA A ARMÁNDOSE: ${client}`,
            `Tiene 4 días laborables para entrega. El pedido entra en armado hoy.`,
            String(t)
          );
        }
      });
  }, [orders, session, isAPK]);

  // Notificaciones en navegador web (banner in-app + Web Notifications)
  useEffect(() => {
    if (!orders.length || !session) return;

    const NOTIFIED_KEY = 'unico_delivery_notified';

    const getNotified = (): Set<string> => {
      try { return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]')); }
      catch { return new Set(); }
    };

    const saveNotified = (s: Set<string>) => {
      try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(s).slice(-300))); }
      catch {}
    };

    const checkDeliveries = () => {
      const now = Date.now();
      const notified = getNotified();

      // ✅ Limpia IDs de órdenes eliminadas o que ya no están activas
      const activeKeys = new Set([
        ...orders
          .filter(o => o.category === 'PROGRAMADA' && o.deliveryDatetime)
          .flatMap(o => [`${o.id}_due`, `${o.id}_30min`]),
        ...orders
          .filter(o => o.category === 'MATERIALES' && o.deliveryDatetime)
          .map(o => `${o.id}_armandose`),
      ]);
      const pruned = new Set([...notified].filter(k => activeKeys.has(k)));
      if (pruned.size !== notified.size) saveNotified(pruned);
      const notifiedClean = pruned;

      const newAlerts: Array<{ id: string; client: string; message: string }> = [];
      let changed = false;

      orders
        .filter(o => o.category === 'PROGRAMADA' && o.deliveryDatetime)
        .forEach(order => {
          const t = new Date(order.deliveryDatetime).getTime();
          const diff = t - now;
          const hora = new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const client = (order.client || 'Cliente').toUpperCase();

          if (diff <= 0 && diff > -5 * 60 * 1000) {
            const key = `${order.id}_due`;
            if (!notifiedClean.has(key)) {
              notifiedClean.add(key); changed = true;
              newAlerts.push({ id: key, client, message: `HORA DE ENTREGA · ${hora}` });
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
                new Notification(`⏰ ${client}`, { body: `Ha llegado la hora de entrega (${hora})`, tag: key });
            }
          } else if (diff > 0 && diff <= 30 * 60 * 1000) {
            const key = `${order.id}_30min`;
            if (!notifiedClean.has(key)) {
              notifiedClean.add(key); changed = true;
              newAlerts.push({ id: key, client, message: `ENTREGA EN 30 MIN · ${hora}` });
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
                new Notification(`🔔 ${client}`, { body: `Entrega en 30 minutos (${hora})`, tag: key });
            }
          }
        });

      // Notificación web para materiales que pasan a ARMANDOSE hoy
      orders
        .filter(o => o.category === 'MATERIALES' && o.deliveryDatetime)
        .forEach(order => {
          const triggerTime = getAutoMoveTimestamp(order.deliveryDatetime);
          const triggerDate = new Date(triggerTime);
          const today = new Date();
          const isTodayAutoMoveDay =
            triggerDate.getFullYear() === today.getFullYear() &&
            triggerDate.getMonth() === today.getMonth() &&
            triggerDate.getDate() === today.getDate();
          if (isTodayAutoMoveDay && triggerTime <= now) {
            const key = `${order.id}_armandose`;
            if (!notifiedClean.has(key)) {
              notifiedClean.add(key); changed = true;
              const client = (order.client || 'CLIENTE').toUpperCase();
              newAlerts.push({ id: key, client, message: 'PASA A ARMÁNDOSE HOY · 4 DÍAS PARA ENTREGA' });
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
                new Notification(`🔧 ${client}`, { body: 'Este pedido entra en armado hoy (4 días laborables para entrega)', tag: key });
            }
          }
        });

      if (changed) saveNotified(notifiedClean);
      if (newAlerts.length > 0) setDeliveryAlerts(prev => [...prev, ...newAlerts]);
    };

    if (typeof Notification !== 'undefined' && Notification.permission === 'default')
      Notification.requestPermission();

    checkDeliveries();
    const interval = setInterval(checkDeliveries, 60 * 1000);
    return () => clearInterval(interval);
  }, [orders, session]);

  const handleRecordSaved = (savedId: string, updated: any) => {
    setOrders(prev => prev.map(o => o.id === savedId ? { ...o, ...updated } : o));
  };

  const handleDelete = async (order: any, completada: boolean, motivo: string | null) => {
    const table = order.category === 'MATERIALES' ? 'unico_materials' : 'unico_orders';
    await archiveAndDelete(table, { id: order.id, payload: order, category: order.category, created_at: order.created_at }, completada, motivo);
    if (isAPK) {
      const bridge = (window as any).AndroidBridge;
      bridge?.cancelNotification?.(`${order.id}_due`);
      bridge?.cancelNotification?.(`${order.id}_30min`);
      bridge?.cancelNotification?.(`${order.id}_armandose`);
    }
    loadData();
  };

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black uppercase tracking-widest">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Banner de estado offline */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[210] bg-amber-600 shadow-2xl">
          <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
            <WifiOff size={14} className="text-white shrink-0" />
            <p className="text-[11px] font-black uppercase text-white tracking-wide leading-none">Sin conexión · Modo offline</p>
          </div>
        </div>
      )}
      {/* Banner de notificación de entrega */}
      {deliveryAlerts.length > 0 && session && (
        <div className="fixed left-0 right-0 z-[200] bg-red-600 shadow-2xl" style={{ top: isOnline ? 0 : 36 }}>
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
            <Bell size={18} className="text-white shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-black uppercase text-white text-sm leading-none truncate">{deliveryAlerts[0].client}</p>
              <p className="text-[10px] font-bold text-white/90 uppercase mt-0.5">{deliveryAlerts[0].message}</p>
            </div>
            <button
              onClick={() => setDeliveryAlerts(prev => prev.slice(1))}
              className="p-1.5 bg-white/20 rounded-lg active:scale-90 transition-all shrink-0"
            >
              <X size={15} className="text-white" />
            </button>
          </div>
        </div>
      )}
      {/* Banner de aviso: falta la fecha de Feria del año actual/siguiente en workingDays.ts */}
      {feriaMissingYear !== null && isAdmin && session && (
        <div
          className="fixed left-0 right-0 z-[190] bg-orange-600 shadow-2xl"
          style={{ top: (isOnline ? 0 : 36) + (deliveryAlerts.length > 0 ? 56 : 0) }}
        >
          <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
            <Bell size={14} className="text-white shrink-0" />
            <p className="text-[11px] font-black uppercase text-white tracking-wide leading-none">
              Falta la fecha de la Feria de {feriaMissingYear}. Avisar a Valen.
            </p>
          </div>
        </div>
      )}
      {!session ? <LoginScreen /> : (
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<MenuScreen isAdmin={isAdmin} isViewer={isViewer} isAPK={isAPK} />} />
          <Route path="/material" element={<MaterialScreen orders={orders} isAdmin={isAdmin} onRefresh={loadData} />} />
          <Route path="/list/:category" element={<ListScreen orders={orders} onDelete={handleDelete} isAdmin={isAdmin} />} />
          <Route path="/form/:category" element={isAdmin ? <FormScreen onSave={handleRecordSaved} /> : <Navigate to="/menu" />} />
          <Route path="/form/:category/:id" element={isAdmin ? <FormScreen onSave={handleRecordSaved} /> : <Navigate to="/menu" />} />
          <Route path="/informes" element={(isAdmin || isViewer) ? <InformesScreen isAdmin={isAdmin || isViewer} isAPK={isAPK} /> : <Navigate to="/menu" />} />
          <Route path="/backup" element={isAdmin ? <BackupScreen /> : <Navigate to="/menu" />} />
          <Route path="/activity" element={isAdmin ? <ActivityScreen /> : <Navigate to="/menu" />} />
        </Routes>
      )}
    </div>
  );
};

export default App;