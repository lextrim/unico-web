import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, Image as ImageIcon, Loader2, Clock, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import AppModal from './AppModal';
import Select from './Select';
import DateTimePickerModal from './DateTimePickerModal';
import { compressImage, createBlobUrl } from '../utils/imageUtils';
import { toTitleCase } from '../utils/text';
import { findDuplicateClientLocation } from '../utils/duplicateCheck';

// Un borrador más viejo que esto se descarta: evita que una edición abandonada
// hace semanas resucite y pise datos buenos al reabrir la pantalla.
const DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 horas

function saveDraft(key: string, data: any) {
  try { localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() })); } catch {}
}

function loadFreshDraft(key: string): any | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'savedAt' in parsed) {
      if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    }
    // Formato antiguo sin savedAt (de antes de este cambio): se descarta por seguridad.
    localStorage.removeItem(key);
    return null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

const NEXT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  ARMANDOSE:    [{ value: 'ARMANDOSE', label: 'Armándose' }, { value: 'TERMINADA', label: 'Terminada' }, { value: 'PROGRAMADA', label: 'Entregas' }, { value: 'TERMINACIONES', label: 'Terminaciones' }],
  TERMINADA:    [{ value: 'TERMINADA', label: 'Terminada' }, { value: 'PROGRAMADA', label: 'Entregas' }, { value: 'TERMINACIONES', label: 'Terminaciones' }],
  PROGRAMADA:   [{ value: 'PROGRAMADA', label: 'Entregas' }, { value: 'TERMINACIONES', label: 'Terminaciones' }],
  TERMINACIONES:[{ value: 'TERMINACIONES', label: 'Terminaciones' }],
};
const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(NEXT_OPTIONS).flat().map(o => [o.value, o.label])
);

