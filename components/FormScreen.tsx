import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';

const FormScreen: React.FC = () => {
  const { category, id } = useParams<{ category: string; id?: string }>();
  const navigate = useNavigate();
  const draftKey = `draft_unico_${category}_${id || 'new'}`;

  const [formData, setFormData] = useState<any>({
    client: '', notes: '', cascos: false, puertas: false, arrivalDate: '', departureDate: '', category: category?.toUpperCase()
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey);
    if (id) {
      const fetchOrder = async () => {
        const { data } = await supabase.from('unico_orders').select('*').eq('id', id).single();
        if (data) {
          const payload = data.payload || {};
          if (savedDraft) { setFormData(JSON.parse(savedDraft)); }
          else { setFormData({ ...payload, category: data.category }); }
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
      newData[name] = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
      localStorage.setItem(draftKey, JSON.stringify(newData));
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let finalImageUrl = formData.image_url || formData.image || '';
      if (imageFile) {
        const fileName = `${Date.now()}.jpg`;
        await supabase.storage.from('unico_images').upload(fileName, imageFile);
        const { data: { publicUrl } } = supabase.storage.from('unico_images').getPublicUrl(fileName);
        finalImageUrl = publicUrl;
      }

      const finalPayload = { ...formData, image_url: finalImageUrl };
      const targetCategory = formData.category.toUpperCase();
      delete finalPayload.category;

      await supabase.from('unico_orders').update({ payload: finalPayload, category: targetCategory }).eq('id', id);

      localStorage.removeItem(draftKey);
      navigate(`/list/${targetCategory}`);
    } catch (error) { alert("Error al guardar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white w-full">
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)}><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-black uppercase tracking-widest truncate flex-1 text-center">Ficha de Pedido</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-xl mx-auto p-4 space-y-6 mb-20">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-900 p-4 rounded-[2rem] border border-slate-800 flex flex-col items-center justify-center relative min-h-[160px]">
            {imagePreview ? <img src={imagePreview} className="w-full h-48 object-cover rounded-2xl" /> : <ImageIcon size={32} className="text-slate-700" />}
            <input type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) { setImageFile(e.target.files[0]); setImagePreview(URL.createObjectURL(e.target.files[0])); } }} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>

          <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 space-y-5 shadow-xl">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 ml-2">Mover a Estado:</label>
              <select name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold text-sm outline-none focus:border-blue-500 appearance-none">
                <option value="ARMANDOSE">ARMÁNDOSE</option>
                <option value="TERMINADA">TERMINADA</option>
                <option value="PROGRAMADA">ENTREGAS</option>
                <option value="TERMINACIONES">TERMINACIONES</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 ml-2">Cliente</label>
              <input type="text" name="client" value={formData.client || ''} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold text-sm outline-none" />
            </div>

            <div className="flex gap-4">
              {['cascos', 'puertas'].map(f => (
                <label key={f} className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 flex-1 justify-center">
                  <input type="checkbox" name={f} checked={formData[f] || false} onChange={handleInputChange} className="w-5 h-5 accent-blue-600" />
                  <span className="text-[10px] font-black uppercase text-slate-400">{f}</span>
                </label>
              ))}
            </div>

            <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} placeholder="NOTAS..." rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold text-sm resize-none outline-none" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black uppercase py-5 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
            {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />} GUARDAR CAMBIOS
          </button>
        </form>
      </div>
    </div>
  );
};

export default FormScreen;