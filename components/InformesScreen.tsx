import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, FileDown, Calendar, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const InformesScreen: React.FC<{ isAdmin: boolean, isAPK: boolean }> = ({ isAdmin, isAPK }) => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: materials } = await supabase.from('unico_materials').select('*');
      const matsFormatted = (materials || []).map(m => ({ id: m.id, ...m.payload, status: 'MATERIALES', date: new Date(m.created_at) }));
      const { data: orders } = await supabase.from('unico_orders').select('*');
      const ordsFormatted = (orders || []).map(o => ({ id: o.id, ...o.payload, status: (o.category || o.payload?.status || "PEDIDO").toUpperCase(), date: new Date(o.created_at) }));
      setRecords([...matsFormatted, ...ordsFormatted].sort((a, b) => b.date.getTime() - a.date.getTime()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAllData(); }, []);

  const exportToPDF = async () => {
    if (filteredRecords.length === 0) return alert("No hay datos");
    setExporting(true);
    try {
      const doc = new jsPDF('landscape');
      doc.text("INFORME ÚNICO MATERIALES", 14, 15);
      const tableRows = filteredRecords.map(r => [r.date.toLocaleDateString(), r.client || '', r.status, r.ubicado || '', r.cascos ? 'SÍ' : 'NO', r.puertas ? 'SÍ' : 'NO', r.tiradores ? 'SÍ' : 'NO', r.notes || '']);
      autoTable(doc, { head: [["FECHA", "CLIENTE", "ESTADO", "UBICACIÓN", "CA", "PU", "TI", "NOTAS"]], body: tableRows, startY: 28, theme: 'grid', styles: { fontSize: 8 } });
      const fileName = `REPORTE_${Date.now()}.pdf`;
      if (isAPK) {
        const pdfBlob = doc.output('blob');
        const { error: uploadError } = await supabase.storage.from('unico_images').upload(fileName, pdfBlob, { contentType: 'application/pdf' });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('unico_images').getPublicUrl(fileName);
        window.location.href = `https://docs.google.com/viewer?url=${encodeURIComponent(publicUrl)}&embedded=true`;
      } else { doc.save(fileName); }
    } catch (err: any) { alert("Fallo: " + err.message); }
    finally { setExporting(false); }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = (r.client || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "TODOS" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [records, search, statusFilter]);

  if (!isAdmin) return <div className="p-10 text-white font-black uppercase text-center">Acceso Denegado</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden"><div className=\"bg-slate-900 shadow-xl border-b border-slate-800 sticky top-0 z-30\"><div className=\"max-w-xl mx-auto px-5 py-4 flex items-center justify-between\"><div className=\"flex items-center gap-3\"><button onClick={() => navigate(\"/menu\")}><ChevronLeft size={28} /></button><h1 className=\"text-lg font-black uppercase\">Informes</h1></div><button onClick={exportToPDF} disabled={exporting} className=\"bg-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2\">{exporting ? <Loader2 className=\"animate-spin\" size={14}/> : <FileDown size={14}/>} PDF</button></div></div><div className=\"bg-slate-950/95 p-4 border-b border-slate-900\"><div className=\"max-w-xl mx-auto space-y-4\"><div className=\"relative\"><Search className=\"absolute left-3 top-1/2 -translate-y-1/2 text-slate-500\" size={16} /><input value={search} onChange={e => setSearch(e.target.value)} className=\"w-full bg-slate-900 border border-slate-800 p-3 pl-10 rounded-xl text-xs font-black uppercase text-white outline-none\" placeholder=\"BUSCAR...\" /></div><div className=\"flex gap-2 overflow-x-auto no-scrollbar pb-1\">{['TODOS', 'MATERIALES', 'ARMANDOSE', 'TERMINADA', 'PROGRAMADA', 'TERMINACIONES'].map(st => (<button key={st} onClick={() => setStatusFilter(st)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border ${statusFilter === st ? 'bg-white text-black border-white' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>{st === 'PROGRAMADA' ? 'ENTREGAS' : st}</button>))}</div></div></div><div className=\"flex-1 overflow-y-auto no-scrollbar\"><div className=\"max-w-xl mx-auto p-5 space-y-4 pb-24\">{loading ? (<div className=\"text-center py-10 font-black text-slate-500 uppercase\">Cargando...</div>) : filteredRecords.map(r => (<div key={r.id} className=\"bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col gap-3 shadow-sm\"><div className=\"flex justify-between items-start\"><div><h3 className=\"text-sm font-black uppercase text-white\">{r.client}</h3><div className=\"flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-bold uppercase\"><span className=\"flex items-center gap-1\"><Calendar size={12}/> {r.date.toLocaleDateString()}</span>{r.ubicado && <span className=\"flex items-center gap-1\"><MapPin size={12}/> {r.ubicado}</span>}</div></div><span className=\"text-[9px] font-black uppercase px-2 py-1 bg-slate-800 rounded-lg border border-slate-700 text-slate-400\">{r.status}</span></div></div>))}</div></div></div>
  );
};
export default InformesScreen;