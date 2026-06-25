import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Trash2, MapPin, Search, Camera, Loader2, Image as ImageIcon, Edit3, X, FileText, AlertTriangle, AlertCircle } from "lucide-react";
import { supabase } from "../supabase";
import AppModal from "./AppModal";
import DateTimePickerModal from "./DateTimePickerModal";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { BADGE_COLORS, getBadgeClass } from "../utils/badges";
import { compressImage, createBlobUrl } from "../utils/imageUtils";
import { countWorkingDaysUntil, countWorkingDaysBeforeDelivery } from "../utils/workingDays";

// Returns urgency level based on working days until delivery (excludes weekends + Seville holidays)
const getDeliveryUrgency = (deliveryDatetime: string | null | undefined) => {
  if (!deliveryDatetime) return null;
  const workingDays = countWorkingDaysUntil(deliveryDatetime);
  if (workingDays < 0) return 'overdue';
  if (workingDays <= 2) return 'critical';
  if (workingDays <= 4) return 'warning';
  return 'ok';
};

const URGENCY_CARD: Record<string, string> = {
  overdue:  'border-l-4 border-l-red-600 bg-red-950/30',
  critical: 'border-l-4 border-l-red-500 bg-red-950/20',
  warning:  'border-l-4 border-l-amber-500 bg-amber-950/20',
  ok:       'border-l-4 border-l-emerald-500 bg-emerald-950/20',
};

const URGENCY_BADGE: Record<string, string> = {
  overdue:  'text-red-400 bg-red-500/15 border border-red-500/30',
  critical: 'text-red-400 bg-red-500/10 border border-red-500/20',
  warning:  'text-amber-400 bg-amber-500/10 border border-amber-500/20',
  ok:       'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
};

