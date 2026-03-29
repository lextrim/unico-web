import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Order } from '../types';
import { ChevronLeft, Calendar } from 'lucide-react';

const HistoryProgramadasScreen: React.FC<{ orders: Order[] }> = ({ orders }) => {
  const nav = useNavigate();
  const data = orders.filter(o => o.status === 'ENTREGADA');

  return (
    <div className="flex flex-col h-screen bg-slate-950 no-scrollbar text-sm">
      <div className="bg-slate-600 shadow-lg z-30"><div className="max-w-xl mx-auto px-5 py-3 flex items-center gap-2">
        <button onClick={() => nav('/menu')}><ChevronLeft size={28} /></button><h1 className="text-lg font-black uppercase tracking-wider">Historial</h1>
      </div></div>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto p-5 space-y-4">
          {data.length === 0 ? <div className="text-center pt-10 text-slate-700 font-black uppercase tracking-widest">Vacío</div> : data.map(o => (
            <div key={o.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <h3 className="text-base font-black text-white uppercase leading-tight tracking-tight">{o.client}</h3>
                <div className="flex items-center gap-1 text-slate-500 mt-1"><Calendar size={12}/><span className="text-[10px] font-bold">{new Date(o.createdAt).toLocaleDateString()}</span></div>
              </div>
              <div className="text-[9px] font-black bg-emerald-900/30 text-emerald-500 px-2 py-1 rounded border border-emerald-800/50 uppercase tracking-widest">Entregado</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HistoryProgramadasScreen;