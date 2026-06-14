import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, MapPin, Search, X, Image as ImageIcon, Edit3, FileText, Clock, CalendarClock, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import AppModal from './AppModal';
import DeliveryModal from './DeliveryModal';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { getBadgeClass } from '../utils/badges';
import { countWorkingDaysUntil } from '../utils/workingDays';

// Urgencia por días laborables (para categorías no-PROGRAMADA)
const getWorkingDayUrgency = (dt: string | null | undefined) => {
  if (!dt) return null;
  const wd = countWorkingDaysUntil(dt);
  if (wd < 0) return 'overdue';
  if (wd <= 2) return 'critical';
  if (wd <= 4) return 'warning';
  return 'ok';
};

const URGENCY_CARD: Record<string, string> = {
  overdue:  'border-l-4 border-l-red-600 bg-red-950/30',
  critical: 'border-l-4 border-l-red-500 bg-red-950/20',
  warning:  'border-l-4 border-l-amber-500 bg-amber-950/20',
  ok:       'border-l-4 border-l-emerald-500 bg-emerald-950/20',
};

const URGENCY_BADGE: Record<string, string> = {
  overdue:  'text-red-400 bg-red-500/15 border border-red-500/30',
  critical: 'text-red-400 bg-red-500/10 border border-red-500/20',
  warning:  'text-amber-400 bg-amber-500/10 border border-amber-500/20',
  ok:       'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
};

const formatDeliveryShort = (dt: string) => {
  const d = new Date(dt);
  const diffMs = d.getTime() - Date.now();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (diffMs < 0) return `VENCIDA · ${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`;
  if (diffDays < 1) return `HOY · ${time}`;
  if (diffDays < 2) return `MAÑANA · ${time}`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ` · ${time}`;
};

const colors: Record<string, string> = {
  'ARMANDOSE': 'bg-orange-600',
  'TERMINADA': 'bg-emerald-600',
  'PROGRAMADA': 'bg-indigo-600',
  'TERMINACIONES': 'bg-red-600'
};

const CATEGORIES_WITH_BADGES = ['MATERIALES'];

// Etiqueta de urgencia para mostrar junto a la hora de entrega
const getUrgencyLabel = (dt: string): string | null => {
  const diff = new Date(dt).getTime() - Date.now();
  if (diff < 0) return 'VENCIDA';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `EN ${mins}MIN`;
  const hours = Math.round(diff / 3600000);
  if (hours < 4) return `EN ${hours}H`;
  return null;
};

// Formatea fecha/hora de entrega
const formatDelivery = (dt: string) => {
  try {
    const d = new Date(dt);
    const hoy = new Date();
    const esHoy = d.toDateString() === hoy.toDateString();
    const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);
    const esManana = d.toDateString() === manana.toDateString();
    const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const fecha = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    if (esHoy) return { label: `HOY · ${hora}`, sub: null };
    if (esManana) return { label: `MAÑANA · ${hora}`, sub: null };
    return { label: fecha, sub: hora };
  } catch { return { label: dt, sub: null }; }
};

// Color del indicador según urgencia
const getDeliveryStyle = (dt: string) => {
  try {
    const diff = new Date(dt).getTime() - Date.now();
    const horas = diff / 3600000;
    if (horas < 0)  return { bg: 'bg-red-900/40 border-red-500/40',   text: 'text-red-400',    dot: 'bg-red-500' };
    if (horas < 4)  return { bg: 'bg-red-900/30 border-red-500/30',   text: 'text-red-400',    dot: 'bg-red-500' };
    if (horas < 24) return { bg: 'bg-orange-900/30 border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500' };
    return           { bg: 'bg-indigo-900/30 border-indigo-500/30',   text: 'text-indigo-300', dot: 'bg-indigo-400' };
  } catch {
    return           { bg: 'bg-slate-800 border-slate-700',           text: 'text-slate-400',  dot: 'bg-slate-500' };
  }
};


