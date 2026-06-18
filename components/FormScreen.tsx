import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, Image as ImageIcon, Loader2, Clock, AlertTriangle, AlertCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../supabase';
import AppModal from './AppModal';
import DateTimePickerModal from './DateTimePickerModal';
import { compressImage, createBlobUrl } from '../utils/imageUtils';

const NEXT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  ARMANDOSE:    [{ value: 'ARMANDOSE', label: 'ARMÁNDOSE' }, { value: 'TERMINADA', label: 'TERMINADA' }, { value: 'PROGRAMADA', label: 'ENTREGAS' }, { value: 'TERMINACIONES', label: 'TERMINACIONES' }],
  TERMINADA:    [{ value: 'TERMINADA', label: 'TERMINADA' }, { value: 'PROGRAMADA', label: 'ENTREGAS' }, { value: 'TERMINACIONES', label: 'TERMINACIONES' }],
  PROGRAMADA:   [{ value: 'PROGRAMADA', label: 'ENTREGAS' }, { value: 'TERMINACIONES', label: 'TERMINACIONES' }],
  TERMINACIONES:[{ value: 'TERMINACIONES', label: 'TERMINACIONES' }],
};

// ─── FormScreen ────────────────────────────────────────────────────────────────
const FormScreen: React.FC = () => {
  const { category, id } = useParams<{ category: string; id?: string }>();
  const navigate = useNavigate();
  const draftKey = `draft_unico_${category}_${id || 'new'}`;

  const [formData, setFormData] = useState<any>({
    client: '',
    notes: '',
    cascos: false,
    puertas: false,
    tiradores: false,
    deliveryDatetime: '',
    category: category?.toUpperCase()
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showInlineDateModal, setShowInlineDateModal] = useState(false);
  const [modal, setModal] = useState<any>(null);
  const [originalDeliveryDatetime, setOriginalDeliveryDatetime] = useState<string>('');
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  const showAlert = (title: string, message?: string, iconBg = 'bg-orange-600', icon: React.ReactNode = <AlertTriangle size={28} className="text-white" />) =>
    setModal({ title, message, icon, iconBg, onConfirm: () => setModal(null) });

  // Categoría activa (se actualiza al cambiar el select)
  const currentCategory = (formData.category || category || '').toUpperCase();
  const isEntregas = currentCategory === 'PROGRAMADA';
  // ✅ Solo Materiales tiene checkboxes CA/PT/TR
  const showBadgeFields = currentCategory === 'MATERIALES' || category?.toUpperCase() === 'MATERIALES';

  // ✅ Si ya es un registro de ENTREGAS o TERMINACIONES editándose, mostrar campo directo (no modal)
  const isEditingEntregas = !!id && (category?.toUpperCase() === 'PROGRAMADA' || category?.toUpperCase() === 'TERMINACIONES' || category?.toUpperCase() === 'ARMANDOSE');

  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey);
    if (id) {
      const fetchOrder = async () => {
        const { data } = await supabase.from('unico_orders').select('*').eq('id', id).single();
        if (data) {
          const payload = data.payload || {};
          if (savedDraft) {
            setFormData(JSON.parse(savedDraft));
          } else {
            setFormData({
              ...payload,
              category: data.category,
              tiradores: payload.tiradores || false,
              deliveryDatetime: payload.deliveryDatetime || '',
            });
          }
          setOriginalDeliveryDatetime(payload.deliveryDatetime || '');
          if (payload.image_url || payload.image) setImagePreview(payload.image_url || payload.image);
        }
      };
      fetchOrder();
    } else if (savedDraft) {
      setFormData(JSON.parse(savedDraft));
    }
  }, [id, category, draftKey]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => {
      const newData = { ...prev };
      if (type === 'checkbox') {
        newData[name] = (e.target as HTMLInputElement).checked;
      } else if (name === 'client') {
        newData[name] = value.toUpperCase();
      } else {
        newData[name] = value;
      }
      localStorage.setItem(draftKey, JSON.stringify(newData));
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCategory = (formData.category || category || '').toUpperCase();

    const clientUpper = (formData.client || '').toUpperCase().trim();
    if (!clientUpper) { showAlert("Campo obligatorio", "El nombre del cliente es obligatorio"); return; }

    if (!id) {
      // Solo se puede crear desde Material — bloquear creación directa en otras categorías
      if (targetCategory !== 'MATERIALES') {
        showAlert("Acceso restringido", "Los registros solo se pueden crear desde la pantalla de Material.");
        return;
      }
      const FINAL_STATES = ['TERMINADA', 'TERMINACIONES'];
      if (targetCategory === 'MATERIALES') {
        const { data: matDups } = await supabase.from('unico_materials').select('id, payload').limit(500);
        const isDup = (matDups || []).some((r: any) => r.payload?.client?.toUpperCase().trim() === clientUpper);
        if (isDup) { showAlert("Cliente duplicado", `Ya existe un material con el cliente "${clientUpper}"`); return; }
      } else {
        const { data: ordDups } = await supabase.from('unico_orders').select('id, payload, category').limit(500);
        const dupRecord = (ordDups || []).find((r: any) =>
          r.payload?.client?.toUpperCase().trim() === clientUpper &&
          !FINAL_STATES.includes((r.category || '').toUpperCase())
        );
        if (dupRecord) {
          const CAT_LABEL: Record<string, string> = { ARMANDOSE: 'Armándose', TERMINADA: 'Terminada', PROGRAMADA: 'Entregas', TERMINACIONES: 'Terminaciones', MATERIALES: 'Materiales' };
          const donde = CAT_LABEL[(dupRecord.category || '').toUpperCase()] || dupRecord.category;
          showAlert("Cliente duplicado", `"${clientUpper}" ya existe en ${donde}`);
          return;
        }
      }
    }

    if (targetCategory === 'PROGRAMADA' && !isEditingEntregas) {
      setShowDeliveryModal(true);
      return;
    }
    await doSave(formData.deliveryDatetime || null);
  };

  const handleDeliveryConfirm = async (date: string, time: string) => {
    setShowDeliveryModal(false);
    await doSave(`${date}T${time}`);
  };

  const doSave = async (deliveryDatetime: string | null) => {
    setLoading(true);
    try {
      let finalImageUrl = formData.image_url || formData.image || '';
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const fileName = `${Date.now()}.jpg`;
        await supabase.storage.from('unico_images').upload(fileName, compressed);
        const { data: { publicUrl } } = supabase.storage.from('unico_images').getPublicUrl(fileName);
        finalImageUrl = publicUrl;
      }

      const newDeliveryDatetime = deliveryDatetime || formData.deliveryDatetime || '';
      const existingHistory: { date: string; changedAt: string }[] = formData.deliveryDateHistory || [];
      const updatedHistory =
        id && originalDeliveryDatetime && originalDeliveryDatetime !== newDeliveryDatetime
          ? [...existingHistory, { date: originalDeliveryDatetime, changedAt: new Date().toISOString() }]
          : existingHistory;

      const finalPayload = {
        ...formData,
        image_url: finalImageUrl,
        deliveryDatetime: newDeliveryDatetime,
        deliveryDateHistory: updatedHistory,
      };
      const targetCategory = (formData.category || category || '').toUpperCase();
      delete finalPayload.category;

      if (id) {
        const { error } = await supabase
          .from('unico_orders')
          .update({ payload: finalPayload, category: targetCategory })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('unico_orders')
          .insert({
            id: crypto.randomUUID(),
            payload: finalPayload,
            category: targetCategory,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
      }

      localStorage.removeItem(draftKey);
      setSaved(true);
      setTimeout(() => navigate(`/list/${targetCategory}`), 600);
    } catch (error: any) {
      showAlert("Error al guardar", error?.message || "Ha ocurrido un error. Inténtalo de nuevo.", 'bg-red-600', <AlertCircle size={28} className="text-white" />);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white w-full">

      {modal && <AppModal {...modal} />}
      {showDeliveryModal && (
        <DateTimePickerModal
          onConfirm={handleDeliveryConfirm}
          onCancel={() => setShowDeliveryModal(false)}
        />
      )}
      {showInlineDateModal && (
        <DateTimePickerModal
          initialDate={formData.deliveryDatetime ? formData.deliveryDatetime.split('T')[0] : undefined}
          initialTime={formData.deliveryDatetime ? formData.deliveryDatetime.split('T')[1]?.substring(0, 5) : undefined}
          onConfirm={(date, time) => {
            setFormData((p: any) => {
              const updated = { ...p, deliveryDatetime: `${date}T${time}` };
              localStorage.setItem(draftKey, JSON.stringify(updated));
              return updated;
            });
            setShowInlineDateModal(false);
          }}
          onCancel={() => setShowInlineDateModal(false)}
        />
      )}

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2"><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-black uppercase tracking-widest truncate text-center">
            {id ? 'Editar Pedido' : `Nuevo · ${category}`}
          </h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-xl mx-auto p-4 space-y-6 mb-20">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Imagen */}
          <div className="bg-slate-900 p-4 rounded-[2rem] border border-slate-800 flex flex-col items-center justify-center relative min-h-[160px]">
            {imagePreview
              ? <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" />
              : <ImageIcon size={32} className="text-slate-500" />
            }
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  const file = e.target.files[0];
                  setImageFile(file);
                  const url = createBlobUrl(file, blobUrlRef.current);
                  blobUrlRef.current = url;
                  setImagePreview(url);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          {/* Campos */}
          <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 space-y-5 shadow-xl">

            {/* Estado */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 ml-2">Mover a Estado:</label>
              <div className="relative">
                <select
                  name="category"
                  value={formData.category || ''}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 pr-10 text-white font-bold text-sm outline-none appearance-none focus:border-blue-500 transition-all"
                >
                  {(NEXT_OPTIONS[category?.toUpperCase() || ''] || []).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Cliente */}
            <input
              type="text"
              name="client"
              value={formData.client || ''}
              onChange={handleInputChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold text-sm outline-none"
              style={{ textTransform: 'uppercase' }}
              placeholder="CLIENTE"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
            />

            {/* ✅ Checkboxes SOLO si la categoría es MATERIALES */}
            {showBadgeFields && (
              <div className="flex gap-3">
                {['cascos', 'puertas', 'tiradores'].map(f => (
                  <label key={f} className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 flex-1 justify-center">
                    <input
                      type="checkbox"
                      name={f}
                      checked={formData[f] || false}
                      onChange={handleInputChange}
                      className="w-5 h-5 accent-blue-600"
                    />
                    <span className="text-[10px] font-black uppercase text-slate-400">{f}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Notas */}
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleInputChange}
              placeholder="NOTAS..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold text-sm resize-none outline-none"
            />

            {/* Campo fecha/hora — abre modal personalizado */}
            {isEditingEntregas && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase text-slate-500 ml-2 flex items-center gap-2">
                  <Clock size={12} className="text-indigo-400" />
                  Fecha y hora de entrega
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineDateModal(true)}
                  className="w-full bg-slate-950 border border-indigo-500/30 rounded-2xl p-4 text-left font-bold text-sm outline-none active:border-indigo-500 transition-all"
                >
                  {formData.deliveryDatetime
                    ? <span className="text-white">{new Date(formData.deliveryDatetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    : <span className="text-slate-500">Toca para seleccionar fecha...</span>
                  }
                </button>
                {formData.deliveryDatetime && (
                  <button
                    type="button"
                    onClick={() => setFormData((p: any) => ({ ...p, deliveryDatetime: '' }))}
                    className="text-slate-500 text-[10px] font-black uppercase ml-2 active:scale-90 transition-all"
                  >
                    Quitar fecha
                  </button>
                )}
                {(formData.deliveryDateHistory?.length > 0) && (
                  <div className="mt-3 bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Historial de fechas anteriores</p>
                    {[...(formData.deliveryDateHistory as { date: string; changedAt: string }[])].reverse().map((entry, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-300 font-bold">
                          {new Date(entry.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-slate-600">
                          cambiada {new Date(entry.changedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botón guardar */}
          <button
            type="submit"
            disabled={loading || saved}
            className={`w-full text-white font-black uppercase py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl ${saved ? 'bg-emerald-600' : 'bg-blue-600'}`}
          >
            {saved ? '✓ GUARDADO' : loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            {!saved && (id ? 'GUARDAR CAMBIOS' : 'CREAR REGISTRO')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FormScreen;