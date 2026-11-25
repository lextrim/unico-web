import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

const DeleteArchiveModal: React.FC<{
  clientName: string;
  category: string;
  onConfirm: (completada: boolean, motivo: string | null) => void;
  onCancel: () => void;
}> = ({ clientName, category, onConfirm, onCancel }) => {
  // Solo si ya pasó por Entregas tiene sentido preguntar si está terminada
  // (puede que no hiciera falta Repasos). Antes de Entregas, se está borrando
  // a mitad de proceso: se pregunta directamente el motivo.
  const reachedEntregas = category === 'PROGRAMADA' || category === 'TERMINACIONES';
  const [step, setStep] = useState<'ask' | 'motivo'>(reachedEntregas ? 'ask' : 'motivo');
  const [motivo, setMotivo] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm normal-case">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-red-600 p-3 rounded-2xl">
            <Trash2 size={28} className="text-white" />
          </div>
          <h3 className="text-white text-lg font-semibold text-center">
            {step === 'ask' ? `Borrar "${clientName}"` : reachedEntregas ? '¿Qué falló?' : `Borrar "${clientName}"`}
          </h3>
          <p className="text-slate-400 text-[13px] font-medium text-center leading-relaxed">
            {step === 'ask'
              ? '¿Está totalmente terminada? Puede que no hiciera falta repaso.'
              : reachedEntregas
                ? 'Indica el motivo para dejarlo anotado en el historial.'
                : 'Todavía no ha llegado a Entregas. Indica el motivo del borrado.'}
          </p>
        </div>

        {step === 'motivo' && (
          <textarea
            autoFocus
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)..."
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 text-sm outline-none resize-none normal-case"
          />
        )}

        <div className="space-y-3">
          {step === 'ask' ? (
            <>
              <button
                onClick={() => onConfirm(true, null)}
                className="w-full bg-emerald-600 py-4 rounded-2xl font-semibold shadow-lg active:scale-95 transition-all text-white"
              >
                Sí, está terminada
              </button>
              <button
                onClick={() => setStep('motivo')}
                className="w-full bg-red-600 py-4 rounded-2xl font-semibold shadow-lg active:scale-95 transition-all text-white"
              >
                No
              </button>
              <button
                onClick={onCancel}
                className="w-full bg-slate-800 py-3 rounded-2xl font-medium text-[12.5px] active:scale-95 transition-all text-slate-400"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onConfirm(false, motivo.trim() || null)}
                className="w-full bg-red-600 py-4 rounded-2xl font-semibold shadow-lg active:scale-95 transition-all text-white"
              >
                Borrar
              </button>
              <button
                onClick={onCancel}
                className="w-full bg-slate-800 py-3 rounded-2xl font-medium text-[12.5px] active:scale-95 transition-all text-slate-400"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeleteArchiveModal;
