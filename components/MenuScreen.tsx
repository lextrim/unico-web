import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Hammer, CheckCircle, Truck, AlertTriangle, FileText, ShieldCheck, Activity, LogOut } from 'lucide-react';
import { supabase } from '../supabase';

const MenuScreen: React.FC<{ isAdmin: boolean, isViewer: boolean, isAPK: boolean }> = ({ isAdmin, isViewer, isAPK }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);
  const dateLabel = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
  const timeLabel = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const items = [
    { label: 'Materiales', icon: Package, path: '/material', bg: 'bg-blue-600/15', color: 'text-blue-400' },
    { label: 'Armándose', icon: Hammer, path: '/list/ARMANDOSE', bg: 'bg-orange-600/15', color: 'text-orange-400' },
    { label: 'Terminada', icon: CheckCircle, path: '/list/TERMINADA', bg: 'bg-emerald-600/15', color: 'text-emerald-400' },
    { label: 'Entregas', icon: Truck, path: '/list/PROGRAMADA', bg: 'bg-indigo-600/15', color: 'text-indigo-400' },
    { label: 'Terminaciones', icon: AlertTriangle, path: '/list/TERMINACIONES', bg: 'bg-red-600/15', color: 'text-red-400' },
    { label: 'Informes', icon: FileText, path: '/informes', bg: 'bg-slate-600/15', color: 'text-slate-400' },
  ];

  return (
    // ⚡ SOLUCIÓN: h-[100dvh] descuenta la barra de Windows. overflow-hidden mata todos los scrolls.
    <div className="flex flex-col h-[100dvh] bg-slate-950 items-center w-full overflow-hidden normal-case">

      <div className="w-full max-w-xl flex items-center justify-between gap-3 px-6 pt-7 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-[#c80000] flex items-center justify-center text-white font-bold text-[15px] shrink-0">U</div>
          <div>
            <div className="text-white font-bold text-[15px] leading-none">ÚNICO</div>
            <div className="text-slate-500 text-[11px] mt-1 leading-none">Gestión de taller</div>
          </div>
        </div>
        <div className="text-slate-400 text-[17px] font-medium whitespace-nowrap">{dateLabel} · {timeLabel}</div>
      </div>

      {/* ⚡ flex-1 empuja el botón de cerrar sesión hacia abajo de forma natural y centra el menú */}
      <div className="w-full max-w-xl flex flex-col justify-center flex-1 px-6">

        <div className="w-full mb-5">
          <h1 className="text-[24px] font-semibold text-slate-200 leading-tight">Gestión de material</h1>
          {isViewer && <p className="text-slate-500 font-medium text-xs mt-1.5">Modo consulta</p>}
        </div>

        <div className="w-full grid grid-cols-2 gap-2.5">
          {items.map((i) => (
            <button
              key={i.label}
              onClick={() => navigate(i.path)}
              className="bg-slate-900 border border-slate-800 rounded-[18px] p-4 flex flex-col gap-3 items-start active:scale-95 transition-all text-left"
            >
              <div className={`w-10 h-10 rounded-xl ${i.bg} flex items-center justify-center`}>
                <i.icon size={20} className={i.color} />
              </div>
              <span className="text-slate-200 font-medium text-sm">{i.label}</span>
            </button>
          ))}
        </div>

        {isAdmin && (
          <div className="w-full flex gap-2.5 mt-2.5">
            <button
              onClick={() => navigate('/backup')}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <ShieldCheck size={17} className="text-blue-400" />
              <span className="text-slate-300 font-medium text-[12.5px]">Seguridad</span>
            </button>
            <button
              onClick={() => navigate('/activity')}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Activity size={17} className="text-violet-400" />
              <span className="text-slate-300 font-medium text-[12.5px]">Actividad</span>
            </button>
          </div>
        )}

      </div>

      {/* ⚡ El botón de salir se queda siempre visible abajo sin empujar la pantalla */}
      <div className="w-full max-w-xl px-6 shrink-0">
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full py-4 flex items-center justify-center gap-2 text-slate-500 font-medium text-sm border-t border-slate-900 active:opacity-60 transition-all"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
      </div>
    </div>
  );
};

export default MenuScreen;
