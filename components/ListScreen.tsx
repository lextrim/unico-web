import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, MapPin, Search, X, Image as ImageIcon, Edit3, FileText, Clock, CalendarClock } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const colors: Record<string, string> = {
  'ARMANDOSE': 'bg-orange-600',
  'TERMINADA': 'bg-emerald-600',
  'PROGRAMADA': 'bg-indigo-600',
  'TERMINACIONES': 'bg-red-600'
};

// ✅ Solo MATERIALES muestra badges CA/PT/TR
const CATEGORIES_WITH_BADGES = ['MATERIALES'];

const getBadgeClass = (isActive: boolean) =>
  `w-10 h-6 flex items-center justify-center text-[9px] font-black tracking-tighter rounded-md border transition-all shrink-0 ${
    isActive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-white bg-slate-800/50 border-slate-700"
  } uppercase`;

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
    // En ENTREGAS: ordenar por proximidad de entrega, sin fecha al final
    if (isEntregas) {
      return [...filtered].sort((a, b) => {
        if (!a.deliveryDatetime && !b.deliveryDatetime) return 0;
        if (!a.deliveryDatetime) return 1;
        if (!b.deliveryDatetime) return -1;
        return new Date(a.deliveryDatetime).getTime() - new Date(b.deliveryDatetime).getTime();
      });
    }
    return filtered;
  }, [data, search, isEntregas]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden relative">

      {/* Imagen fullscreen */}
      {fullscreenImg && (
        <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center p-6">
          <button
            onClick={() => setFullscreenImg(null)}
            className="absolute top-6 right-6 z-[120] p-3 bg-white/10 rounded-full text-white backdrop-blur-md border border-white/20 active:scale-90 transition-all"
          >
            <X size={28} />
          </button>
          <div className="w-full h-full flex items-center justify-center max-w-7xl mx-auto">
            <TransformWrapper initialScale={1} minScale={1} maxScale={5} centerOnInit={true}>
              <TransformComponent wrapperStyle={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={fullscreenImg} className="max-w-full max-h-screen object-contain rounded-xl shadow-2xl" />
              </TransformComponent>
            </TransformWrapper>
          </div>
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
          {isAdmin && (
            <button onClick={() => nav(`/form/${category}`)} className="bg-white/20 p-2 rounded-full active:scale-90 transition-transform">
              <Plus size={24} />
            </button>
          )}
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
          {filteredData.map(o => {
            const delivery = o.deliveryDatetime ? formatDelivery(o.deliveryDatetime) : null;
            const style = o.deliveryDatetime ? getDeliveryStyle(o.deliveryDatetime) : null;

            return (
              <div
                key={o.id}
                className={`bg-slate-900 border rounded-2xl shadow-sm overflow-hidden ${
                  isEntregas && style ? `border-l-4 ${style.dot.replace('bg-', 'border-l-')} border-slate-800` : 'border-slate-800'
                }`}
              >
                {/* ✅ Banner de fecha/hora destacado en tarjetas de ENTREGAS */}
                {isEntregas && delivery && style && (
                  <div className={`flex items-center gap-2 px-4 py-2 border-b border-slate-800/50 ${style.bg}`}>
                    <CalendarClock size={13} className={style.text} />
                    <span className={`text-[11px] font-black uppercase tracking-wider ${style.text}`}>
                      {delivery.label}
                    </span>
                    {delivery.sub && (
                      <span className={`text-[10px] font-bold ${style.text} opacity-70`}>{delivery.sub}</span>
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
                    <h3 className="text-sm font-black text-white uppercase truncate">{o.client}</h3>

                    {o.ubicado && (
                      <p className="text-[10px] text-slate-500 uppercase mt-1 truncate">
                        <MapPin size={10} className="inline mr-1" />{o.ubicado}
                      </p>
                    )}

                    {/* Badges CA/PT/TR — solo en MATERIALES */}
                    {showBadges && (
                      <div className="flex gap-1.5 mt-2">
                        <span className={getBadgeClass(o.cascos)}>CA</span>
                        <span className={getBadgeClass(o.puertas)}>PT</span>
                        <span className={getBadgeClass(o.tiradores)}>TR</span>
                      </div>
                    )}

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
                        onClick={() => { if (window.confirm("¿BORRAR?")) onDelete(o.id); }}
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