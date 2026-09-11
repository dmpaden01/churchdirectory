// Shared "MM/DD" or "MM/DD/YYYY" normalizer, used for both birthdays and
// anniversaries - the year isn't always known (or, for anniversaries,
// tracked at all) in the source data, so it's optional in both. Accepts
// "M/D" or "M/D/YYYY" (any digit count for month/day) and always returns
// zero-padded "MM/DD"[/YYYY], or undefined if invalid/empty.
export function normalizeMonthDayYear(value) {
  if (!value) return undefined;
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) return undefined;
  const [, mm, dd, yyyy] = match;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const base = `${mm.padStart(2, '0')}/${dd.padStart(2, '0')}`;
  return yyyy ? `${base}/${yyyy}` : base;
}
