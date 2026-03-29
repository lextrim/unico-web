import React, { useState } from 'react';
import { Order } from '../types';
import { X, CheckSquare, Square, Printer } from 'lucide-react';

interface PrintDialogProps {
  orders: Order[];
  onClose: () => void;
}

const formatDate = (ms: number) => (!ms || ms <= 0 || !isFinite(ms)) ? 'SIN FECHA' : new Date(ms).toLocaleDateString();
const escapeHtml = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PrintDialog: React.FC<PrintDialogProps> = ({ orders, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(orders.map((o) => o.id));

  const toggleOrder = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePrint = () => {
    const selected = orders.filter(o => selectedIds.includes(o.id));
    if (selected.length === 0) return alert('SELECCIONA AL MENOS UN PEDIDO');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const rows = selected.map((o, idx) => `
        <div style="border: 2px solid #000; padding: 15px; margin-bottom: 20px; border-radius: 10px; font-family: sans-serif;">
          <div style="float: right; font-weight: 900; font-size: 20px; border: 2px solid #000; width: 35px; height: 35px; text-align: center; line-height: 35px; border-radius: 50%;">${idx + 1}</div>
          <div style="font-size: 22px; font-weight: 900; border-bottom: 1px solid #000; margin-bottom: 10px;">${escapeHtml(o.client)}</div>
          <div style="font-size: 14px; margin-bottom: 10px;"><b>FECHA:</b> ${formatDate(o.deliveryDate)}</div>
          <div style="font-size: 14px; white-space: pre-wrap;"><b>NOTAS:</b><br/>${escapeHtml(o.notes || 'SIN NOTAS')}</div>
        </div>
      `).join('');

      printWindow.document.open();
      printWindow.document.write(`<html><body style="padding:20px;">${rows}<script>window.onload=()=>{window.print();window.close();};</script></body></html>`);
      printWindow.document.close();
    } else {
      alert("BLOQUEO DE POP-UP: Por favor, permite las ventanas emergentes.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-black uppercase tracking-tighter">Imprimir</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {orders.map((o) => {
            const checked = selectedIds.includes(o.id);
            return (
              <button key={o.id} onClick={() => toggleOrder(o.id)} className={`w-full p-4 rounded-2xl border text-left transition-all ${checked ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-900 border-slate-700'}`}>
                <div className="flex items-center justify-between">
                  <div className="font-bold uppercase truncate pr-4">{o.client}</div>
                  {checked ? <CheckSquare className="text-blue-400" size={22} /> : <Square size={22} />}
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-6 border-t border-slate-700">
          <button onClick={handlePrint} className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-xl shadow-xl">
            <Printer size={24} /> IMPRIMIR
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintDialog;