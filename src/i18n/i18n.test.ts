import { describe, expect, it } from 'vitest';
import { i18n, loadLanguage, setLanguage } from '.';
import { LANGUAGES, RTL_CODES, availableLanguages, getLanguage, isRtl, resolveLanguage } from './languages';
import namespaceMap from './namespaces.json';

type Tree = { [key: string]: string | Tree };
const files = import.meta.glob<Tree>('./locales/*/*.json', { eager: true, import: 'default' });
/** code → merged catalog of all its namespace files (each file owns distinct top-level groups). */
const catalogs: Record<string, Tree> = {};
const namespaceFiles: Record<string, string[]> = {};
for (const [path, data] of Object.entries(files)) {
  const [, , code, file] = path.split('/') as [string, string, string, string];
  Object.assign((catalogs[code] ??= {}), data);
  (namespaceFiles[code] ??= []).push(file.replace('.json', ''));
}

const PLURAL = /_(zero|one|two|few|many|other)$/;
function flatten(tree: Tree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else flatten(v, key, out);
  }
  return out;
}
const base = (k: string): string => k.replace(PLURAL, '');
const vars = (s: string): string => [...s.matchAll(/\{\{\s*([\w.]+)(?:\s*,[^}]*)?\s*\}\}/g)].map((m) => m[1]).filter((v) => v !== 'count').sort().join('|');

const en = flatten(catalogs.en as Tree);
const enBases = new Set(Object.keys(en).map(base));
const codes = Object.keys(catalogs).filter((c) => c !== 'en');

/** The exact locales the product must support (brief, section 23.1). */
const REQUIRED = [
  'en', 'th', 'ja', 'zh-CN', 'zh-TW', 'ko', 'fr', 'de', 'es', 'pt-BR', 'it', 'nl', 'sv', 'nb', 'da', 'fi', 'pl', 'cs', 'sk', 'hu',
  'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'sr', 'hr', 'bs', 'sl', 'sq', 'mk', 'et', 'lv', 'lt', 'ar', 'he', 'fa', 'ur', 'hi',
  'bn', 'pa', 'gu', 'mr', 'ta', 'te', 'kn', 'ml', 'ne', 'si', 'my', 'km', 'lo', 'vi', 'id', 'ms', 'fil', 'sw', 'am', 'ha',
];

describe('language registry', () => {
  it('registers exactly the 60 required locales, in the required order', () => {
    expect(LANGUAGES).toHaveLength(60);
    expect(LANGUAGES.map((l) => l.code)).toEqual(REQUIRED);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(60);
    expect(LANGUAGES.every((l) => l.name && l.nativeName && l.intl && l.script)).toBe(true);
  });

  it('every registered locale ships a catalog, so the selector offers all 60', () => {
    expect(availableLanguages.map((l) => l.code)).toEqual(REQUIRED);
  });

  it('has no catalog for a locale outside the registry', () => {
    expect(Object.keys(catalogs).filter((c) => !REQUIRED.includes(c))).toEqual([]);
  });

  it('marks exactly Arabic, Hebrew, Persian and Urdu as right-to-left', () => {
    expect([...RTL_CODES].sort()).toEqual(['ar', 'fa', 'he', 'ur']);
    expect(LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code).sort()).toEqual(['ar', 'fa', 'he', 'ur']);
    for (const code of ['ar', 'he', 'fa', 'ur']) expect(isRtl(code)).toBe(true);
    for (const code of ['en', 'th', 'ja', 'hi', 'bn', 'ru']) expect(isRtl(code)).toBe(false);
  });

  it('keeps Latin digits for locales whose default digits would make amounts and hashes hard to read', () => {
    for (const code of ['ar', 'fa', 'ur', 'bn', 'mr', 'ne', 'my']) expect(getLanguage(code).intl, code).toContain('nu-latn');
  });

  it('resolves browser language tags to the closest shipped language', () => {
    expect(resolveLanguage('th-TH')).toBe('th');
    expect(resolveLanguage('ar-EG')).toBe('ar');
    expect(resolveLanguage('en_US')).toBe('en');
    expect(resolveLanguage('zh-Hant-HK')).toBe('zh-TW');
    expect(resolveLanguage('zh')).toBe('zh-CN');
    expect(resolveLanguage('pt-PT')).toBe('pt-BR');
    expect(resolveLanguage('no')).toBe('nb');
    expect(resolveLanguage('nn-NO')).toBe('nb');
    expect(resolveLanguage('iw')).toBe('he');
    expect(resolveLanguage('tl')).toBe('fil');
    expect(resolveLanguage('xx')).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
  });
});

