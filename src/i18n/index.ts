import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import namespaceMap from './namespaces.json';
import { loadScriptFont } from './fonts';
import { availableLanguages, getLanguage, resolveLanguage } from './languages';

export const LANGUAGE_STORAGE_KEY = 'chainbeat.lang';

/** The i18next namespaces (one JSON file per language per namespace). `common` is the default. */
export const NAMESPACES: readonly string[] = Object.keys(namespaceMap);

/** English is always bundled (it is the fallback and the source of truth)… */
const englishFiles = import.meta.glob<Record<string, unknown>>('./locales/en/*.json', { eager: true, import: 'default' });
/** …every other language is fetched on demand: one small chunk per namespace file. */
const lazyFiles = import.meta.glob<Record<string, unknown>>(['./locales/*/*.json', '!./locales/en/*.json'], { import: 'default' });

const namespaceOfPath = (path: string): string => path.split('/')[3]!.replace(/\.json$/, '');

const englishResources: Record<string, Record<string, unknown>> = {};
for (const [path, data] of Object.entries(englishFiles)) englishResources[namespaceOfPath(path)] = data;

const loaded = new Set<string>(['en']);
const loading = new Map<string, Promise<void>>();

/** Fetch every namespace file of a language (cached) and register it. English is always already present. */
export function loadLanguage(code: string): Promise<void> {
  if (loaded.has(code)) return Promise.resolve();
  const pending = loading.get(code);
  if (pending) return pending;
  const files = Object.entries(lazyFiles).filter(([path]) => path.startsWith(`./locales/${code}/`));
  if (files.length === 0) return Promise.resolve();
  const job = Promise.all(files.map(async ([path, load]) => [namespaceOfPath(path), await load()] as const))
    .then((bundles) => {
      for (const [ns, data] of bundles) i18n.addResourceBundle(code, ns, data, true, true);
      loaded.add(code);
    })
    .finally(() => loading.delete(code));
  loading.set(code, job);
  return job;
}

/** Keep <html lang/dir> and the per-script font stack in sync with the active language. */
export function applyDocumentLanguage(code: string): void {
  const meta = getLanguage(code);
  const root = document.documentElement;
  root.lang = meta.code;
  root.dir = meta.dir;
  root.dataset.script = meta.script;
  void loadScriptFont(meta.script);
}

/** Switch language: load its catalog first so the UI never flashes untranslated keys. */
export async function setLanguage(code: string): Promise<void> {
  const resolved = resolveLanguage(code);
  await loadLanguage(resolved);
  await i18n.changeLanguage(resolved);
}

export async function initI18n(): Promise<typeof i18n> {
  if (i18n.isInitialized) return i18n;

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { en: englishResources },
      ns: [...NAMESPACES],
      defaultNS: 'common',
      // keys keep their dotted group name (`wallet.connect`), so a lookup that misses `common` simply tries the others
      fallbackNS: [...NAMESPACES],
      fallbackLng: 'en',
      supportedLngs: availableLanguages.map((l) => l.code),
      load: 'currentOnly',
      partialBundledLanguages: true,
      interpolation: { escapeValue: false }, // React already escapes
      returnEmptyString: false,
      react: { useSuspense: false },
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ['localStorage'],
        convertDetectedLanguage: (lng: string) => resolveLanguage(lng),
      },
    });

  const detected = resolveLanguage(i18n.language);
  await loadLanguage(detected);
  await i18n.changeLanguage(detected);
  applyDocumentLanguage(detected);
  i18n.on('languageChanged', (lng) => applyDocumentLanguage(resolveLanguage(lng)));
  return i18n;
}

export { i18n };
