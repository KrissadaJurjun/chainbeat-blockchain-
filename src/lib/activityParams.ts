import type { Formatter } from '@/lib/format';

/** Params whose key ends in `Amt` are numbers formatted for the active locale at render time (`amountAmt` → `amount`). */
export function localiseParams(params: Record<string, string | number>, fmt: Formatter): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.endsWith('Amt') && typeof value === 'number') out[key.slice(0, -3)] = fmt.number(value, { maximumFractionDigits: 6 });
    else out[key] = value;
  }
  return out;
}
