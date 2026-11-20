#!/usr/bin/env node
/**
 * Add (or change) ENGLISH source strings from a flat list; the keys are routed to the right namespace file.
 *
 *   node scripts/i18n-add.mjs new-keys.txt            # adds new keys, refuses to change existing ones
 *   node scripts/i18n-add.mjs new-keys.txt --overwrite  # also replaces the text of keys that already exist
 *
 * Every other locale then reports the new keys as missing (`npm run i18n:check`) until they are translated:
 *   node scripts/export-locale.mjs th --missing-from en > th-new.txt   → translate → build-locale.mjs th th-new.txt --merge
 *
 * Plural families must be given as `key_one` and `key_other`. A key whose first segment ("group") is not listed in
 * src/i18n/namespaces.json is rejected — add the group there first.
 */
import { readFlatList, readLocale, writeLocale } from './i18n-lib.mjs';

const [, , listPath, ...flags] = process.argv;
if (!listPath) {
  console.error('usage: node scripts/i18n-add.mjs <list.txt> [--overwrite]');
  process.exit(2);
}
const overwrite = flags.includes('--overwrite');
const en = readLocale('en');
const incoming = readFlatList(listPath);
let added = 0;
let changed = 0;
const refused = [];
for (const [key, value] of incoming) {
  if (en.has(key)) {
    if (!overwrite && en.get(key) !== value) refused.push(key);
    else if (en.get(key) !== value) {
      en.set(key, value);
      changed++;
    }
  } else {
    en.set(key, value);
    added++;
  }
}
if (refused.length) {
  console.error(`✖ ${refused.length} key(s) already exist with different text (use --overwrite to replace): ${refused.slice(0, 10).join(', ')}`);
  process.exit(1);
}
writeLocale('en', en);
console.log(`✔ English catalog updated: ${added} added, ${changed} changed (${en.size} entries)`);
