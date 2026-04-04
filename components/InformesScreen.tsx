import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Calendar, MapPin, FileText, X, ChevronRight, Clock, Printer, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';

const getBadgeClass = (isActive: boolean) =>
  `w-9 h-5 flex items-center justify-center text-[8px] font-black tracking-tighter rounded border shrink-0 ${
    isActive
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : 'text-slate-600 bg-slate-800/50 border-slate-700'
  } uppercase`;

const STATUS_COLORS: Record<string, string> = {
  MATERIALES:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ARMANDOSE:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  TERMINADA:     'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  PROGRAMADA:    'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  TERMINACIONES: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_LABEL: Record<string, string> = { PROGRAMADA: 'ENTREGAS' };
const label = (s: string) => STATUS_LABEL[s] || s;

const PRINT_BADGE: Record<string, string> = {
  MATERIALES:    'background:#dbeafe;color:#1d4ed8',
  ARMANDOSE:     'background:#ffedd5;color:#c2410c',
  TERMINADA:     'background:#d1fae5;color:#065f46',
  PROGRAMADA:    'background:#e0e7ff;color:#3730a3',
  TERMINACIONES: 'background:#fee2e2;color:#991b1b',
};

const diffLabel = (ms: number) => {
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
};

const printBase = (title: string, subtitle: string, body: string) => `
  <!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>
    @page{margin:15mm}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#000;width:100%}
    h1{font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
    .sub{font-size:9px;color:#64748b;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;font-size:10px}
    th{background:#1e293b;color:#fff;padding:6px 8px;text-align:left;font-weight:bold;text-transform:uppercase;font-size:9px}
    td{padding:5px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc}
    .badge{display:inline-block;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:8px;text-transform:uppercase}
    .step{display:flex;gap:12px;margin-bottom:8px;align-items:flex-start}
    .dot{width:28px;height:28px;border-radius:50%;background:#1e293b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;flex-shrink:0;margin-top:2px}
    .line{width:1px;height:16px;background:#cbd5e1;margin:2px 0 2px 13px}
    .card{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:10px}
    .card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
    .card-meta{font-size:9px;color:#64748b;margin-top:3px}
    .elapsed{font-size:8px;color:#94a3b8;font-style:italic;margin:4px 0 2px 13px}
  </style></head><body>
  <h1>${title}</h1><p class="sub">${subtitle}</p>
  ${body}
  </body></html>`;


const InformesScreen: React.FC<{ isAdmin: boolean; isAPK: boolean }> = ({ isAdmin, isAPK }) => {
  const navigate = useNavigate();
  const [records, setRecords]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [printing, setPrinting]         = useState(false);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [traceRecord, setTraceRecord]   = useState<any | null>(null);
  const [traceRecords, setTraceRecords] = useState<any[]>([]);
  const openPrintWindow = (html: string) => {
    if (isAPK) {
      // Usa el bridge nativo Android para el diálogo de impresión real
      (window as any).AndroidBridge?.printHtml(html);
      return;
    }
    const win = window.open('', '_blank');
    if (!win) { alert('Permite ventanas emergentes para imprimir'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

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

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch = (r.client || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'TODOS' || r.status === statusFilter;
      const matchFrom   = !dateFrom || r.date >= new Date(dateFrom);
      const matchTo     = !dateTo   || r.date <= new Date(dateTo + 'T23:59:59');
      return matchSearch && matchStatus && matchFrom && matchTo;
    });
  }, [records, search, statusFilter, dateFrom, dateTo]);

  const handlePrintReport = async () => {
    if (filteredRecords.length === 0) return;
    setPrinting(true);
    try {
      const title = statusFilter === 'TODOS' ? 'INFORME GENERAL' : `INFORME · ${label(statusFilter)}`;
      const subtitle = `Generado: ${new Date().toLocaleString('es-ES')} · Total: ${filteredRecords.length} registros`;
      const ORDER = ['MATERIALES', 'ARMANDOSE', 'TERMINADA', 'PROGRAMADA', 'TERMINACIONES'];
      const grouped = ORDER
        .map(s => ({ status: s, items: filteredRecords.filter(r => r.status === s) }))
        .filter(g => g.items.length > 0);
      // Añadir categorías no contempladas al final
      const known = new Set(ORDER);
      const others = filteredRecords.filter(r => !known.has(r.status));
      if (others.length) grouped.push({ status: 'OTROS', items: others });

      const thead = `<thead><tr><th>Fecha</th><th>Cliente</th><th>Ubicación</th><th>CA</th><th>PT</th><th>TR</th><th>Entrega</th><th>Notas</th></tr></thead>`;
      const makeRows = (items: any[]) => items.map(r => `
        <tr>
          <td>${r.date.toLocaleDateString('es-ES')}</td>
          <td><strong>${r.client || ''}</strong></td>
          <td>${r.ubicado || ''}</td>
          <td style="text-align:center">${r.cascos ? '✓' : '—'}</td>
          <td style="text-align:center">${r.puertas ? '✓' : '—'}</td>
          <td style="text-align:center">${r.tiradores ? '✓' : '—'}</td>
          <td>${r.deliveryDatetime ? new Date(r.deliveryDatetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</td>
          <td>${r.notes || ''}</td>
        </tr>`).join('');

      const body = grouped.map(g => `
        <div style="margin-bottom:20px">
          <div style="background:${PRINT_BADGE[g.status]?.split(';')[0]?.replace('background:','') || '#f1f5f9'};color:${PRINT_BADGE[g.status]?.split(';')[1]?.replace('color:','') || '#475569'};padding:5px 10px;font-weight:900;font-size:10px;text-transform:uppercase;letter-spacing:.08em;border-radius:4px 4px 0 0;display:inline-block;margin-bottom:4px">
            ${label(g.status)} · ${g.items.length} registro${g.items.length !== 1 ? 's' : ''}
          </div>
          <table>${thead}<tbody>${makeRows(g.items)}</tbody></table>
        </div>`).join('');
      openPrintWindow(printBase(title, subtitle, body));
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintTrace = () => {
    if (traceRecords.length === 0) return;
    const clientName = traceRecord.client?.toUpperCase();
    const title = `TRAZABILIDAD · ${clientName}`;
    const subtitle = `Generado: ${new Date().toLocaleString('es-ES')} · ${traceRecords.length} etapas`;
    const steps = traceRecords.map((r, i) => {
      const next = traceRecords[i + 1];
      const elapsed = next ? diffLabel(next.date.getTime() - r.date.getTime()) : null;
      const extras = [
        r.ubicado ? `📍 ${r.ubicado}` : '',
        r.deliveryDatetime ? `🕐 ${new Date(r.deliveryDatetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '',
        r.notes ? `📝 ${r.notes}` : '',
      ].filter(Boolean).join(' &nbsp;·&nbsp; ');
      return `
        <div class="step">
          <div>
            <div class="dot">${i + 1}</div>
            ${elapsed ? `<div class="line"></div>` : ''}
          </div>
          <div style="flex:1">
            <div class="card">
              <div class="card-head">
                <span class="badge" style="${PRINT_BADGE[r.status] || 'background:#f1f5f9;color:#475569'}">${label(r.status)}</span>
                <span style="font-size:9px;color:#64748b">${r.date.toLocaleDateString('es-ES')}</span>
              </div>
              ${extras ? `<div class="card-meta">${extras}</div>` : ''}
            </div>
            ${elapsed ? `<div class="elapsed">⏱ ${elapsed} hasta la siguiente etapa</div>` : ''}
          </div>
        </div>`;
    }).join('');
    openPrintWindow(printBase(title, subtitle, `<div>${steps}</div>`));
  };

  if (!isAdmin) return (
    <div className="p-10 text-white font-black uppercase text-center">Acceso Denegado</div>
  );


  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">

      {/* ── Modal trazabilidad ── */}
      {traceRecord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">

            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-black uppercase text-white truncate">{traceRecord.client}</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                  Trazabilidad · {traceRecords.length} {traceRecords.length === 1 ? 'etapa' : 'etapas'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handlePrintTrace}
                  className="bg-blue-600 p-2.5 rounded-xl active:scale-90 transition-all"
                  title="Imprimir trazabilidad"
                >
                  <Printer size={15} />
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
            <div className="overflow-y-auto no-scrollbar p-4 space-y-1">
              {traceRecords.map((r, i) => {
                const next = traceRecords[i + 1];
                const elapsed = next ? diffLabel(next.date.getTime() - r.date.getTime()) : null;
                return (
                  <div key={r.id}>
                    <div className="flex gap-3 items-start">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] font-black text-slate-300">
                          {i + 1}
                        </div>
                        {elapsed && <div className="w-px flex-1 min-h-[12px] bg-slate-800 my-1" />}
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
                    {elapsed && (
                      <div className="flex items-center gap-2 ml-9 mb-1">
                        <Clock size={9} className="text-slate-600 shrink-0" />
                        <span className="text-[9px] text-slate-600 font-bold">{elapsed} en esta etapa</span>
                      </div>
                    )}
                  </div>
                );
              })}
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
            onClick={handlePrintReport}
            disabled={printing || filteredRecords.length === 0}
            className="bg-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 disabled:opacity-40 active:scale-95 transition-all"
          >
            {printing ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
            IMPRIMIR
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-slate-950/95 p-4 border-b border-slate-900">
        <div className="max-w-xl mx-auto space-y-3">

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white font-black uppercase text-xs outline-none focus:border-blue-500 transition-all"
          >
            <option value="TODOS">TODOS LOS REGISTROS</option>
            <option value="MATERIALES">MATERIAL</option>
            <option value="ARMANDOSE">ARMÁNDOSE</option>
            <option value="TERMINADA">TERMINADA</option>
            <option value="PROGRAMADA">ENTREGAS</option>
            <option value="TERMINACIONES">TERMINACIONES</option>
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 p-3 pl-10 rounded-xl text-xs font-black uppercase text-white outline-none focus:border-blue-500 transition-all"
              placeholder="BUSCAR CLIENTE..."
            />
          </div>

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

              {(r.cascos !== undefined || r.puertas !== undefined || r.tiradores !== undefined) && (
                <div className="flex gap-1.5">
                  <span className={getBadgeClass(r.cascos)}>CA</span>
                  <span className={getBadgeClass(r.puertas)}>PT</span>
                  <span className={getBadgeClass(r.tiradores)}>TR</span>
                </div>
              )}

              {r.deliveryDatetime && (
                <p className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(r.deliveryDatetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}

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