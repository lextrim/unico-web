import { supabase } from '../supabase';

// Terminada/Terminaciones no bloquean el nombre: el cliente puede encargar
// otra cocina distinta más adelante una vez que la suya ya pasó por el taller.
const FINAL_STATES = ['TERMINADA', 'TERMINACIONES'];

const CAT_LABEL: Record<string, string> = {
  ARMANDOSE: 'Armándose',
  TERMINADA: 'Terminada',
  PROGRAMADA: 'Entregas',
  TERMINACIONES: 'Terminaciones',
};

/**
 * Busca si ya existe otro registro (en Materiales o en Pedidos activos) con ese
 * nombre de cliente. Para usar tanto al crear como al editar: pasa el id del
 * propio registro en `excludeId` para que no se compare consigo mismo.
 *
 * Nota: esto es una comprobación "mejor esfuerzo" desde el cliente, no una
 * garantía — dos guardados simultáneos pueden colarse los dos. La solución de
 * verdad es un índice único en la base de datos (ver plan de migración de
 * esquema pendiente).
 */
export async function findDuplicateClientLocation(clientName: string, excludeId?: string): Promise<string | null> {
  const target = clientName.toUpperCase().trim();
  if (!target) return null;

  const { data: materials } = await supabase.from('unico_materials').select('id, payload');
  const dupMat = (materials || []).find((r: any) =>
    r.id !== excludeId && r.payload?.client?.toUpperCase().trim() === target
  );
  if (dupMat) return 'Materiales';

  const { data: orders } = await supabase.from('unico_orders').select('id, payload, category');
  const dupOrd = (orders || []).find((r: any) =>
    r.id !== excludeId &&
    r.payload?.client?.toUpperCase().trim() === target &&
    !FINAL_STATES.includes((r.category || '').toUpperCase())
  );
  if (dupOrd) return CAT_LABEL[(dupOrd.category || '').toUpperCase()] || dupOrd.category;

  return null;
}
