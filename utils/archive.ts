import { supabase } from '../supabase';

// Antes de borrar de verdad un registro (material o pedido), lo copiamos a
// unico_archivo para poder sacar en el futuro un informe de cuántas cocinas
// se han montado, cuánto tardan y qué falló. Solo al desaparecer de aquí
// (unico_archivo + borrado real) queda libre su nombre de cliente para
// volver a usarse — ver utils/duplicateCheck.ts.
export async function archiveAndDelete(
  table: 'unico_materials' | 'unico_orders',
  record: { id: string; payload: any; category: string; created_at: string },
  completada: boolean,
  motivo: string | null
) {
  const { data: userData } = await supabase.auth.getUser();
  const { error: archiveError } = await supabase.from('unico_archivo').insert({
    id: record.id,
    original_table: table,
    category: record.category,
    payload: record.payload,
    completada,
    motivo,
    created_at: record.created_at,
    deleted_by: userData?.user?.email || null,
  });
  if (archiveError) throw archiveError;
  const { error: deleteError } = await supabase.from(table).delete().eq('id', record.id);
  if (deleteError) throw deleteError;
}
