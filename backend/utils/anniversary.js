// Anniversaries are stored as "MM/DD" (no year) - church directories track the
// month/day for celebration purposes, not the actual year. Accepts "M/D" or
// "MM/DD" and always returns zero-padded "MM/DD", or undefined if invalid/empty.
export function normalizeAnniversary(value) {
  if (!value) return undefined;
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return undefined;
  const [, mm, dd] = match;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${mm.padStart(2, '0')}/${dd.padStart(2, '0')}`;
}
