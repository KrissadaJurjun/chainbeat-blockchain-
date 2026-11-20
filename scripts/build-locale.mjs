#!/usr/bin/env node
/**
 * Build a locale (src/i18n/locales/<code>/<namespace>.json) from a flat `key=value` translation list.
 *
 *   node scripts/build-locale.mjs <code> <list.txt>            # complete locale; refuses anything incomplete
 *   node scripts/build-locale.mjs <code> <list.txt> --merge    # add/replace just these keys in an existing locale
 *
 * Why: translators (human or tool) find flat lists far easier to review than nested JSON, and the script guarantees
 * the output has EXACTLY the keys of English (same order, routed to the right namespace file). It refuses unknown
 * keys always, and missing keys unless --merge is given (so a locale can never silently fall behind English).
 *
 * Plural families (`key_one` / `key_other` in English) are expanded to the CLDR categories the target language
 * actually needs, according to `Intl.PluralRules`:
 *   ja, zh, ko, th, vi, id, ms, lo, km, my → other      en, de, nl, sv, hi, bn … → one, other
 *   es, fr, it, pt → one, many, other                     ru, uk, pl, cs, sk, lt → one, few, many, other (+ other)
 *   ar → zero, one, two, few, many, other
 *
 * Format: one `dotted.key=translated text` per line. Blank lines and `#` comments are ignored.
 * Only the first `=` splits key from value, so values may contain `=`.
 */
import { PLURAL, baseKey, pluralCategories, readFlatList, readLocale, registry, writeLocale } from './i18n-lib.mjs';

const [, , code, listPath, ...flags] = process.argv;
const merge = flags.includes('--merge');
if (!code || !listPath) {
  console.error('usage: node scripts/build-locale.mjs <code> <list.txt> [--merge]');
  process.exit(2);
}
if (!registry.some((l) => l.code === code)) {
  console.error(`✖ "${code}" is not one of the ${registry.length} registered locales (src/i18n/languages.json)`);
  process.exit(2);
}

const en = readLocale('en');
const supplied = readFlatList(listPath);
const needed = pluralCategories(code);
const existing = merge ? readLocale(code) : new Map();

const out = new Map();
const missing = [];
const seenFamilies = new Set();
for (const [key] of en) {
  const wanted = PLURAL.test(key)
    ? seenFamilies.has(baseKey(key))
      ? []
      : (seenFamilies.add(baseKey(key)), needed.map((cat) => `${baseKey(key)}_${cat}`))
    : [key];
  for (const full of wanted) {
    if (supplied.has(full)) {
      out.set(full, supplied.get(full));
      supplied.delete(full);
    } else if (existing.has(full)) out.set(full, existing.get(full));
    else missing.push(full);
  }
}

const unknown = [...supplied.keys()];
if (unknown.length || (!merge && missing.length)) {
  console.error(`✖ ${code}: ${missing.length} missing key(s), ${unknown.length} unknown key(s) — nothing written`);
  console.error(`  plural categories required for ${code}: ${needed.join(', ')}`);
  for (const k of missing.slice(0, 30)) console.error(`   missing  ${k}`);
  for (const k of unknown.slice(0, 30)) console.error(`   unknown  ${k}`);
  process.exit(1);
}
writeLocale(code, out);
console.log(`✔ wrote src/i18n/locales/${code}/  (${out.size} entries; plural categories: ${needed.join(', ')})` + (merge && missing.length ? `  — still missing ${missing.length} key(s)` : ''));
