import React, { useCallback } from "react";

type SummaryDialogProps = {
  title: string;
  text: string;
  printHtml?: string;
  onClose: () => void;
};

const UNICO_PRINT_STYLE = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: sans-serif; color: #000; padding: 20px; }
.title { text-align: center; font-weight: 900; font-size: 18px; text-transform: uppercase; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #eee; }
`;

const SummaryDialog: React.FC<SummaryDialogProps> = ({ title, text, printHtml, onClose }) => {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, [text]);

  const handlePrint = useCallback(() => {
    if (!printHtml) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>${UNICO_PRINT_STYLE}</style>
          </head>
          <body>
            <div class="title">${title}</div>
            ${printHtml}
            <script>window.onload = () => { window.print(); window.close(); };</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      alert("BLOQUEO DE POP-UP: Por favor, permite las ventanas emergentes.");
    }
  }, [printHtml, title]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-full">
        {/* Header - Diseño arreglado para móvil */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="font-black tracking-widest text-slate-100 truncate w-full sm:w-auto">{title}</div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button onClick={handleCopy} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-sm">COPIAR</button>
            <button onClick={handlePrint} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-black text-sm">IMPRIMIR</button>
            <button onClick={onClose} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-sm">CERRAR</button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1 bg-slate-950">
          <pre className="whitespace-pre-wrap font-mono text-xs md:text-sm text-slate-300">{text}</pre>
        </div>
      </div>
    </div>
  );
};

export default SummaryDialog;