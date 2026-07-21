/** Saudi Arabia business-day helpers (Asia/Riyadh, UTC+3, no DST). */

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Current instant as a Date whose UTC fields mirror Riyadh wall-clock. */
export function riyadhNow(base: Date = new Date()): Date {
  return new Date(base.getTime() + RIYADH_OFFSET_MS);
}

/** Start of the current Riyadh calendar day as a real UTC Date. */
export function startOfRiyadhDay(base: Date = new Date()): Date {
  const r = riyadhNow(base);
  const y = r.getUTCFullYear();
  const m = r.getUTCMonth();
  const d = r.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - RIYADH_OFFSET_MS);
}

/** Exclusive end of the current Riyadh calendar day (start of tomorrow). */
export function endOfRiyadhDay(base: Date = new Date()): Date {
  const start = startOfRiyadhDay(base);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function riyadhDayLabel(base: Date = new Date()): string {
  return riyadhNow(base).toISOString().slice(0, 10);
}
