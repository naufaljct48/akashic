/**
 * The issue this edition is. A weekly runs on the calendar, so the masthead
 * and the folio both read the calendar rather than carrying a number somebody
 * typed into a constant.
 */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday decides which year's week this is.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Titles ingested into the catalog. A verified floor, not a rounded guess --
 * the live table holds slightly more and the daily sync only adds.
 *
 * Kept as a number so each locale can group it its own way: Indonesian
 * separates thousands with a period, and a pre-formatted string is
 * necessarily wrong in one of the two languages.
 */
export const TITLES_ON_FILE = 17_900;
