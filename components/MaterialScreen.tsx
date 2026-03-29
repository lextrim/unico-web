import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Trash2, MapPin, Search, Camera, Loader2, Image as ImageIcon, Edit3, X } from "lucide-react";
import { supabase } from "../supabase";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const getBadgeClass = (isActive: boolean) =>
  `w-10 h-6 flex items-center justify-center text-[9px] font-black tracking-tighter rounded-md border transition-all shrink-0 ${
    isActive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-white bg-slate-800/50 border-slate-700"
  } uppercase`;

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1600;
        let width = img.width; let height = img.height;
        if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          else resolve(file);
        }, 'image/jpeg', 0.85);
      };
    };
  });
};

const DRAFT_KEY = "unico_material_draft";

const MaterialScreen: React.FC<{ orders?: any[], isAdmin: boolean }> = ({ orders = [], isAdmin }) => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const listHeaderRef = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const [draftLoaded] = useState(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      return draft ? JSON.parse(draft) : {};
    } catch { return {}; }
  });

  const [client, setClient] = useState(draftLoaded.client || "");
  const [estado, setEstado] = useState(draftLoaded.estado || "");
  const [rack, setRack] = useState(draftLoaded.rack || "");
  const [nivel, setNivel] = useState(draftLoaded.nivel || "");
  const [cascos, setCascos] = useState(draftLoaded.cascos || false);
  const [puertas, setPuertas] = useState(draftLoaded.puertas || false);
  const [tiradores, setTiradores] = useState(draftLoaded.tiradores || false);
  const [notes, setNotes] = useState(draftLoaded.notes || "");
  const [editingId, setEditingId] = useState<string | null>(draftLoaded.editingId || null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchMaterials = async () => {
    const { data } = await supabase.from('unico_materials').select('*').order('created_at', { ascending: false });
    if (data) setRecords(data.map((m: any) => ({ id: m.id, ...m.payload, server_created_at: m.created_at })));
  };

  useEffect(() => { fetchMaterials(); }, []);

  const resetForm = () => {
    setClient(""); setEstado(""); setRack(""); setNivel(""); setCascos(false);
    setPuertas(false); setTiradores(false); setNotes(""); setEditingId(null);
    setImageFile(null); setImagePreview(null); localStorage.removeItem(DRAFT_KEY);
  };

  const onSave = async () => {
    if (!client.trim()) return alert("CLIENTE OBLIGATORIO");
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
      const payload = { client: client.toUpperCase().trim(), cascos, puertas, tiradores, ubicado: `${rack.trim().toUpperCase()} - ${nivel.trim().toUpperCase()}`, notes: notes.toUpperCase().trim(), image_url: finalImageUrl };
      if (estado !== "") {
        await supabase.from('unico_orders').insert({ id: crypto.randomUUID(), payload: { ...payload, status: estado, category: estado }, created_at: nowIso, category: estado });
        if (editingId) await supabase.from('unico_materials').delete().eq('id', editingId);
        resetForm(); navigate(`/list/${estado}`);
      } else {
        const ex = editingId ? records.find(r => r.id === editingId) : null;
        await supabase.from('unico_materials').upsert({ id: editingId || crypto.randomUUID(), payload, created_at: ex ? ex.server_created_at : nowIso });
        resetForm(); fetchMaterials();
      }
    } catch (err) { alert("Error al guardar"); }
    finally { setIsUploading(false); }
  };

  const filtered = useMemo(() => {
    const q = search.toUpperCase().trim();
    return records.filter(r => r.client?.toUpperCase().includes(q) || r.ubicado?.toUpperCase().includes(q));
  }, [records, search]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden relative">
      {fullscreenImg && (
        <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center p-6">
          <button onClick={() => setFullscreenImg(null)} className="absolute top-6 right-6 z-[120] p-3 bg-white/10 rounded-full text-white backdrop-blur-md border border-white/20 active:scale-90 transition-all"><X size={28} /></button>
          <TransformWrapper initialScale={1} centerOnInit={true}><TransformComponent wrapperStyle={{ width: "100vw", height: "100vh" }}><img src={fullscreenImg} className="max-w-full max-h-screen object-contain rounded-xl" /></TransformComponent></TransformWrapper>
        </div>
      )}
      <div className="sticky top-0 z-30 bg-blue-600 shadow-xl"><div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-2"><button onClick={() => navigate("/menu")}><ChevronLeft size={28} /></button><h1 className="text-lg font-black uppercase tracking-widest text-white">Material</h1></div></div>
      <div className="bg-slate-950/95 backdrop-blur-md p-3 border-b border-slate-900 sticky top-[60px] z-20"><div className="max-w-xl mx-auto px-2 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-3 pl-10 rounded-xl text-white font-black uppercase text-xs outline-none" placeholder="BUSCAR CLIENTE..." /></div><button onClick={() => setSearch("")} className="bg-red-900/20 px-4 rounded-xl text-red-500 font-black text-[10px] uppercase">LIMPIAR</button></div></div>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar">
        {isAdmin && (
          <div className="max-w-xl mx-auto px-5 py-6 space-y-4">
             <input value={client} onChange={e => { setClient(e.target.value); }} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-black uppercase outline-none" placeholder="CLIENTE" />
             <div className="flex gap-2"><div className="flex-1 relative bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-center gap-3"><Camera size={20} /><span className="text-[10px] font-black uppercase">Subir Foto</span><input type="file" onChange={e => { if(e.target.files?.[0]) { setImageFile(e.target.files[0]); setImagePreview(URL.createObjectURL(e.target.files[0])); } }} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" /></div>{imagePreview && <img src={imagePreview} className="h-14 w-14 rounded-xl object-cover border border-slate-800" />}</div>
             <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-black uppercase outline-none"><option value="">QUEDARSE EN MATERIAL</option><option value="ARMANDOSE">A ARMÁNDOSE</option><option value="TERMINADA">A TERMINADA</option><option value="PROGRAMADA">A ENTREGAS</option><option value="TERMINACIONES">A TERMINACIONES</option></select>
             <div className="grid grid-cols-3 gap-2">{['CASCOS', 'PUERTAS', 'TIRADORES'].map(f => (<label key={f} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer"><span className="text-[10px] font-black uppercase">{f}</span><input type="checkbox" checked={f==='CASCOS'?cascos:f==='PUERTAS'?puertas:tiradores} onChange={e => { const c = e.target.checked; if(f==='CASCOS') setCascos(c); else if(f==='PUERTAS') setPuertas(c); else setTiradores(c); }} className="h-4 w-4 accent-blue-500" /></label>))}</div>
             <div className="grid grid-cols-2 gap-2"><input value={rack} onChange={e => setRack(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-black uppercase outline-none" placeholder="RACK" /><input value={nivel} onChange={e => setNivel(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-black uppercase outline-none" placeholder="NIVEL" /></div>
             <button onClick={onSave} disabled={isUploading} className="w-full bg-blue-600 py-5 rounded-2xl text-base font-black uppercase text-white shadow-xl active:scale-95 transition-all">{isUploading ? <Loader2 className="animate-spin mx-auto text-white" /> : (editingId ? "ACTUALIZAR" : "GUARDAR")}</button>
             {editingId && <button onClick={resetForm} className="w-full bg-slate-800 py-3 rounded-xl font-black uppercase text-[10px] active:scale-95">CANCELAR EDICIÓN</button>}
          </div>
        )}
        <div ref={listHeaderRef} className="max-w-xl mx-auto px-5 py-6"><div className="space-y-3 pb-40">{filtered.map(r => (<div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-4 shadow-sm"><div className=\"shrink-0\" onClick={() => r.image_url && setFullscreenImg(r.image_url)}>{r.image_url ? <img src={r.image_url} className=\"h-16 w-16 rounded-xl object-cover border border-slate-800 cursor-pointer\" /> : <div className=\"h-16 w-16 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-800\"><ImageIcon size={20}/></div>}</div><div className=\"flex-1 min-w-0\"><h3 className=\"text-sm font-black uppercase truncate text-white\">{r.client}</h3>{r.ubicado && <p className=\"text-[10px] text-slate-500 uppercase mt-1 truncate\"><MapPin size={10} className=\"inline mr-1\" />{r.ubicado}</p>}<div className=\"flex gap-1.5 mt-2\"><span className={getBadgeClass(r.cascos)}>CA</span><span className={getBadgeClass(r.puertas)}>PT</span><span className={getBadgeClass(r.tiradores)}>TR</span></div></div>{isAdmin && (<div className=\"flex flex-col gap-2 shrink-0\"><button onClick={() => { const parts = r.ubicado?.split(' - ') || [\"\",\"\"]; setEditingId(r.id); setClient(r.client); setRack(parts[0]); setNivel(parts[1]); setCascos(r.cascos); setPuertas(r.puertas); setTiradores(r.tiradores); if(scrollContainerRef.current) scrollContainerRef.current.scrollTo({top: 0, behavior: 'smooth'}); }} className=\"p-2 bg-blue-500/10 rounded-lg text-white border border-blue-500/20 active:scale-90\"><Edit3 size={16}/></button><button onClick={async () => { if(window.confirm(\"¿BORRAR?\")) { await supabase.from('unico_materials').delete().eq('id', r.id); fetchMaterials(); } }} className=\"p-2 bg-red-500/10 rounded-lg text-red-500 border border-red-500/20 active:scale-90\"><Trash2 size={16}/></button></div>)}</div>))}</div></div>
      </div>
    </div>
  );
};
export default MaterialScreen;