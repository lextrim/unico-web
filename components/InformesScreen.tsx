import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, FileDown, Calendar, MapPin, Loader2, FileText, X, ChevronRight, Clock } from 'lucide-react';
import { supabase } from '../supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const getBadgeClass = (isActive: boolean) =>
  `w-9 h-5 flex items-center justify-center text-[8px] font-black tracking-tighter rounded border shrink-0 ${
    isActive
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : 'text-slate-600 bg-slate-800/50 border-slate-700'
  } uppercase`;

const STATUS_COLORS: Record<string, string> = {
  MATERIALES:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ARMANDOSE:    'bg-orange-500/20 text-orange-400 border-orange-500/30',
  TERMINADA:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  PROGRAMADA:   'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  TERMINACIONES:'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  PROGRAMADA: 'ENTREGAS',
};

const label = (status: string) => STATUS_LABEL[status] || status;

const InformesScreen: React.FC<{ isAdmin: boolean; isAPK: boolean }> = ({ isAdmin, isAPK }) => {
  const navigate = useNavigate();
  const [records, setRecords]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [exporting, setExporting]   = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [traceRecord, setTraceRecord]   = useState<any | null>(null);
  const [traceRecords, setTraceRecords] = useState<any[]>([]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: materials } = await supabase.from('unico_materials').select('*');
      const mats = (materials || []).map(m => ({
        id: m.id, ...m.payload, status: 'MATERIALES', date: new Date(m.created_at),
      }));
      const { data: orders } = await supabase.from('unico_orders').select('*');
      const ords = (orders || []).map(o => ({
        id: o.id, ...o.payload,
        status: (o.category || o.payload?.status || 'PEDIDO').toUpperCase(),
        date: new Date(o.created_at),
      }));
      setRecords([...mats, ...ords].sort((a, b) => b.date.getTime() - a.date.getTime()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAllData(); }, []);

  const openTrace = (r: any) => {
    const clientName = r.client?.toUpperCase().trim();
    const matched = records
      .filter(rec => rec.client?.toUpperCase().trim() === clientName)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    setTraceRecord(r);
    setTraceRecords(matched);
  };

  const buildPDF = async (rows: any[], title: string) => {
    const doc = new jsPDF('landscape');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, 14, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Generado: ${new Date().toLocaleString('es-ES')} · Total: ${rows.length} registros`,
      14, 22
    );
    doc.setTextColor(0);

    const tableRows = rows.map(r => [
      r.date.toLocaleDateString('es-ES'),
      r.client || '',
      label(r.status),
      r.ubicado || '',
      r.cascos  ? 'SI' : 'NO',
      r.puertas ? 'SI' : 'NO',
      r.tiradores ? 'SI' : 'NO',
      r.deliveryDatetime
        ? new Date(r.deliveryDatetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '',
      r.notes || '',
    ]);

    autoTable(doc, {
      head: [['FECHA', 'CLIENTE', 'ESTADO', 'UBICACIÓN', 'CA', 'PT', 'TR', 'ENTREGA', 'NOTAS']],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        4: { cellWidth: 10, halign: 'center' },
        5: { cellWidth: 10, halign: 'center' },
        6: { cellWidth: 10, halign: 'center' },
        7: { cellWidth: 28 },
      },
    });

    const fileName = `REPORTE_${Date.now()}.pdf`;
    if (isAPK) {
      const pdfBlob = doc.output('blob');
      const { error } = await supabase.storage
        .from('unico_images')
        .upload(fileName, pdfBlob, { contentType: 'application/pdf' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('unico_images').getPublicUrl(fileName);
      window.location.href = `https://docs.google.com/viewer?url=${encodeURIComponent(publicUrl)}&embedded=true`;
    } else {
      doc.save(fileName);
    }
  };

  const exportToPDF = async (traceDump?: any) => {
    setExporting(true);
    try {
      if (traceDump) {
        if (traceRecords.length === 0) return alert('No hay datos');
        await buildPDF(traceRecords, `TRAZABILIDAD · ${traceDump.client?.toUpperCase()}`);
      } else {
        if (filteredRecords.length === 0) return alert('No hay datos');
        await buildPDF(
          filteredRecords,
          `INFORME ÚNICO MATERIALES · ${new Date().toLocaleDateString('es-ES')}`
        );
      }
    } catch (err: any) { alert('Fallo: ' + err.message); }
    finally { setExporting(false); }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = (r.client || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'TODOS' || r.status === statusFilter;
      const matchFrom   = !dateFrom || r.date >= new Date(dateFrom);
      const matchTo     = !dateTo   || r.date <= new Date(dateTo + 'T23:59:59');
      return matchSearch && matchStatus && matchFrom && matchTo;
    });
  }, [records, search, statusFilter, dateFrom, dateTo]);

  if (!isAdmin) return (
    <div className="p-10 text-white font-black uppercase text-center">Acceso Denegado</div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">

      {/* ── Modal trazabilidad ── */}
      {traceRecord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            {/* Cabecera modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-black uppercase text-white truncate">{traceRecord.client}</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                  Trazabilidad · {traceRecords.length} {traceRecords.length === 1 ? 'estado' : 'estados'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => exportToPDF(traceRecord)}
                  disabled={exporting}
                  className="bg-red-600 p-2.5 rounded-xl active:scale-90 transition-all"
                >
                  {exporting ? <Loader2 className="animate-spin" size={15} /> : <FileDown size={15} />}
                </button>
                <button
                  onClick={() => { setTraceRecord(null); setTraceRecords([]); }}
                  className="bg-slate-800 p-2.5 rounded-xl active:scale-90 transition-all"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Línea de tiempo */}
            <div className="overflow-y-auto no-scrollbar p-4 space-y-2">
              {traceRecords.map((r, i) => (
                <div key={r.id} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] font-black text-slate-400 shrink-0">
                      {i + 1}
                    </div>
                    {i < traceRecords.length - 1 && (
                      <div className="w-px h-5 bg-slate-800 my-1" />
                    )}
                  </div>
                  <div className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-3 space-y-1.5 mb-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${STATUS_COLORS[r.status] || 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                        {label(r.status)}
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold shrink-0">
                        {r.date.toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    {r.ubicado && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <MapPin size={9} />{r.ubicado}
                      </p>
                    )}
                    {(r.cascos !== undefined || r.puertas !== undefined || r.tiradores !== undefined) && (
                      <div className="flex gap-1">
                        <span className={getBadgeClass(r.cascos)}>CA</span>
                        <span className={getBadgeClass(r.puertas)}>PT</span>
                        <span className={getBadgeClass(r.tiradores)}>TR</span>
                      </div>
                    )}
                    {r.deliveryDatetime && (
                      <p className="text-[10px] text-indigo-400 flex items-center gap-1">
                        <Clock size={9} />
                        {new Date(r.deliveryDatetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {r.notes && (
                      <p className="text-[10px] text-slate-400 flex items-start gap-1 leading-snug">
                        <FileText size={9} className="shrink-0 mt-[1px]" />
                        <span className="break-words">{r.notes}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-slate-900 shadow-xl border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/menu')} className="active:scale-90 transition-transform">
              <ChevronLeft size={28} />
            </button>
            <h1 className="text-lg font-black uppercase">Informes</h1>
          </div>
          <button
            onClick={() => exportToPDF()}
            disabled={exporting}
            className="bg-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"
          >
            {exporting ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />} PDF
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-slate-950/95 p-4 border-b border-slate-900">
        <div className="max-w-xl mx-auto space-y-3">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 p-3 pl-10 rounded-xl text-xs font-black uppercase text-white outline-none focus:border-blue-500 transition-all"
              placeholder="BUSCAR CLIENTE..."
            />
          </div>

          {/* Rango de fechas */}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-[10px] font-black text-slate-400 outline-none focus:border-blue-500 transition-all"
            />
            <span className="text-slate-600 text-[10px] font-black shrink-0">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-[10px] font-black text-slate-400 outline-none focus:border-blue-500 transition-all"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="px-3 py-2.5 bg-red-900/20 rounded-xl text-red-500 text-[10px] font-black"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filtros de estado */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['TODOS', 'MATERIALES', 'ARMANDOSE', 'TERMINADA', 'PROGRAMADA', 'TERMINACIONES'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border ${
                  statusFilter === st
                    ? 'bg-white text-black border-white'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                {label(st)}
              </button>
            ))}
          </div>

          <p className="text-[9px] text-slate-600 font-black uppercase text-right">
            {filteredRecords.length} registro{filteredRecords.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Lista ── */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto p-5 space-y-3 pb-24">
          {loading ? (
            <div className="text-center py-10 font-black text-slate-500 uppercase">Cargando...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-10 font-black text-slate-600 uppercase text-xs">Sin resultados</div>
          ) : filteredRecords.map(r => (
            <button
              key={r.id}
              onClick={() => openTrace(r)}
              className="w-full text-left bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col gap-2.5 shadow-sm active:scale-[0.99] transition-all"
            >
              {/* Fila superior: cliente + estado + flecha */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black uppercase text-white truncate">{r.client}</h3>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-bold uppercase">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {r.date.toLocaleDateString('es-ES')}
                    </span>
                    {r.ubicado && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={11} /> {r.ubicado}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${STATUS_COLORS[r.status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {label(r.status)}
                  </span>
                  <ChevronRight size={13} className="text-slate-600" />
                </div>
              </div>

              {/* Badges CA/PT/TR */}
              {(r.cascos !== undefined || r.puertas !== undefined || r.tiradores !== undefined) && (
                <div className="flex gap-1.5">
                  <span className={getBadgeClass(r.cascos)}>CA</span>
                  <span className={getBadgeClass(r.puertas)}>PT</span>
                  <span className={getBadgeClass(r.tiradores)}>TR</span>
                </div>
              )}

              {/* Fecha de entrega */}
              {r.deliveryDatetime && (
                <p className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(r.deliveryDatetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}

              {/* Notas */}
              {r.notes && (
                <p className="text-[10px] text-slate-400 flex items-start gap-1 leading-snug">
                  <FileText size={10} className="shrink-0 mt-[1px]" />
                  <span className="break-words line-clamp-2">{r.notes}</span>
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InformesScreen;
