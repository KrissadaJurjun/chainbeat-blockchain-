/**
 * Locale-aware formatting built on the platform `Intl` APIs (NumberFormat, DateTimeFormat,
 * RelativeTimeFormat, PluralRules). Pure and framework-free so it is trivially testable; the React
 * hook `useFormat` simply memoises one formatter per active locale.
 */

type NumberOptions = Intl.NumberFormatOptions;

export interface Formatter {
  readonly locale: string;
  number(n: number, options?: NumberOptions): string;
  integer(n: number): string;
  decimal(n: number, digits?: number): string;
  compact(n: number, digits?: number): string;
  percent(fraction: number, digits?: number): string;
  signedPercent(fraction: number, digits?: number): string;
  currency(n: number, currency?: string, options?: NumberOptions): string;
  usdCompact(n: number): string;
  /** Token amount with an adaptive number of decimals, e.g. `1,250.5 ATOM`. */
  token(amount: number, symbol: string, maxDigits?: number): string;
  tokenCompact(amount: number, symbol?: string): string;
  unit(n: number, unit: string, display?: 'long' | 'short' | 'narrow', digits?: number): string;
  seconds(n: number, digits?: number): string;
  days(n: number): string;
  dateTime(ts: number, options?: Intl.DateTimeFormatOptions): string;
  date(ts: number, options?: Intl.DateTimeFormatOptions): string;
  time(ts: number, options?: Intl.DateTimeFormatOptions): string;
  relative(ts: number, now?: number): string;
  /** Plural category (`one`, `few`, `other` …) for a count, using `Intl.PluralRules`. */
  plural(n: number): Intl.LDMLPluralRule;
}

const nfCache = new Map<string, Intl.NumberFormat>();
const dfCache = new Map<string, Intl.DateTimeFormat>();

function nf(locale: string, options: NumberOptions = {}): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    nfCache.set(key, f);
  }
  return f;
}

function df(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    dfCache.set(key, f);
  }
  return f;
}

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

/** Languages whose CLDR compact suffixes are long words; finance UIs in them conventionally use K / M / B. */
const LATIN_COMPACT = /^ar(-|$)/;

/**
 * Chinese, Japanese and Korean compact units group by 10 000 (万 / 億 / 억), so the mantissa can have four integer
 * digits — "5462.95万" — which is longer than anything English prints ("54.63M"). Cap those languages at four
 * significant digits ("5463万") so figures still fit a narrow card; every other language is unchanged.
 */
const FOUR_DIGIT_GROUPING = /^(zh|ja|ko)(-|$)/;

function compactOptions(locale: string, digits: number): NumberOptions {
  return FOUR_DIGIT_GROUPING.test(locale)
    ? { notation: 'compact', maximumFractionDigits: digits, maximumSignificantDigits: 4, roundingPriority: 'lessPrecision' }
    : { notation: 'compact', maximumFractionDigits: digits };
}

export function createFormatter(locale: string): Formatter {
  const compactLocale = LATIN_COMPACT.test(locale) ? 'en' : locale;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const plurals = new Intl.PluralRules(locale);

  return {
    locale,
    number: (n, o) => nf(locale, o).format(safe(n)),
    integer: (n) => nf(locale, { maximumFractionDigits: 0 }).format(safe(n)),
    decimal: (n, digits = 2) => nf(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(safe(n)),
    compact: (n, digits = 2) => nf(compactLocale, compactOptions(compactLocale, digits)).format(safe(n)),
    percent: (f, digits = 2) => nf(locale, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(safe(f)),
    signedPercent: (f, digits = 2) =>
      nf(locale, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: 'exceptZero' }).format(safe(f)),
    // `narrowSymbol` prints "$" in every language ("US$" in zh/es/… otherwise) — every price here is USD, so the bare sign is unambiguous and shorter.
    currency: (n, currency = 'USD', o) => nf(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', ...o }).format(safe(n)),
    usdCompact: (n) =>
      Math.abs(n) >= 100_000
        ? nf(compactLocale, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', ...compactOptions(compactLocale, 2) }).format(safe(n))
        : nf(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: n < 1 ? 4 : 2 }).format(safe(n)),
    token: (amount, symbol, maxDigits = 4) => {
      const digits = Math.abs(amount) >= 1000 ? 2 : Math.abs(amount) >= 1 ? Math.min(4, maxDigits) : maxDigits;
      return `${nf(locale, { maximumFractionDigits: digits }).format(safe(amount))} ${symbol}`;
    },
    tokenCompact: (amount, symbol) => `${nf(compactLocale, compactOptions(compactLocale, 2)).format(safe(amount))}${symbol ? ` ${symbol}` : ''}`,
    unit: (n, unit, display = 'short', digits = 2) =>
      nf(locale, { style: 'unit', unit, unitDisplay: display, maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(safe(n)),
    seconds: (n, digits = 2) =>
      nf(locale, { style: 'unit', unit: 'second', unitDisplay: 'narrow', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(safe(n)),
    days: (n) => nf(locale, { style: 'unit', unit: 'day', unitDisplay: 'long', maximumFractionDigits: 0 }).format(safe(n)),
    dateTime: (ts, o) => df(locale, o ?? { dateStyle: 'medium', timeStyle: 'short' }).format(ts),
    date: (ts, o) => df(locale, o ?? { dateStyle: 'medium' }).format(ts),
    time: (ts, o) => df(locale, o ?? { hour: 'numeric', minute: '2-digit' }).format(ts),
    relative: (ts, now = Date.now()) => {
      const diffSec = Math.round((ts - now) / 1000);
      const abs = Math.abs(diffSec);
      if (abs < 5) return rtf.format(0, 'second');
      if (abs < 60) return rtf.format(diffSec, 'second');
      if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
      if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
      return rtf.format(Math.round(diffSec / 86_400), 'day');
    },
    plural: (n) => plurals.select(n),
  };
}
