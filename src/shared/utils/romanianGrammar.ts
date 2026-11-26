/**
 * Returns `true` when Romanian grammar requires the preposition `"de"` between
 * a numeral and the following noun (e.g. `20 de ore`, `50 de acțiuni`,
 * `150 de acțiuni`, `100 de puncte`, whereas `19 ore`, `105 probleme` omit it).
 */
export function needsRomanianDe(count: number): boolean {
  const abs = Math.abs(Math.trunc(count));
  if (abs < 20) return false;
  const lastTwo = abs % 100;
  return lastTwo === 0 || lastTwo >= 20;
}

/**
 * Formats an integer count with exact Romanian agreement (`singular`, `plural`,
 * and mandatory `"de"` for numerals >= 20 ending in `00` or `20..99`).
 */
export function formatRoCount(count: number, singular: string, plural: string): string {
  if (count === 1) return `1 ${singular}`;
  return needsRomanianDe(count) ? `${count} de ${plural}` : `${count} ${plural}`;
}
