import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Upload, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabase';
import { fetchAllRows } from '../utils/fetchAll';
import { getIsAPK } from '../utils/platform';

// btoa no admite directamente texto fuera de Latin-1 (acentos, etc.) -- este es el truco estándar para codificar UTF-8 a base64.
const toBase64Utf8 = (str: string) => btoa(unescape(encodeURIComponent(str)));

const BackupScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const exportData = async () => {
    setLoading(true);
    try {
      const materials = await fetchAllRows('unico_materials');
      const orders = await fetchAllRows('unico_orders');
      const backup = { date: new Date().toISOString(), materials, orders };
      const json = JSON.stringify(backup, null, 2);
      const filename = `BACKUP_UNICO_${new Date().toISOString().split('T')[0]}.json`;

      // El <a download> de un navegador normal no sirve de nada dentro del WebView de
      // la APK -- no hay gestor de descargas detrás que lo recoja. Ahí se guarda vía
      // el puente nativo (AndroidBridge.saveFile), en la carpeta de Descargas del móvil.
      if (getIsAPK() && (window as any).AndroidBridge?.saveFile) {
        const ok = (window as any).AndroidBridge.saveFile(toBase64Utf8(json), filename);
        if (!ok) throw new Error('No se pudo guardar el archivo en el dispositivo');
        setStatus({ type: 'success', msg: `Guardado en Descargas: ${filename}` });
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus({ type: 'success', msg: 'Copia descargada' });
      }
    } catch (err: any) { setStatus({ type: 'error', msg: 'Error' }); }
    finally { setLoading(false); }
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setShowConfirm(false); setLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        // Validar estructura del backup
        if (typeof json !== 'object' || json === null || (!Array.isArray(json.materials) && !Array.isArray(json.orders))) {
          setStatus({ type: 'error', msg: 'Archivo no válido — no es un backup de ÚNICO' });
          return;
        }
        const mats = Array.isArray(json.materials) ? json.materials : [];
        const ords = Array.isArray(json.orders) ? json.orders : [];
        if (mats.length === 0 && ords.length === 0) {
          setStatus({ type: 'error', msg: 'El archivo está vacío' });
          return;
        }
        if (mats.length > 0) await supabase.from('unico_materials').upsert(mats);
        if (ords.length > 0) await supabase.from('unico_orders').upsert(ords);
        setStatus({ type: 'success', msg: `Restaurados: ${mats.length} materiales · ${ords.length} pedidos` });
      } catch (err: any) {
        setStatus({ type: 'error', msg: 'Error al leer el archivo' });
      } finally { setLoading(false); }
    };
    reader.readAsText(pendingFile);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white normal-case">

      <div className="bg-slate-900 shadow-lg z-30 border-b border-slate-800">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-2">
          <button onClick={() => navigate('/menu')} className="active:scale-90 transition-transform"><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-semibold text-slate-100">Seguridad</h1>
        </div>
      </div>

      <div className="flex-1 w-full max-w-xl mx-auto p-5 space-y-4">

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/15 flex items-center justify-center mx-auto mb-4">
            <Download className="text-blue-400" size={26} />
          </div>
          <button onClick={exportData} disabled={loading} className="w-full bg-blue-600 py-4 rounded-2xl font-semibold active:scale-95 transition-all">
            Generar backup
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center relative shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-orange-600/15 flex items-center justify-center mx-auto mb-4">
            <Upload className="text-orange-400" size={26} />
          </div>
          <button className="w-full bg-slate-800 py-4 rounded-2xl font-semibold text-slate-200">Importar JSON</button>
          <input
            type="file"
            accept=".json"
            onChange={(e) => { if (e.target.files?.[0]) { setPendingFile(e.target.files[0]); setShowConfirm(true); } }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>

        {status && (
          <div className={`p-4 rounded-2xl text-center font-medium text-[13px] border ${
            status.type === 'success' ? 'bg-slate-900 text-emerald-400 border-emerald-500/20' : 'bg-slate-900 text-red-400 border-red-500/20'
          }`}>
            {status.msg}
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-orange-600/15 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-orange-400" size={28} />
            </div>
            <h3 className="text-white text-xl font-semibold text-center mb-4">¿Importar datos?</h3>
            <div className="space-y-3">
              <button onClick={confirmImport} className="w-full bg-emerald-600 py-4 rounded-2xl font-semibold shadow-lg active:scale-95 transition-all">
                Sí, restaurar
              </button>
              <button onClick={() => setShowConfirm(false)} className="w-full bg-slate-800 py-4 rounded-2xl font-semibold text-slate-300 active:scale-95 transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default BackupScreen;