// ─── FormScreen ────────────────────────────────────────────────────────────────
const FormScreen: React.FC<{ onSave?: (id: string, updated: any) => void }> = ({ onSave }) => {
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
  const isEditingEntregas = !!id && (category?.toUpperCase() === 'PROGRAMADA' || category?.toUpperCase() === 'TERMINACIONES' || category?.toUpperCase() === 'ARMANDOSE' || category?.toUpperCase() === 'TERMINADA');

  useEffect(() => {
    const savedDraft = loadFreshDraft(draftKey);
    if (id) {
      const fetchOrder = async () => {
        const { data } = await supabase.from('unico_orders').select('*').eq('id', id).single();
        if (data) {
          const payload = data.payload || {};
          if (savedDraft) {
            setFormData(savedDraft);
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
      setFormData(savedDraft);
    }
  }, [id, category, draftKey]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => {
      const newData = { ...prev };
      if (type === 'checkbox') {
        newData[name] = (e.target as HTMLInputElement).checked;
      } else {
        newData[name] = value;
      }
      saveDraft(draftKey, newData);
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCategory = (formData.category || category || '').toUpperCase();

    const clientUpper = (formData.client || '').toUpperCase().trim();
    if (!clientUpper) { showAlert("Campo obligatorio", "El nombre del cliente es obligatorio"); return; }

    if (!id && targetCategory !== 'MATERIALES') {
      // Solo se puede crear desde Material — bloquear creación directa en otras categorías
      showAlert("Acceso restringido", "Los registros solo se pueden crear desde la pantalla de Material.");
      return;
    }

    const dupLocation = await findDuplicateClientLocation(formData.client || '', id || undefined);
    if (dupLocation) {
      showAlert("Cliente duplicado", `"${clientUpper}" ya existe en ${dupLocation}`);
      return;
    }

    if (targetCategory === 'PROGRAMADA' && !formData.deliveryDatetime) {
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
        const fileName = `${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('unico_images').upload(fileName, compressed);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('unico_images').getPublicUrl(fileName);
        finalImageUrl = publicUrl;
      }

      const newDeliveryDatetime = deliveryDatetime || formData.deliveryDatetime || '';
      const existingHistory: { date: string; changedAt: string }[] = formData.deliveryDateHistory || [];
      const updatedHistory =
        id && originalDeliveryDatetime && originalDeliveryDatetime !== newDeliveryDatetime
          ? [...existingHistory, { date: originalDeliveryDatetime, changedAt: new Date().toISOString() }]
          : existingHistory;

      const targetCategory = (formData.category || category || '').toUpperCase();
      const STAGE_FIELD: Record<string, string> = {
        ARMANDOSE: 'armandoseAt', TERMINADA: 'terminadaAt', PROGRAMADA: 'programadaFirstAt', TERMINACIONES: 'terminacionesAt'
      };
      const stageField = STAGE_FIELD[targetCategory];
      const stageStamp = stageField && !formData[stageField] ? { [stageField]: Date.now() } : {};
      const programadaExtra = targetCategory === 'PROGRAMADA' ? { everProgramada: true, programadaLastAt: Date.now() } : {};

      const finalPayload = {
        ...formData,
        client: toTitleCase((formData.client || '').trim()),
        image_url: finalImageUrl,
        deliveryDatetime: newDeliveryDatetime,
        deliveryDateHistory: updatedHistory,
        ...stageStamp,
        ...programadaExtra,
      };
      delete finalPayload.category;

      if (id) {
        const { error } = await supabase
          .from('unico_orders')
          .update({ payload: finalPayload, category: targetCategory })
          .eq('id', id);
        if (error) throw error;
        onSave?.(id, { id, ...finalPayload, category: targetCategory });
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
      // Vuelve a la lista de origen (donde estabas), no a la de destino -- si
      // vas pasando varios pedidos de Armándose a Terminada uno a uno, te deja
      // seguir en la misma lista en vez de mandarte a la categoría nueva cada vez.
      // replace: true para que el formulario ya guardado no se quede en el
      // historial -- si no, el gesto de "atrás" del móvil volvía a abrirlo.
      const originalCategory = (category || '').toUpperCase();
      const goBack = () => navigate(`/list/${originalCategory || targetCategory}`, { replace: true });
      if (id && targetCategory !== originalCategory) {
        setModal({
          title: `Movido a ${STAGE_LABEL[targetCategory] || targetCategory}`,
          icon: <CheckCircle2 size={28} className="text-white" />,
          iconBg: 'bg-emerald-600',
          onConfirm: () => { setModal(null); goBack(); },
        });
      } else {
        setTimeout(goBack, 100);
      }
    } catch (error: any) {
      showAlert("Error al guardar", error?.message || "Ha ocurrido un error. Inténtalo de nuevo.", 'bg-red-600', <AlertCircle size={28} className="text-white" />);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white w-full normal-case">

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
              saveDraft(draftKey, updated);
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
          <h1 className="text-lg font-semibold truncate text-center text-slate-100">
            {id ? 'Editar pedido' : `Nuevo · ${category}`}
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
              <label className="block text-[12px] font-medium text-slate-500 mb-2 ml-2">Mover a estado</label>
              <Select
                value={formData.category || ''}
                onChange={(v) => setFormData((p: any) => {
                  const updated = { ...p, category: v };
                  saveDraft(draftKey, updated);
                  return updated;
                })}
                options={NEXT_OPTIONS[category?.toUpperCase() || ''] || []}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-200 font-medium text-sm outline-none focus:border-blue-500 transition-all flex items-center justify-between"
              />
            </div>

            {/* Cliente */}
            <input
              type="text"
              name="client"
              value={formData.client || ''}
              onChange={handleInputChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-medium text-sm outline-none"
              placeholder="Cliente"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="words"
            />

            {/* ✅ Checkboxes SOLO si la categoría es MATERIALES */}
            {showBadgeFields && (
              <div className="flex gap-2">
                {[{ key: 'cascos', label: 'Cascos' }, { key: 'puertas', label: 'Puertas' }, { key: 'tiradores', label: 'Tiradores' }].map(f => (
                  <button
                    type="button"
                    key={f.key}
                    onClick={() => setFormData((p: any) => {
                      const updated = { ...p, [f.key]: !p[f.key] };
                      saveDraft(draftKey, updated);
                      return updated;
                    })}
                    className={`flex-1 rounded-xl p-3 text-center font-medium text-[12.5px] border transition-all active:scale-95 ${
                      formData[f.key] ? 'bg-blue-600/15 border-blue-500/40 text-blue-300' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* Notas */}
            <textarea
              name="notes"
              value={formData.notes || ''}
              onChange={handleInputChange}
              placeholder="Notas…"
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-medium text-sm resize-none outline-none"
            />

            {/* Campo fecha/hora — abre modal personalizado */}
            {isEditingEntregas && (
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-slate-500 ml-2 flex items-center gap-2">
                  <Clock size={12} className="text-indigo-400" />
                  Fecha y hora de entrega
                </label>
                <button
                  type="button"
                  onClick={() => setShowInlineDateModal(true)}
                  className="w-full bg-slate-950 border border-indigo-500/30 rounded-2xl p-4 text-left font-medium text-sm outline-none active:border-indigo-500 transition-all"
                >
                  {formData.deliveryDatetime
                    ? <span className="text-white">{new Date(formData.deliveryDatetime).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    : <span className="text-slate-500">Toca para seleccionar fecha…</span>
                  }
                </button>
                {formData.deliveryDatetime && (
                  <button
                    type="button"
                    onClick={() => setFormData((p: any) => ({ ...p, deliveryDatetime: '' }))}
                    className="text-slate-500 text-[12px] font-medium ml-2 active:scale-90 transition-all"
                  >
                    Quitar fecha
                  </button>
                )}
                {(formData.deliveryDateHistory?.length > 0) && (
                  <div className="mt-3 bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-1">
                    <p className="text-[12px] font-medium text-slate-500 mb-2">Historial de fechas anteriores</p>
                    {[...(formData.deliveryDateHistory as { date: string; changedAt: string }[])].reverse().map((entry, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-300 font-medium">
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
            className={`w-full text-white font-semibold py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl ${saved ? 'bg-emerald-600' : 'bg-blue-600'}`}
          >
            {saved ? '✓ Guardado' : loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            {!saved && (id ? 'Guardar cambios' : 'Crear registro')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FormScreen;