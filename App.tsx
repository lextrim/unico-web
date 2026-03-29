import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';

import MenuScreen from './components/MenuScreen';
import MaterialScreen from './components/MaterialScreen';
import ListScreen from './components/ListScreen';
import FormScreen from './components/FormScreen';
import LoginScreen from './components/LoginScreen';
import InformesScreen from './components/InformesScreen';
import BackupScreen from './components/BackupScreen';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminFromDB, setIsAdminFromDB] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const location = useLocation();

  const isAPK = /wv|android|iphone/i.test(navigator.userAgent) && !/chrome|safari/i.test(navigator.userAgent) || /wv/i.test(navigator.userAgent);
  const isAdmin = isAPK || isAdminFromDB;

  const loadData = async () => {
    try {
      const { data: { session: cur } } = await supabase.auth.getSession();
      setSession(cur);

      if (cur || isAPK) {
        if (cur) {
          const { data: role } = await supabase.from('unico_roles').select('*').eq('email', cur.user.email);
          if (role && role.length > 0) setIsAdminFromDB(role[0].role === 'admin');
        }

        const { data: m } = await supabase.from('unico_materials').select('*');
        const { data: o } = await supabase.from('unico_orders').select('*');

        const formattedM = (m || []).map(x => ({ id: x.id, ...x.payload, category: 'MATERIALES', created_at: x.created_at }));
        const formattedO = (o || []).map(x => {
          const p = x.payload || {};
          let cat = (x.category || p.category || p.status || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return { id: x.id, ...p, category: cat, image_url: p.image_url || p.image || null, created_at: x.created_at };
        });
        setOrders([...formattedM, ...formattedO]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ⚡ RECARGA AUTOMÁTICA: Detecta cuando navegas y trae los datos frescos de Supabase
  useEffect(() => {
    loadData();
  }, [location.pathname, isAPK]);

  const handleDelete = async (id: string) => {
    if(window.confirm("¿BORRAR REGISTRO?")) {
      await supabase.from('unico_orders').delete().eq('id', id);
      await supabase.from('unico_materials').delete().eq('id', id);
      loadData();
    }
  };

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-white font-black uppercase tracking-widest">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-950">
      {!session && !isAPK ? <LoginScreen /> : (
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<MenuScreen isAdmin={isAdmin} isAPK={isAPK} />} />
          <Route path="/material" element={<MaterialScreen orders={orders} isAdmin={isAdmin} />} />
          <Route path="/list/:category" element={<ListScreen orders={orders} onDelete={handleDelete} isAdmin={isAdmin} />} />
          <Route path="/form/:category" element={isAdmin ? <FormScreen /> : <Navigate to="/menu" />} />
          <Route path="/form/:category/:id" element={isAdmin ? <FormScreen /> : <Navigate to="/menu" />} />
          <Route path="/informes" element={isAdmin ? <InformesScreen isAdmin={isAdmin} isAPK={isAPK} /> : <Navigate to="/menu" />} />
          <Route path="/backup" element={isAdmin ? <BackupScreen /> : <Navigate to="/menu" />} />
        </Routes>
      )}
    </div>
  );
};

export default App;