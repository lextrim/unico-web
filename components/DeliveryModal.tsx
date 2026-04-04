import React, { useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';

const DeliveryModal: React.FC<{
  onConfirm: (datetime: string | null) => void;
  onCancel: () => void;
  loading?: boolean;
}> = ({ onConfirm, onCancel, loading = false }) => {
  const [value, setValue] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-indigo-600 p-3 rounded-2xl">
            <Clock size={28} className="text-white" />
          </div>
          <h3 className="text-white text-xl font-black text-center uppercase tracking-widest">Fecha de Entrega</h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest text-center">
            Opcional — déjalo vacío si no hay fecha fijada
          </p>
        </div>
        <input
          type="datetime-local"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold text-sm outline-none focus:border-indigo-500 transition-all"
        />
        <div className="space-y-3">
          <button
            onClick={() => onConfirm(value || null)}
            disabled={loading}
            className="w-full bg-indigo-600 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all text-white flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            {value ? 'Confirmar Fecha' : 'Sin Fecha — Continuar'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full bg-slate-800 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all text-slate-400"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryModal;
