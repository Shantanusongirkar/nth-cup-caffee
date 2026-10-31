const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Midnight (00:00) today in India time, as a real Date. Works on any server timezone. */
export function startOfTodayIST(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}