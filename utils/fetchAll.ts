import { supabase } from '../supabase';

const PAGE_SIZE = 1000; // límite por defecto de PostgREST (max_rows)

/**
 * select('*') sin más se corta en 1000 filas sin avisar (límite de PostgREST).
 * Esto pagina con .range() hasta traer la tabla entera.
 */
export async function fetchAllRows(table: string): Promise<any[]> {
  const rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}
