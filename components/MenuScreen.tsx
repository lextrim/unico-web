import { useNavigate } from 'react-router-dom';
import { Package, Hammer, CheckCircle, Truck, AlertTriangle, FileText, ShieldCheck, LogOut } from 'lucide-react';
import { supabase } from '../supabase';

const MenuScreen: React.FC<{ isAdmin: boolean, isViewer: boolean, isAPK: boolean }> = ({ isAdmin, isViewer, isAPK }) => {
  const navigate = useNavigate();

  const items = [
    { label: 'Materiales', icon: Package, path: '/material', color: 'bg-blue-600' },
    { label: 'Armándose', icon: Hammer, path: '/list/ARMANDOSE', color: 'bg-orange-600' },
    { label: 'Terminada', icon: CheckCircle, path: '/list/TERMINADA', color: 'bg-emerald-600' },
    { label: 'Entregas', icon: Truck, path: '/list/PROGRAMADA', color: 'bg-indigo-600' },
    { label: 'Terminaciones', icon: AlertTriangle, path: '/list/TERMINACIONES', color: 'bg-red-600' },
    { label: 'Informes', icon: FileText, path: '/informes', color: 'bg-slate-600' },
  ];

  return (
    // ⚡ SOLUCIÓN: h-[100dvh] descuenta la barra de Windows. overflow-hidden mata todos los scrolls.
    <div className="flex flex-col h-[100dvh] bg-slate-950 px-4 py-6 items-center w-full overflow-hidden">

      {/* ⚡ flex-1 empuja el botón de cerrar sesión hacia abajo de forma natural y centra el menú */}
      <div className="w-full max-w-xl flex flex-col items-center justify-center flex-1 space-y-8">

        <div className="w-full text-center px-2">
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none break-words">GESTION DE MATERIAL</h1>
          {isViewer && <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] mt-3">Modo Consulta</p>}
        </div>

        <div className="w-full grid grid-cols-2 gap-3">
          {items.map((i) => (
            <button
              key={i.label}
              onClick={() => navigate(i.path)}
              className={`${i.color} p-5 sm:py-8 rounded-3xl flex flex-col items-center justify-center gap-3 shadow-xl active:scale-95 transition-all`}
            >
              <i.icon size={32} className="text-white" />
              <span className="text-white font-black uppercase text-[10px] tracking-widest">{i.label}</span>
            </button>
          ))}
        </div>

        {isAdmin && (
          <div className="w-full">
            <button
              onClick={() => navigate('/backup')}
              className="w-full bg-slate-900 p-5 rounded-3xl flex flex-row items-center justify-center gap-3 shadow-xl active:scale-95 border border-slate-800"
            >
              <div className="text-blue-500"><ShieldCheck size={24} /></div>
              <span className="text-white font-black uppercase text-xs tracking-widest leading-none">Seguridad</span>
            </button>
          </div>
        )}

      </div>

      {/* ⚡ El botón de salir se queda siempre visible abajo sin empujar la pantalla */}
      <div className="w-full max-w-xl mt-4 pb-2">
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full py-4 flex items-center justify-center gap-2 text-slate-600 font-black uppercase text-[10px] tracking-widest border border-slate-900 rounded-2xl active:scale-90 transition-all"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
      </div>
    </div>
  );
};

export default MenuScreen;