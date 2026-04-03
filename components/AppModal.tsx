import React from 'react';

interface AppModalProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

const AppModal: React.FC<AppModalProps> = ({
  title,
  message,
  icon,
  iconBg = 'bg-blue-600',
  confirmText = 'ACEPTAR',
  cancelText = 'CANCELAR',
  confirmClass = 'bg-blue-600',
  onConfirm,
  onCancel,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6">
      <div className="flex flex-col items-center gap-3">
        {icon && (
          <div className={`${iconBg} p-3 rounded-2xl`}>
            {icon}
          </div>
        )}
        <h3 className="text-white text-xl font-black text-center uppercase tracking-widest">{title}</h3>
        {message && (
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider text-center leading-relaxed">{message}</p>
        )}
      </div>
      <div className="space-y-3">
        <button
          onClick={onConfirm}
          className={`w-full ${confirmClass} py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all text-white`}
        >
          {confirmText}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full bg-slate-800 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all text-slate-400"
          >
            {cancelText}
          </button>
        )}
      </div>
    </div>
  </div>
);

export default AppModal;