const formatDeliveryDate = (dt: string) => {
  const d = new Date(dt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (diffMs < 0) return `VENCIDA · ${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`;
  if (diffDays < 1) return `HOY · ${time}`;
  if (diffDays < 2) return `MAÑANA · ${time}`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ` · ${time}`;
};

async function autoMoveToArmandose(rawData: any[]): Promise<{ movedIds: Set<string>; movedClients: string[] }> {
  const movedIds = new Set<string>();
  const movedClients: string[] = [];
  const toMove = rawData.filter((x: any) => {
    const dt = x.payload?.deliveryDatetime;
    if (!dt) return false;
    return countWorkingDaysBeforeDelivery(dt) <= 4;
  });
  if (toMove.length === 0) return { movedIds, movedClients };
  const nowIso = new Date().toISOString();
  const bridge = (window as any).AndroidBridge;
  for (const mat of toMove) {
    await supabase.from('unico_orders').insert({
      id: crypto.randomUUID(),
      payload: { ...mat.payload, status: 'ARMANDOSE', category: 'ARMANDOSE' },
      created_at: nowIso,
      category: 'ARMANDOSE'
    });
    await supabase.from('unico_materials').delete().eq('id', mat.id);
    bridge?.cancelNotification?.(`${mat.id}_armandose`);
    movedIds.add(mat.id);
    movedClients.push((mat.payload?.client || '').toUpperCase());
  }
  return { movedIds, movedClients };
}

const MaterialScreen: React.FC<{ orders?: any[], isAdmin: boolean }> = ({ orders = [], isAdmin }) => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [client, setClient] = useState("");
  const [estado, setEstado] = useState("");
  const [rack, setRack] = useState("");
  const [nivel, setNivel] = useState("");
  const [cascos, setCascos] = useState(false);
  const [puertas, setPuertas] = useState(false);
  const [tiradores, setTiradores] = useState(false);
  const [filterCascos, setFilterCascos] = useState(false);
  const [filterPuertas, setFilterPuertas] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [autoMovedClients, setAutoMovedClients] = useState<string[]>([]);

  useEffect(() => {
    if (autoMovedClients.length === 0) return;
    const t = setTimeout(() => setAutoMovedClients([]), 8000);
    return () => clearTimeout(t);
  }, [autoMovedClients]);

  // Limpia blob URLs al desmontar el componente
  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);
  const [modal, setModal] = useState<any>(null);

  const showAlert = (title: string, message?: string, iconBg = 'bg-orange-600', icon = <AlertTriangle size={28} className="text-white" />) =>
    setModal({ title, message, icon, iconBg, onConfirm: () => setModal(null) });

  const showConfirm = (title: string, message: string, onConfirm: () => void) =>
    setModal({ title, message, icon: <Trash2 size={28} className="text-white" />, iconBg: 'bg-red-600', confirmText: 'BORRAR', confirmClass: 'bg-red-600', onConfirm: () => { setModal(null); onConfirm(); }, onCancel: () => setModal(null) });

  const fetchMaterials = async () => {
    setListLoading(true);
    try {
      const { data } = await supabase.from('unico_materials').select('*').order('created_at', { ascending: false });
      if (data) {
        const { movedIds, movedClients } = await autoMoveToArmandose(data);
        if (movedClients.length > 0) setAutoMovedClients(movedClients);
        const remaining = movedIds.size > 0 ? data.filter((m: any) => !movedIds.has(m.id)) : data;
        setRecords(remaining.map((m: any) => ({ id: m.id, ...m.payload, server_created_at: m.created_at })));
      }
    } finally { setListLoading(false); }
  };

  useEffect(() => { fetchMaterials(); }, []);

  const resetForm = () => {
    setClient(""); setEstado(""); setRack(""); setNivel(""); setCascos(false);
    setPuertas(false); setTiradores(false); setDeliveryDate(""); setDeliveryTime(""); setNotes(""); setEditingId(null);
    setImageFile(null);
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setImagePreview(null);
  };

  const onSave = async () => {
    if (!client.trim()) { showAlert("Campo obligatorio", "El nombre del cliente es obligatorio"); return; }
    const clientUpper = client.toUpperCase().trim();
    if (!editingId) {
      // Comprobar duplicado en materiales
      const dupMat = records.find(r => r.client?.toUpperCase().trim() === clientUpper);
      if (dupMat) { showAlert("Cliente duplicado", `"${clientUpper}" ya está en la lista de Materiales`); return; }
      // Comprobar duplicado en pedidos activos
      const { data: ordDups } = await supabase.from('unico_orders').select('id, payload, category').limit(500);
      const FINAL_STATES = ['TERMINADA', 'TERMINACIONES'];
      const dupOrd = (ordDups || []).find((r: any) =>
        r.payload?.client?.toUpperCase().trim() === clientUpper &&
        !FINAL_STATES.includes((r.category || '').toUpperCase())
      );
      if (dupOrd) {
        const CAT_LABEL: Record<string, string> = { ARMANDOSE: 'Armándose', TERMINADA: 'Terminada', PROGRAMADA: 'Entregas', TERMINACIONES: 'Terminaciones' };
        const donde = CAT_LABEL[(dupOrd.category || '').toUpperCase()] || dupOrd.category;
        showAlert("Cliente duplicado", `"${clientUpper}" ya existe en ${donde}`);
        return;
      }
    }
    setIsUploading(true);
    try {
      let finalImageUrl = editingId ? records.find(r => r.id === editingId)?.image_url : null;
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const fileName = `${Date.now()}.jpg`;
        await supabase.storage.from('unico_images').upload(fileName, compressed);
        const { data: pub } = supabase.storage.from('unico_images').getPublicUrl(fileName);
        finalImageUrl = pub.publicUrl;
      }
      const nowIso = new Date().toISOString();
      const payload = {
        client: client.toUpperCase().trim(),
        cascos,
        puertas,
        tiradores,
        ubicado: `${rack.trim().toUpperCase()} - ${nivel.trim().toUpperCase()}`,
        notes: notes.toUpperCase().trim(),
        image_url: finalImageUrl,
        ...(deliveryDate ? { deliveryDatetime: `${deliveryDate}T${deliveryTime || '00:00'}` } : {})
      };
      if (estado !== "") {
        await supabase.from('unico_orders').insert({
          id: crypto.randomUUID(),
          payload: { ...payload, status: estado, category: estado },
          created_at: nowIso,
          category: estado
        });
        if (editingId) await supabase.from('unico_materials').delete().eq('id', editingId);
        resetForm();
        navigate(`/list/${estado}`);
      } else {
        const ex = editingId ? records.find(r => r.id === editingId) : null;
        await supabase.from('unico_materials').upsert({
          id: editingId || crypto.randomUUID(),
          payload,
          created_at: ex ? ex.server_created_at : nowIso
        });
        resetForm(); fetchMaterials();
      }
    } catch (err) { showAlert("Error al guardar", "Ha ocurrido un error. Inténtalo de nuevo.", 'bg-red-600', <AlertCircle size={28} className="text-white" />); }
    finally { setIsUploading(false); }
  };

  // ✅ FIX: Al editar, cargar también el campo notes
  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setClient(r.client || "");
    const parts = r.ubicado?.split(' - ') || ["", ""];
    setRack(parts[0] || "");
    setNivel(parts[1] || "");
    setCascos(r.cascos || false);
    setPuertas(r.puertas || false);
    setTiradores(r.tiradores || false);
    const [dDate, dTime] = (r.deliveryDatetime || "").split('T');
    setDeliveryDate(dDate || "");
    setDeliveryTime(dTime ? dTime.slice(0, 5) : "");
    setNotes(r.notes || "");
    setImagePreview(r.image_url || null);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filtered = useMemo(() => {
    const q = search.toUpperCase().trim();
    const base = records.filter(r => {
      if (q && !r.client?.toUpperCase().includes(q) && !r.ubicado?.toUpperCase().includes(q)) return false;
      if (filterCascos && !r.cascos) return false;
      if (filterPuertas && !r.puertas) return false;
      return true;
    });
    const withDate = base.filter(r => r.deliveryDatetime).sort((a, b) => new Date(a.deliveryDatetime).getTime() - new Date(b.deliveryDatetime).getTime());
    const withoutDate = base.filter(r => !r.deliveryDatetime);
    return [...withDate, ...withoutDate];
  }, [records, search, filterCascos, filterPuertas]);

  useEffect(() => {
    const hasFilter = search.trim() !== "" || filterCascos || filterPuertas;
    if (!hasFilter) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } else if (filtered.length > 0) {
      itemRefs.current.get(filtered[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [filtered]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden relative">
      {modal && <AppModal {...modal} />}
      {showDatePicker && (
        <DateTimePickerModal
          initialDate={deliveryDate}
          initialTime={deliveryTime}
          onConfirm={(date, time) => { setDeliveryDate(date); setDeliveryTime(time); setShowDatePicker(false); }}
          onCancel={() => setShowDatePicker(false)}
        />
      )}
      {fullscreenImg && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-sm flex items-center justify-center">
          <button
            onClick={() => setFullscreenImg(null)}
            className="absolute top-5 right-5 z-[120] p-2.5 bg-white/10 rounded-full text-white border border-white/15 active:scale-90 transition-all"
          >
            <X size={22} />
          </button>
          <TransformWrapper initialScale={1} minScale={0.3} maxScale={8} centerOnInit={true}>
            <TransformComponent
              wrapperStyle={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
              contentStyle={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <img
                src={fullscreenImg}
                style={{ width: "100vw", height: "100vh", objectFit: "contain" }}
              />
            </TransformComponent>
          </TransformWrapper>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/25 text-[9px] font-black uppercase tracking-widest pointer-events-none">
            Pellizca para zoom
          </span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-blue-600 shadow-xl">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-2">
          <button onClick={() => navigate("/menu")} className="active:scale-90 transition-transform"><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-black uppercase tracking-widest leading-none text-white">Material</h1>
        </div>
        {autoMovedClients.length > 0 && (
          <div className="bg-orange-500/90 px-4 py-2 flex items-center gap-3 border-t border-orange-400/30">
            <AlertTriangle size={13} className="text-white shrink-0" />
            <p className="text-[10px] font-black uppercase text-white flex-1 leading-tight tracking-wide">
              Pasado a ARMÁNDOSE: {autoMovedClients.join(' · ')}
            </p>
            <button onClick={() => setAutoMovedClients([])} className="shrink-0 p-1 active:scale-90 transition-all">
              <X size={13} className="text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Buscador */}
      <div className="bg-slate-950/95 backdrop-blur-md p-3 border-b border-slate-900 sticky top-[60px] z-20">
        <div className="max-w-xl mx-auto px-2 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 p-3 pl-10 rounded-xl text-white font-black uppercase text-xs outline-none focus:border-blue-500 transition-all"
                placeholder="BUSCAR CLIENTE..."
              />
            </div>
            <button onClick={() => { setSearch(""); setFilterCascos(false); setFilterPuertas(false); }} className="bg-red-900/20 px-4 rounded-xl text-red-500 font-black text-[10px] uppercase active:scale-90 transition-all">LIMPIAR</button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterCascos(v => !v)}
              className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase border transition-all active:scale-95 ${filterCascos ? BADGE_COLORS.cascos.on + ' border-blue-500/40' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
            >
              CASCOS
            </button>
            <button
              onClick={() => setFilterPuertas(v => !v)}
              className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase border transition-all active:scale-95 ${filterPuertas ? BADGE_COLORS.puertas.on + ' border-emerald-500/40' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
            >
              PUERTAS
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar">

        {/* Formulario admin */}
        {isAdmin && (
          <div className="max-w-xl mx-auto px-5 py-6 space-y-4">
            {/* Cliente */}
            <input
              value={client}
              onChange={e => setClient(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-black uppercase outline-none focus:border-blue-500 transition-all"
              placeholder="CLIENTE"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
            />

            {/* Foto */}
            <div className="flex gap-2">
              <div className="flex-1 relative bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-center gap-3 active:bg-slate-800 transition-all">
                <Camera size={20} />
                <span className="text-[10px] font-black uppercase">Subir Foto</span>
                <input
                  type="file"
                  onChange={e => {
                    if (e.target.files?.[0]) {
                      const file = e.target.files[0];
                      setImageFile(file);
                      const url = createBlobUrl(file, blobUrlRef.current);
                      blobUrlRef.current = url;
                      setImagePreview(url);
                    }
                  }}
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              {imagePreview && <img src={imagePreview} className="h-14 w-14 rounded-xl object-cover border border-slate-800 shadow-lg" />}
            </div>

            {/* Estado destino */}
            <select
              value={estado}
              onChange={e => setEstado(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-black uppercase outline-none transition-all"
            >
              <option value="">MATERIAL</option>
              <option value="ARMANDOSE">ARMÁNDOSE</option>
              <option value="TERMINADA">TERMINADA</option>
              <option value="PROGRAMADA">ENTREGAS</option>
              <option value="TERMINACIONES">TERMINACIONES</option>
            </select>

            {/* Fecha de entrega */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Fecha de entrega</label>
                {deliveryDate && (
                  <button onClick={() => { setDeliveryDate(""); setDeliveryTime(""); }} className="text-[9px] font-black uppercase text-red-400 active:scale-90 transition-all">
                    QUITAR
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowDatePicker(true)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between px-4 py-3.5 active:bg-slate-800 transition-all"
              >
                {deliveryDate ? (
                  <div className="flex items-center gap-3">
                    <span className="text-white font-black text-sm">
                      {new Date(deliveryDate + 'T12:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <span className="text-slate-400 font-black text-sm">{deliveryTime || '00:00'}</span>
                  </div>
                ) : (
                  <span className="text-slate-600 font-black text-sm uppercase">Seleccionar fecha y hora</span>
                )}
                <ChevronRight size={16} className="text-slate-500" />
              </button>
            </div>

            {/* Checkboxes */}
            <div className="grid grid-cols-3 gap-2">
              {['CASCOS', 'PUERTAS', 'TIRADORES'].map(f => (
                <label key={f} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer active:bg-slate-800 transition-all">
                  <span className="text-[10px] font-black uppercase">{f}</span>
                  <input
                    type="checkbox"
                    checked={f === 'CASCOS' ? cascos : f === 'PUERTAS' ? puertas : tiradores}
                    onChange={e => {
                      const c = e.target.checked;
                      if (f === 'CASCOS') setCascos(c);
                      else if (f === 'PUERTAS') setPuertas(c);
                      else setTiradores(c);
                    }}
                    className="h-4 w-4 accent-blue-500"
                  />
                </label>
              ))}
            </div>

            {/* Rack / Nivel */}
            <div className="grid grid-cols-2 gap-2">
              <input type="number" inputMode="numeric" value={rack} onChange={e => setRack(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="RACK" />
              <input type="number" inputMode="numeric" value={nivel} onChange={e => setNivel(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-black outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="NIVEL" />
            </div>

            {/* ✅ FIX: Campo Notas — antes no existía en el JSX */}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="NOTAS..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-black uppercase text-sm resize-none outline-none focus:border-blue-500 transition-all"
            />

            <button
              onClick={onSave}
              disabled={isUploading}
              className="w-full bg-blue-600 py-5 rounded-2xl text-base font-black uppercase text-white shadow-xl active:scale-95 transition-all"
            >
              {isUploading ? <Loader2 className="animate-spin mx-auto text-white" /> : (editingId ? "ACTUALIZAR" : "GUARDAR")}
            </button>
            {editingId && (
              <button onClick={resetForm} className="w-full bg-slate-800 py-3 rounded-xl font-black uppercase text-[10px] active:scale-95 transition-all text-slate-400">
                CANCELAR EDICIÓN
              </button>
            )}
          </div>
        )}

        {/* Lista de registros */}
        <div className="max-w-xl mx-auto px-5 py-6 space-y-3 pb-40">
          {listLoading ? (
            <div className="text-center py-10">
              <Loader2 className="animate-spin mx-auto text-slate-600" size={24} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-600 font-black uppercase text-xs tracking-widest">
                {search ? 'Sin resultados' : 'Sin registros'}
              </p>
            </div>
          ) : null}
          {!listLoading && filtered.map(r => {
            const urgency = getDeliveryUrgency(r.deliveryDatetime);
            return (
            <div key={r.id} ref={el => { if (el) itemRefs.current.set(r.id, el); else itemRefs.current.delete(r.id); }} className={`bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-start gap-4 shadow-sm ${urgency ? URGENCY_CARD[urgency] : ''}`}>
              {/* Imagen */}
              <div className="shrink-0 mt-1" onClick={() => r.image_url && setFullscreenImg(r.image_url)}>
                {r.image_url
                  ? <img src={r.image_url} className="h-16 w-16 rounded-xl object-cover border border-slate-800 cursor-pointer" />
                  : <div className="h-16 w-16 rounded-xl bg-slate-800 flex items-center justify-center text-white border border-slate-800"><ImageIcon size={20} /></div>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black uppercase truncate text-white leading-tight">{r.client}</h3>
                {r.ubicado && (
                  <p className="text-[10px] text-slate-500 uppercase mt-1 truncate">
                    <MapPin size={10} className="inline mr-1" />{r.ubicado}
                  </p>
                )}
                <div className="flex gap-1.5 mt-2">
                  <span className={getBadgeClass(r.cascos, 'cascos')}>CA</span>
                  <span className={getBadgeClass(r.puertas, 'puertas')}>PT</span>
                  <span className={getBadgeClass(r.tiradores, 'tiradores')}>TR</span>
                </div>
                {urgency && r.deliveryDatetime && (() => {
                  const wd = countWorkingDaysBeforeDelivery(r.deliveryDatetime);
                  const wdLabel = wd < 0 ? 'VENCIDA' : wd === 0 ? 'HOY' : wd === 1 ? '1 DÍA' : `${wd} DÍAS`;
                  return (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest ${URGENCY_BADGE[urgency]}`}>
                        {formatDeliveryDate(r.deliveryDatetime)}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest ${URGENCY_BADGE[urgency]}`}>
                        {wdLabel} <span className="font-bold normal-case tracking-normal">para entrega</span>
                      </span>
                    </div>
                  );
                })()}
                {r.notes && (
                  <p className="text-[10px] text-slate-400 mt-2 flex items-start gap-1 leading-snug">
                    <FileText size={10} className="inline shrink-0 mt-[1px]" />
                    <span className="break-words">{r.notes}</span>
                  </p>
                )}
              </div>

              {/* Acciones admin */}
              {isAdmin && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleEdit(r)}
                    className="p-2 bg-blue-500/10 rounded-lg text-white border border-blue-500/20 active:scale-90 transition-all"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => showConfirm("¿Borrar registro?", `Se eliminará "${r.client}" de forma permanente.`, async () => {
                      await supabase.from('unico_materials').delete().eq('id', r.id);
                      fetchMaterials();
                    })}
                    className="p-2 bg-red-500/10 rounded-lg text-red-500 border border-red-500/20 active:scale-90 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MaterialScreen;