describe('translation catalogs', () => {
  it('are split into the registered namespaces', () => {
    const allowed = new Set(Object.keys(namespaceMap));
    for (const [code, names] of Object.entries(namespaceFiles)) {
      expect(names.filter((n) => !allowed.has(n)), code).toEqual([]);
      expect(names.length, code).toBeGreaterThanOrEqual(10);
    }
  });

  it.each(codes)('%s has exactly the same keys as English', (code) => {
    const tr = flatten(catalogs[code] as Tree);
    const bases = new Set(Object.keys(tr).map(base));
    expect([...enBases].filter((k) => !bases.has(k))).toEqual([]);
    expect([...bases].filter((k) => !enBases.has(k))).toEqual([]);
  });

  it.each(codes)('%s provides every plural form its language needs', (code) => {
    const tr = flatten(catalogs[code] as Tree);
    const needed = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    const families = new Set(Object.keys(en).filter((k) => PLURAL.test(k)).map(base));
    for (const family of families) for (const cat of needed) expect(tr, `${family}_${cat}`).toHaveProperty(`${family}_${cat}`);
  });

  it.each(codes)('%s keeps every {{placeholder}} of the English string', (code) => {
    const tr = flatten(catalogs[code] as Tree);
    const mismatches = Object.entries(tr)
      .map(([k, v]) => {
        const enKey = k in en ? k : Object.keys(en).find((e) => base(e) === base(k));
        return enKey && vars(v) !== vars(en[enKey] as string) ? k : null;
      })
      .filter(Boolean);
    expect(mismatches).toEqual([]);
  });

  it('never leaves a translation empty or marked TODO', () => {
    for (const [code, tree] of Object.entries(catalogs)) {
      // upper-case markers only: "todo" is an ordinary word in Spanish and Portuguese
      const bad = Object.entries(flatten(tree)).filter(([, v]) => v.trim() === '' || /\b(TODO|TRANSLATE_?ME|TBD|FIXME)\b/.test(v));
      expect(bad, code).toEqual([]);
    }
  });

  it.each(codes)('%s is genuinely translated (not English copied across)', (code) => {
    const tr = flatten(catalogs[code] as Tree);
    const comparable = Object.entries(en).filter(([k, v]) => !PLURAL.test(k) && /\p{L}{4,}/u.test(v.replace(/\{\{[^}]*\}\}/g, '')));
    const same = comparable.filter(([k, v]) => tr[k]?.trim() === v.trim()).length;
    expect(same / comparable.length, `${code}: share of strings identical to English`).toBeLessThan(0.35);
  });
});

describe('runtime language switching', () => {
  it('switches text, <html lang/dir>, script and persists the choice', async () => {
    await setLanguage('th');
    expect(i18n.t('navigation.dashboard')).toBe('แดชบอร์ด');
    expect(document.documentElement.lang).toBe('th');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.dataset.script).toBe('thai');
    expect(window.localStorage.getItem('chainbeat.lang')).toBe('th');

    await setLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(i18n.t('notifications.unreadLabel', { count: 2 })).toBe('إشعاران غير مقروءين'); // dual
    expect(i18n.t('notifications.unreadLabel', { count: 7 })).toBe('7 إشعارات غير مقروءة'); // few

    await setLanguage('en');
    expect(i18n.t('notifications.unreadLabel', { count: 1 })).toBe('1 unread notification');
    expect(i18n.t('notifications.unreadLabel', { count: 3 })).toBe('3 unread notifications');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it.each(['ar', 'he', 'fa', 'ur'])('activates right-to-left for %s and returns to left-to-right for English', async (code) => {
    await setLanguage(code);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe(code);
    await setLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('loads every locale on demand and resolves a navigation label in each', async () => {
    for (const { code } of LANGUAGES) {
      await loadLanguage(code);
      const label = i18n.getFixedT(code)('navigation.dashboard');
      expect(label, code).toBeTruthy();
      expect(label, code).not.toBe('navigation.dashboard');
    }
  });

  it('falls back to English for an unknown key instead of showing nothing', () => {
    expect(i18n.t('totally.unknown.key', { defaultValue: 'fallback' })).toBe('fallback');
  });
});
