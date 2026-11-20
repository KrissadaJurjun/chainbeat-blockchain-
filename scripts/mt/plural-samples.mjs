// Prints {code: {category: smallest whole number in that CLDR plural category}} for every registered locale.
// run.py turns the English text with "{{count}}" into each category by translating it with that number in place.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const registry = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'i18n', 'languages.json'), 'utf8'));
const candidates = [...Array(201).keys(), 1_000_000];
const out = {};
for (const { code } of registry) {
  const rules = new Intl.PluralRules(code);
  out[code] = Object.fromEntries(
    rules.resolvedOptions().pluralCategories.map((cat) => [cat, candidates.find((n) => (cat === 'zero' ? n >= 0 : n >= 1) && rules.select(n) === cat) ?? null]),
  );
}
console.log(JSON.stringify(out));
