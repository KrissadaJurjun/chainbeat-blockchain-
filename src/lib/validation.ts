/**
 * Parse a user-typed decimal. Accepts "1,234.56", "1234,56" (decimal comma) and "1 234.56".
 * Returns NaN for anything that is not a plain number (so validation can reject it).
 */
export function parseAmount(raw: string): number {
  const compact = raw.trim().replace(/\s/g, '');
  if (compact === '') return NaN;
  const normalised = compact.includes(',') && !compact.includes('.') ? compact.replace(',', '.') : compact.replace(/,/g, '');
  return /^\d*\.?\d+$|^\d+\.$/.test(normalised) ? Number(normalised) : NaN;
}

/** Round DOWN to `digits` decimals — never display or spend more than the user holds. */
export function floorTo(value: number, digits = 6): number {
  const p = 10 ** digits;
  return Math.floor((value + Number.EPSILON) * p) / p;
}

/** Number of decimal places in a user-typed amount ("1.2500" → 4). Uses the same separator rules as `parseAmount`. */
export function countDecimals(raw: string): number {
  const compact = raw.trim().replace(/\s/g, '');
  const normalised = compact.includes(',') && !compact.includes('.') ? compact.replace(',', '.') : compact.replace(/,/g, '');
  const dot = normalised.indexOf('.');
  return dot < 0 ? 0 : normalised.length - dot - 1;
}
