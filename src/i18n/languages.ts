/**
 * Language registry: the exact list of 60 supported locales lives in `languages.json` (shared with the i18n scripts).
 *
 * A language is OFFERED in the selector only if it has a translation catalog on disk
 * (`src/i18n/locales/<code>/`, see `availableLanguages`), so the UI never advertises translations that do not
 * exist. `npm run i18n:check` fails until every registered locale has a complete catalog.
 *
 * To add or change a language, see docs/I18N.md.
 */
import registry from './languages.json';

export type ScriptId =
  | 'latin'
  | 'thai'
  | 'arabic'
  | 'hebrew'
  | 'devanagari'
  | 'bengali'
  | 'gurmukhi'
  | 'gujarati'
  | 'tamil'
  | 'telugu'
  | 'kannada'
  | 'malayalam'
  | 'sinhala'
  | 'myanmar'
  | 'khmer'
  | 'lao'
  | 'ethiopic'
  | 'cjk-sc'
  | 'cjk-tc'
  | 'cjk-jp'
  | 'cjk-kr';

export interface LanguageMeta {
  /** App language code; also the catalog folder name. */
  code: string;
  /** English name. */
  name: string;
  /** Name in the language itself — shown in the selector. */
  nativeName: string;
  dir: 'ltr' | 'rtl';
  /** BCP-47 tag handed to `Intl.*`. `-u-nu-latn` keeps Latin digits where the locale's default digits are not Latin (clearer for hashes and amounts). */
  intl: string;
  script: ScriptId;
}

export const LANGUAGES: readonly LanguageMeta[] = registry as readonly LanguageMeta[];

/** Locales whose layout runs right-to-left. */
export const RTL_CODES: readonly string[] = LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code);

/** Codes that have a catalog on disk (resolved by Vite at build time: one `common.json` per shipped locale). */
const catalogMarkers = import.meta.glob('./locales/*/common.json');
const shipped = new Set(Object.keys(catalogMarkers).map((p) => p.split('/')[2] as string));

export const availableLanguages: readonly LanguageMeta[] = LANGUAGES.filter((l) => shipped.has(l.code));

/** Metadata (direction, script, `Intl` tag …) for any registered locale; unknown codes get English. */
export function getLanguage(code: string | undefined | null): LanguageMeta {
  return LANGUAGES.find((l) => l.code === code) ?? (LANGUAGES.find((l) => l.code === 'en') as LanguageMeta);
}

/** Legacy / alternative tags → the code this app uses. */
const ALIASES: Record<string, string> = { no: 'nb', nn: 'nb', iw: 'he', tl: 'fil', in: 'id', jw: 'id' };

/** Map any detected tag (`th-TH`, `zh-Hant-HK`, `pt-PT`, `en_US`, `no`, `iw` …) to the closest shipped language. */
export function resolveLanguage(input: string | undefined | null): string {
  if (!input) return 'en';
  const tag = input.replace('_', '-').trim();
  const lower = tag.toLowerCase();
  const exact = availableLanguages.find((l) => l.code.toLowerCase() === lower);
  if (exact) return exact.code;
  if (lower.startsWith('zh')) {
    const traditional = /hant|-tw|-hk|-mo/.test(lower);
    const wanted = traditional ? 'zh-TW' : 'zh-CN';
    if (availableLanguages.some((l) => l.code === wanted)) return wanted;
    const other = traditional ? 'zh-CN' : 'zh-TW';
    if (availableLanguages.some((l) => l.code === other)) return other;
  }
  if (lower.startsWith('pt') && availableLanguages.some((l) => l.code === 'pt-BR')) return 'pt-BR';
  const base = lower.split('-')[0] as string;
  const aliased = ALIASES[base] ?? base;
  return availableLanguages.find((l) => l.code.toLowerCase() === aliased)?.code ?? 'en';
}

/** True for right-to-left locales (Arabic, Hebrew, Persian, Urdu). */
export const isRtl = (code: string | undefined | null): boolean => RTL_CODES.includes(getLanguage(code).code);
