#!/usr/bin/env node
/**
 * Print a locale as a flat `dotted.key=value` list — the format `build-locale.mjs` reads back.
 *
 *   node scripts/export-locale.mjs > ru.txt            # English (the default source)
 *   node scripts/export-locale.mjs de > de.txt         # another locale, e.g. to review it or as a starting point
 *   node scripts/export-locale.mjs th --missing-from en   # only the keys that locale "th" lacks compared with English
 *
 * English plural families appear as `key_one` / `key_other`; give a new language the forms its CLDR rules need
 * (`build-locale.mjs` reports which are missing).
 */
import { PLURAL, baseKey, readLocale } from './i18n-lib.mjs';

const args = process.argv.slice(2);
const code = args[0] && !args[0].startsWith('--') ? args[0] : 'en';
const fromIdx = args.indexOf('--missing-from');
const flat = readLocale(code);
let entries = [...flat];

if (fromIdx >= 0) {
  // keys of the reference locale (default en) that `code` does not have (compared by plural-family base name)
  const reference = readLocale(args[fromIdx + 1] ?? 'en');
  const have = new Set([...flat.keys()].map(baseKey));
  entries = [...reference].filter(([key]) => !have.has(baseKey(key)));
}

process.stdout.write(entries.map(([k, v]) => `${k}=${v}`).join('\n') + (entries.length ? '\n' : ''));
void PLURAL;
