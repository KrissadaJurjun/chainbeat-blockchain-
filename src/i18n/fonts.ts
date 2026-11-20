import type { ScriptId } from './languages';

/**
 * Script fonts are loaded on demand (one dynamic import per script) instead of shipping every
 * language's font to everyone. Latin, Cyrillic, Greek and Vietnamese (Inter + Manrope) are loaded eagerly in
 * main.tsx. CJK scripts deliberately rely on system fonts — web fonts for them are multi-megabyte.
 * Persian and Urdu share the Arabic-script font (Noto Sans Arabic covers both); Marathi and Nepali share Devanagari.
 * The CSS stacks that reference these families live in `index.css` (`html[data-script=…]`).
 */
const loaders: Partial<Record<ScriptId, () => Promise<unknown>>> = {
  thai: () => import('@fontsource-variable/noto-sans-thai'),
  arabic: () => import('@fontsource-variable/noto-sans-arabic'),
  hebrew: () => import('@fontsource-variable/noto-sans-hebrew'),
  devanagari: () => import('@fontsource-variable/noto-sans-devanagari'),
  bengali: () => import('@fontsource-variable/noto-sans-bengali'),
  gurmukhi: () => import('@fontsource-variable/noto-sans-gurmukhi'),
  gujarati: () => import('@fontsource-variable/noto-sans-gujarati'),
  tamil: () => import('@fontsource-variable/noto-sans-tamil'),
  telugu: () => import('@fontsource-variable/noto-sans-telugu'),
  kannada: () => import('@fontsource-variable/noto-sans-kannada'),
  malayalam: () => import('@fontsource-variable/noto-sans-malayalam'),
  sinhala: () => import('@fontsource-variable/noto-sans-sinhala'),
  myanmar: () => import('@fontsource-variable/noto-sans-myanmar'),
  khmer: () => import('@fontsource-variable/noto-sans-khmer'),
  lao: () => import('@fontsource-variable/noto-sans-lao'),
  ethiopic: () => import('@fontsource-variable/noto-sans-ethiopic'),
};

const loaded = new Set<ScriptId>();

export async function loadScriptFont(script: ScriptId): Promise<void> {
  const load = loaders[script];
  if (!load || loaded.has(script)) return;
  loaded.add(script);
  try {
    await load();
  } catch {
    loaded.delete(script); // offline etc.: the system-font fallback in the CSS stack still renders correctly
  }
}
