#!/usr/bin/env node
/**
 * Remove keys from English AND from every other locale that has them (plural families are removed together).
 *
 *   node scripts/i18n-remove.mjs swap.submit stake.submit         # base keys; "key_one"/"key_other" are matched too
 *   node scripts/i18n-remove.mjs --list unused.txt                # one key per line
 *
 * Use it when a string is no longer referenced by the source (`npm run i18n:check -- --unused` lists candidates),
 * so translators never spend time on dead text.
 */
import { readFileSync } from 'node:fs';
import { baseKey, localeCodes, readLocale, writeLocale } from './i18n-lib.mjs';

const args = process.argv.slice(2);
const keys = new Set(
  args[0] === '--list' ? readFileSync(args[1], 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : args.filter((a) => !a.startsWith('--')),
);
if (keys.size === 0) {
  console.error('usage: node scripts/i18n-remove.mjs <key…> | --list <file>');
  process.exit(2);
}
let total = 0;
for (const code of localeCodes()) {
  const flat = readLocale(code);
  const kept = new Map([...flat].filter(([k]) => !keys.has(baseKey(k)) && !keys.has(k)));
  const removed = flat.size - kept.size;
  if (removed > 0) writeLocale(code, kept);
  total += removed;
}
console.log(`✔ removed ${keys.size} key(s) (${total} entries across all locales)`);