const ListScreen: React.FC<{ orders: any[], onDelete: (id: string) => void, isAdmin: boolean }> = ({ orders, onDelete, isAdmin }) => {
  const { category } = useParams();
  const nav = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentCat = category?.toUpperCase() || "";
  const data = orders.filter(o => o.category?.toUpperCase() === currentCat);
  const [search, setSearch] = useState("");
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<any | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [modal, setModal] = useState<any>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void) =>
    setModal({ title, message, icon: <Trash2 size={28} className="text-white" />, iconBg: 'bg-red-600', confirmText: 'BORRAR', confirmClass: 'bg-red-600', onConfirm: () => { setModal(null); onConfirm(); }, onCancel: () => setModal(null) });

  const handleMoveToEntregas = async (datetime: string | null) => {
    if (!moveTarget) return;
    setIsMoving(true);
    try {
      const { id, category: _cat, date: _date, status: _status, created_at, ...payloadFields } = moveTarget;
      const updatedPayload = { ...payloadFields, deliveryDatetime: datetime || '' };
      await supabase
        .from('unico_orders')
        .update({ payload: updatedPayload, category: 'PROGRAMADA' })
        .eq('id', id);
      setMoveTarget(null);
      nav('/list/PROGRAMADA');
    } catch {
      setModal({ title: 'Error', message: 'No se pudo mover a Entregas. Inténtalo de nuevo.', icon: <AlertCircle size={28} className="text-white" />, iconBg: 'bg-red-600', onConfirm: () => setModal(null) });
    } finally {
      setIsMoving(false);
    }
  };

  const showBadges = CATEGORIES_WITH_BADGES.includes(currentCat);
  const isEntregas = currentCat === 'PROGRAMADA';

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.trim() !== "" && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const filteredData = useMemo(() => {
    const q = search.toUpperCase().trim();
    const filtered = q ? data.filter(o => o.client?.toUpperCase().includes(q)) : data;

    // ENTREGAS: por fecha de entrega más próxima, sin fecha al final
    if (isEntregas) {
      return [...filtered].sort((a, b) => {
        if (!a.deliveryDatetime && !b.deliveryDatetime) return 0;
        if (!a.deliveryDatetime) return 1;
        if (!b.deliveryDatetime) return -1;
        return new Date(a.deliveryDatetime).getTime() - new Date(b.deliveryDatetime).getTime();
      });
    }

    // MATERIAL: más reciente primero
    if (currentCat === 'MATERIALES') {
      return [...filtered].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    // ARMANDOSE, TERMINADA, TERMINACIONES: con fecha primero (ascendente), luego por antigüedad
    const withDate = filtered.filter(o => o.deliveryDatetime).sort((a, b) =>
      new Date(a.deliveryDatetime).getTime() - new Date(b.deliveryDatetime).getTime()
    );
    const withoutDate = filtered.filter(o => !o.deliveryDatetime).sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return [...withDate, ...withoutDate];
  }, [data, search, isEntregas, currentCat]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden relative">

      {modal && <AppModal {...modal} />}

      {/* Modal mover a Entregas */}
      {moveTarget && (
        <DeliveryModal
          onConfirm={handleMoveToEntregas}
          onCancel={() => setMoveTarget(null)}
          loading={isMoving}
        />
      )}

      {/* Imagen fullscreen */}
      {fullscreenImg && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-sm flex items-center justify-center">
          <button
            onClick={() => setFullscreenImg(null)}
            className="absolute top-5 right-5 z-[120] p-2.5 bg-white/10 rounded-full text-white border border-white/15 active:scale-90 transition-all"
          >
            <X size={22} />
          </button>
          <TransformWrapper initialScale={1} minScale={0.3} maxScale={8} centerOnInit={true}>
            <TransformComponent
              wrapperStyle={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
              contentStyle={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <img
                src={fullscreenImg}
                style={{ width: "100vw", height: "100vh", objectFit: "contain" }}
              />
            </TransformComponent>
          </TransformWrapper>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/25 text-[9px] font-black uppercase tracking-widest pointer-events-none">
            Pellizca para zoom
          </span>
        </div>
      )}

      {/* Header */}
      <div className={`${colors[currentCat] || 'bg-slate-800'} shadow-lg sticky top-0 z-30`}>
        <div className="max-w-xl mx-auto px-5 py-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <button onClick={() => nav('/menu')} className="active:scale-90 transition-transform"><ChevronLeft size={28} /></button>
            <h1 className="text-lg font-black uppercase text-white leading-none">
              {currentCat === 'PROGRAMADA' ? 'ENTREGAS' : currentCat}
            </h1>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-slate-950/95 backdrop-blur-md p-3 border-b border-slate-900 sticky top-[52px] z-20">
        <div className="max-w-xl mx-auto px-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 p-3 pl-10 rounded-xl text-white font-black uppercase text-xs outline-none focus:border-blue-500 transition-all"
              placeholder="BUSCAR CLIENTE..."
            />
          </div>
          <button
            onClick={() => setSearch("")}
            className="bg-red-900/20 px-4 rounded-xl text-red-500 font-black text-[10px] uppercase active:scale-90 transition-all"
          >
            LIMPIAR
          </button>
        </div>
      </div>

      {/* Lista */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto px-5 py-5 space-y-4 pb-32">
          {filteredData.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-600 font-black uppercase text-xs tracking-widest">
                {search ? 'Sin resultados' : 'Sin registros'}
              </p>
            </div>
          )}
          {filteredData.map(o => {
            const delivery = o.deliveryDatetime ? formatDelivery(o.deliveryDatetime) : null;
            const style = o.deliveryDatetime ? getDeliveryStyle(o.deliveryDatetime) : null;
            const workingUrgency = !isEntregas ? getWorkingDayUrgency(o.deliveryDatetime) : null;

            return (
              <div
                key={o.id}
                className={`bg-slate-900 border rounded-2xl shadow-sm overflow-hidden ${
                  isEntregas && style
                    ? `border-l-4 ${style.dot.replace('bg-', 'border-l-')} border-slate-800`
                    : workingUrgency
                    ? `border-slate-800 ${URGENCY_CARD[workingUrgency]}`
                    : 'border-slate-800'
                }`}
              >
                {/* ✅ Banner de fecha/hora destacado en tarjetas de ENTREGAS */}
                {isEntregas && delivery && style && (
                  <div className={`flex items-center gap-2 px-4 py-2 border-b border-slate-800/50 ${style.bg}`}>
                    <CalendarClock size={13} className={`${style.text} shrink-0`} />
                    <span className={`text-[11px] font-black uppercase tracking-wider ${style.text} flex-1`}>
                      {delivery.label}
                      {delivery.sub && <span className={`ml-1.5 text-[10px] font-bold opacity-70`}>{delivery.sub}</span>}
                    </span>
                    {o.deliveryDatetime && getUrgencyLabel(o.deliveryDatetime) && (
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-current ${style.text} bg-white/10`}>
                        {getUrgencyLabel(o.deliveryDatetime)}
                      </span>
                    )}
                  </div>
                )}

                {/* ✅ Sin fecha asignada aún */}
                {isEntregas && !delivery && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800/50 bg-slate-800/30">
                    <Clock size={13} className="text-slate-600" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">Sin fecha asignada</span>
                  </div>
                )}

                <div className="p-3 flex items-start gap-4">
                  {/* Imagen */}
                  <div className="shrink-0 mt-1" onClick={() => o.image_url && setFullscreenImg(o.image_url)}>
                    {o.image_url
                      ? <img src={o.image_url} className="h-16 w-16 rounded-xl object-cover border border-slate-800 cursor-pointer active:scale-95 transition-transform" />
                      : <div className="h-16 w-16 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-800"><ImageIcon size={20} className="text-slate-600" /></div>
                    }
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-white uppercase truncate leading-tight">{o.client}</h3>

                    {o.ubicado && (
                      <p className="text-[10px] text-slate-500 uppercase mt-1 truncate">
                        <MapPin size={10} className="inline mr-1" />{o.ubicado}
                      </p>
                    )}

                    {/* Badges CA/PT/TR — solo en MATERIALES */}
                    {showBadges && (
                      <div className="flex gap-1.5 mt-2">
                        <span className={getBadgeClass(o.cascos, 'cascos')}>CA</span>
                        <span className={getBadgeClass(o.puertas, 'puertas')}>PT</span>
                        <span className={getBadgeClass(o.tiradores, 'tiradores')}>TR</span>
                      </div>
                    )}

                    {/* Fecha de entrega en categorías no-PROGRAMADA */}
                    {workingUrgency && o.deliveryDatetime && (() => {
                      const wd = countWorkingDaysUntil(o.deliveryDatetime);
                      const wdLabel = wd < 0 ? 'VENCIDA' : wd === 0 ? 'HOY' : wd === 1 ? '1 DÍA' : `${wd} DÍAS`;
                      return (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest ${URGENCY_BADGE[workingUrgency]}`}>
                            {formatDeliveryShort(o.deliveryDatetime)}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest ${URGENCY_BADGE[workingUrgency]}`}>
                            {wdLabel} <span className="font-bold normal-case tracking-normal">para entrega</span>
                          </span>
                        </div>
                      );
                    })()}

                    {/* Notas */}
                    {o.notes && (
                      <p className="text-[10px] text-slate-400 mt-2 flex items-start gap-1 leading-snug">
                        <FileText size={10} className="shrink-0 mt-[1px]" />
                        <span className="break-words">{o.notes}</span>
                      </p>
                    )}
                  </div>

                  {/* Acciones admin */}
                  {isAdmin && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => nav(`/form/${category}/${o.id}`)}
                        className="p-2 bg-blue-500/10 rounded-lg text-white border border-blue-500/20 active:scale-90 transition-all"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => showConfirm("¿Borrar registro?", `Se eliminará "${o.client}" de forma permanente.`, () => onDelete(o.id))}
                        className="p-2 bg-red-500/10 rounded-lg text-red-500 border border-red-500/20 active:scale-90 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ListScreen;