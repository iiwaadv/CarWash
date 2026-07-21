// Shared helper to enforce the manager-configured shift open/close window
// (e.g. "06:00" - "23:00") stored per branch. Supports windows that span
// midnight (close time earlier than open time).

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return h * 60 + (m ?? 0);
}

export function isWithinShiftWindow(openTime: string, closeTime: string, now: Date = new Date()): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);

  if (open === close) return true; // 24h operation, no restriction
  if (open < close) return nowMinutes >= open && nowMinutes <= close;
  // Window spans midnight, e.g. 22:00 -> 06:00
  return nowMinutes >= open || nowMinutes <= close;
}
