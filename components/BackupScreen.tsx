import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Upload, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabase';

const BackupScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const exportData = async () => {
    setLoading(true);
    try {
      const { data: materials } = await supabase.from('unico_materials').select('*');
      const { data: orders } = await supabase.from('unico_orders').select('*');
      const backup = { date: new Date().toISOString(), materials: materials || [], orders: orders || [] };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `BACKUP_UNICO_${new Date().toISOString().split('T')[0]}.json`; link.click();
      setStatus({ type: 'success', msg: 'COPIA DESCARGADA' });
    } catch (err: any) { setStatus({ type: 'error', msg: 'ERROR' }); }
    finally { setLoading(false); }
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setShowConfirm(false); setLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (json.materials?.length > 0) await supabase.from('unico_materials').upsert(json.materials);
        if (json.orders?.length > 0) await supabase.from('unico_orders').upsert(json.orders);
        setStatus({ type: 'success', msg: 'DATOS RESTAURADOS' });
      } catch (err: any) { setStatus({ type: 'error', msg: 'ERROR' }); }
      finally { setLoading(false); }
    };
    reader.readAsText(pendingFile);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white"><div className="bg-slate-900 shadow-lg z-30 border-b border-slate-800"><div className="max-w-xl mx-auto px-5 py-3 flex items-center gap-2"><button onClick={() => navigate('/menu')}><ChevronLeft size={28} /></button><h1 className="text-lg font-black uppercase tracking-wider">Seguridad</h1></div></div><div className="flex-1 w-full max-w-xl mx-auto p-5 space-y-6"><div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl"><Download className="mx-auto text-blue-500 mb-4" size={40} /><button onClick={exportData} disabled={loading} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">Generar Backup</button></div><div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center relative shadow-xl"><Upload className="mx-auto text-orange-500 mb-4" size={40} /><button className="w-full bg-slate-800 py-4 rounded-2xl font-black uppercase tracking-widest">Importar JSON</button><input type="file" accept=".json" onChange={(e) => { if(e.target.files?.[0]) { setPendingFile(e.target.files[0]); setShowConfirm(true); } }} className="absolute inset-0 opacity-0 cursor-pointer" /></div>{status && <div className="p-4 rounded-2xl text-center font-black uppercase text-[10px] bg-slate-900 text-emerald-400 border border-emerald-500/20 tracking-widest">{status.msg}</div>}</div>{showConfirm && (<div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"><div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl"><AlertTriangle className="text-orange-500 mx-auto mb-4" size={32} /><h3 className="text-white text-xl font-black text-center uppercase mb-4">¿Importar Datos?</h3><div className="space-y-3"><button onClick={confirmImport} className="w-full bg-emerald-600 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Sí, Restaurar</button><button onClick={() => setShowConfirm(false)} className="w-full bg-slate-800 py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">Cancelar</button></div></div></div>)}</div>
  );
};
export default BackupScreen;