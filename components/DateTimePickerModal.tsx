import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface Props {
  initialDate?: string; // YYYY-MM-DD
  initialTime?: string; // HH:MM
  onConfirm: (date: string, time: string) => void;
  onCancel: () => void;
}

const DateTimePickerModal: React.FC<Props> = ({ initialDate, initialTime, onConfirm, onCancel }) => {
  const today = new Date();

  const parseDate = (d?: string) => {
    if (!d) return null;
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
  };

  const [selected, setSelected] = useState<Date | null>(parseDate(initialDate));
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [hours, setHours] = useState(initialTime ? parseInt(initialTime.split(':')[0]) : 8);
  const [minutes, setMinutes] = useState(initialTime ? Math.round(parseInt(initialTime.split(':')[1]) / 5) * 5 % 60 : 0);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isSelected = (d: number) =>
    selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  const isToday = (d: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

  const handleConfirm = () => {
    if (!selected) return;
    const dateStr = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    onConfirm(dateStr, timeStr);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-[#161b27] border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Navegación mes */}
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <button onClick={prevMonth} className="p-2.5 rounded-xl bg-slate-800 active:scale-90 transition-all">
            <ChevronLeft size={18} className="text-white" />
          </button>
          <span className="text-white font-black uppercase tracking-widest text-sm">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="p-2.5 rounded-xl bg-slate-800 active:scale-90 transition-all">
            <ChevronRight size={18} className="text-white" />
          </button>
        </div>

        {/* Cabecera días */}
        <div className="grid grid-cols-7 px-4 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-black text-slate-500 uppercase py-1">{d}</div>
          ))}
        </div>

        {/* Grid calendario */}
        <div className="grid grid-cols-7 px-4 gap-y-1 pb-4">
          {cells.map((d, i) => (
            <div key={i} className="flex items-center justify-center">
              {d ? (
                <button
                  onClick={() => setSelected(new Date(viewYear, viewMonth, d))}
                  className={`w-9 h-9 rounded-full text-sm font-black transition-all active:scale-90 ${
                    isSelected(d)
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : isToday(d)
                      ? 'border-2 border-blue-500 text-blue-400'
                      : 'text-slate-300 active:bg-slate-800'
                  }`}
                >
                  {d}
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {/* Selector hora */}
        <div className="border-t border-slate-800 mx-4 pt-4 pb-4">
          <p className="text-[10px] font-black uppercase text-slate-500 text-center mb-3 tracking-widest">Hora de entrega</p>
          <div className="flex items-center justify-center gap-6">
            {/* Horas */}
            <div className="flex flex-col items-center gap-1">
              <button onClick={() => setHours(h => (h + 1) % 24)} className="p-2 bg-slate-800 rounded-xl active:scale-90 transition-all">
                <ChevronUp size={16} className="text-white" />
              </button>
              <span className="text-3xl font-black text-white w-14 text-center tabular-nums">
                {String(hours).padStart(2, '0')}
              </span>
              <button onClick={() => setHours(h => (h + 23) % 24)} className="p-2 bg-slate-800 rounded-xl active:scale-90 transition-all">
                <ChevronDown size={16} className="text-white" />
              </button>
            </div>
            <span className="text-3xl font-black text-slate-500 mb-1">:</span>
            {/* Minutos (paso de 5) */}
            <div className="flex flex-col items-center gap-1">
              <button onClick={() => setMinutes(m => (m + 5) % 60)} className="p-2 bg-slate-800 rounded-xl active:scale-90 transition-all">
                <ChevronUp size={16} className="text-white" />
              </button>
              <span className="text-3xl font-black text-white w-14 text-center tabular-nums">
                {String(minutes).padStart(2, '0')}
              </span>
              <button onClick={() => setMinutes(m => (m + 55) % 60)} className="p-2 bg-slate-800 rounded-xl active:scale-90 transition-all">
                <ChevronDown size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="px-5 pb-6 space-y-2">
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="w-full bg-blue-600 py-4 rounded-2xl text-sm font-black uppercase text-white active:scale-95 transition-all disabled:opacity-30"
          >
            CONFIRMAR
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-slate-800 py-3.5 rounded-2xl text-sm font-black uppercase text-slate-400 active:scale-95 transition-all"
          >
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateTimePickerModal;
