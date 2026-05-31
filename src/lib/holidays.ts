/**
 * Public holidays for Torremolinos (Spain / Andalucía / Torremolinos)
 * Used to highlight non-working days in the calendar and exclude from stats.
 */

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  scope: "nacional" | "andalucia" | "torremolinos";
}

export const HOLIDAYS_2026: Holiday[] = [
  // España
  { date: "2026-01-01", name: "Año Nuevo",                  scope: "nacional" },
  { date: "2026-01-06", name: "Reyes Magos",                scope: "nacional" },
  { date: "2026-04-03", name: "Viernes Santo",              scope: "nacional" },
  { date: "2026-05-01", name: "Fiesta del Trabajo",         scope: "nacional" },
  { date: "2026-08-15", name: "Asunción de la Virgen",      scope: "nacional" },
  { date: "2026-10-12", name: "Fiesta Nacional de España",  scope: "nacional" },
  { date: "2026-11-02", name: "Traslado Todos los Santos",  scope: "nacional" },
  { date: "2026-12-07", name: "Traslado Constitución",      scope: "nacional" },
  { date: "2026-12-08", name: "Inmaculada Concepción",      scope: "nacional" },
  { date: "2026-12-25", name: "Navidad",                    scope: "nacional" },
  // Andalucía
  { date: "2026-02-28", name: "Día de Andalucía",           scope: "andalucia" },
  { date: "2026-04-02", name: "Jueves Santo",               scope: "andalucia" },
  // Torremolinos
  { date: "2026-07-16", name: "Virgen del Carmen",          scope: "torremolinos" },
  { date: "2026-09-29", name: "San Miguel Arcángel",        scope: "torremolinos" },
];

export const HOLIDAYS_2027: Holiday[] = [
  // España
  { date: "2027-01-01", name: "Año Nuevo",                  scope: "nacional" },
  { date: "2027-01-06", name: "Reyes Magos",                scope: "nacional" },
  { date: "2027-03-26", name: "Viernes Santo",              scope: "nacional" },
  { date: "2027-05-01", name: "Fiesta del Trabajo",         scope: "nacional" },
  { date: "2027-08-16", name: "Traslado Asunción",          scope: "nacional" },
  { date: "2027-10-12", name: "Fiesta Nacional de España",  scope: "nacional" },
  { date: "2027-11-01", name: "Todos los Santos",           scope: "nacional" },
  { date: "2027-12-06", name: "Día de la Constitución",     scope: "nacional" },
  { date: "2027-12-08", name: "Inmaculada Concepción",      scope: "nacional" },
  { date: "2027-12-25", name: "Navidad",                    scope: "nacional" },
  // Andalucía
  { date: "2027-03-01", name: "Traslado Día de Andalucía",  scope: "andalucia" },
  { date: "2027-03-25", name: "Jueves Santo",               scope: "andalucia" },
  // Torremolinos
  { date: "2027-07-16", name: "Virgen del Carmen",          scope: "torremolinos" },
  { date: "2027-09-29", name: "San Miguel Arcángel",        scope: "torremolinos" },
];

export const ALL_HOLIDAYS: Holiday[] = [...HOLIDAYS_2026, ...HOLIDAYS_2027];

/** Returns true if the given date (YYYY-MM-DD) is a public holiday */
export function isHoliday(dateStr: string): boolean {
  return ALL_HOLIDAYS.some((h) => h.date === dateStr);
}

/** Get holiday info for a date, or null if not a holiday */
export function getHoliday(dateStr: string): Holiday | null {
  return ALL_HOLIDAYS.find((h) => h.date === dateStr) ?? null;
}

/** Get all holidays in a date range [start, end] inclusive */
export function getHolidaysInRange(start: Date, end: Date): Holiday[] {
  const startStr = start.toISOString().slice(0, 10);
  const endStr   = end.toISOString().slice(0, 10);
  return ALL_HOLIDAYS.filter((h) => h.date >= startStr && h.date <= endStr);
}
