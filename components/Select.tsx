import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

const Select: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, options, placeholder, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const current = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={className || "w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 font-medium text-sm outline-none flex items-center justify-between transition-all"}
      >
        <span className={current ? '' : 'text-slate-500'}>{current?.label || placeholder || value}</span>
        <ChevronDown size={16} className={`text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden py-1 max-h-72 overflow-y-auto no-scrollbar">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-3 text-sm font-medium flex items-center justify-between transition-colors ${
                o.value === value ? 'text-blue-400 bg-blue-600/10' : 'text-slate-200 active:bg-slate-800'
              }`}
            >
              {o.label}
              {o.value === value && <Check size={15} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Select;
