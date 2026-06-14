// Easter Sunday (Anonymous Gregorian algorithm)
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Lunes de Feria de Sevilla (hardcoded — suele ser ~2 semanas después de Semana Santa)
const FERIA_MONDAY: Record<number, [number, number]> = {
  2024: [4, 22],
  2025: [4, 28],
  2026: [4, 20],
  2027: [5, 3],
  2028: [4, 17],
};

function getHolidaysForYear(year: number): Set<string> {
  const h = new Set<string>();

  // Festivos nacionales fijos
  for (const [m, d] of [
    [1, 1],   // Año Nuevo
    [1, 6],   // Reyes
    [5, 1],   // Día del Trabajo
    [8, 15],  // Asunción
    [10, 12], // Hispanidad
    [11, 1],  // Todos los Santos
    [12, 6],  // Constitución
    [12, 8],  // Inmaculada
    [12, 25], // Navidad
  ] as [number, number][]) {
    h.add(toKey(new Date(year, m - 1, d)));
  }

  // Andalucía
  h.add(toKey(new Date(year, 1, 28))); // 28 Feb

  // Semana Santa (Jueves + Viernes Santo)
  const easter = getEasterSunday(year);
  h.add(toKey(addDays(easter, -3))); // Jueves Santo
  h.add(toKey(addDays(easter, -2))); // Viernes Santo

  // Feria de Sevilla — Lunes de Feria
  if (FERIA_MONDAY[year]) {
    const [m, d] = FERIA_MONDAY[year];
    h.add(toKey(new Date(year, m - 1, d)));
  }

  return h;
}

const holidayCache = new Map<number, Set<string>>();
function getHolidays(year: number): Set<string> {
  if (!holidayCache.has(year)) holidayCache.set(year, getHolidaysForYear(year));
  return holidayCache.get(year)!;
}

/**
 * Cuenta días laborables entre ahora y la fecha de entrega.
 * No cuenta el día actual ni el día de entrega, solo los días intermedios completos.
 * Devuelve número negativo si ya venció.
 */
export function countWorkingDaysUntil(deliveryDatetime: string): number {
  const now = new Date();
  const delivery = new Date(deliveryDatetime);

  if (delivery <= now) return -1;

  // Empezamos desde mañana (día siguiente al actual)
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(delivery);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6 && !getHolidays(cursor.getFullYear()).has(toKey(cursor))) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}
