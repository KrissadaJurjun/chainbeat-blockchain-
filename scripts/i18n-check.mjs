#!/usr/bin/env node
/**
 * i18n consistency checker  (npm run i18n:check)
 *
 *  0. the language registry is EXACTLY the 60 required locales (src/i18n/languages.json), and no locale folder is
 *     outside it (unsupported codes)
 *  1. every key used in source (`t('a.b')`, `labelKey: 'a.b'`, `messageKey: 'a.b'`) exists in the English catalog
 *  2. every registered locale exists and has exactly the keys of English (plural families compared by base name)
 *  3. plural families contain every CLDR category the language needs (Intl.PluralRules)
 *  4. {{placeholders}} in each translation match English
 *  5. no empty strings, no TODO / TRANSLATE_ME / TBD markers, and no locale that is mostly English copied over
 *
 * Exit code 1 when anything is missing/extra/mismatched. Dynamic keys (template literals) are listed as
 * informational — they are validated by their enumerations in the unit tests.
 *
 *   --verbose        list the offending keys        --print-missing   list keys used in source but not in English
 *   --unused         also list English keys that nothing in the source references (informational; never fails)
 *   --allow-partial  tolerate registered locales that have no catalog yet (progress runs only — never in CI)
 *   --only=th,ar     check just these locales
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { PLURAL, baseKey, localeCodes, placeholders, pluralCategories, readLocale, registry, root } from './i18n-lib.mjs';

/** The exact set (and order) of locales the product must ship — see the brief, section 23.1. */
const REQUIRED = [
  'en', 'th', 'ja', 'zh-CN', 'zh-TW', 'ko', 'fr', 'de', 'es', 'pt-BR', 'it', 'nl', 'sv', 'nb', 'da', 'fi', 'pl', 'cs', 'sk', 'hu',
  'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'sr', 'hr', 'bs', 'sl', 'sq', 'mk', 'et', 'lv', 'lt', 'ar', 'he', 'fa', 'ur', 'hi',
  'bn', 'pa', 'gu', 'mr', 'ta', 'te', 'kn', 'ml', 'ne', 'si', 'my', 'km', 'lo', 'vi', 'id', 'ms', 'fil', 'sw', 'am', 'ha',
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const verbose = flag('--verbose');
const allowPartial = flag('--allow-partial');
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const srcDir = join(root, 'src');
const problems = [];

/* 0 — the registry is exactly the required list */
const registered = registry.map((l) => l.code);
if (registered.length !== REQUIRED.length || registered.some((c, i) => c !== REQUIRED[i])) {
  problems.push(`language registry must be exactly the ${REQUIRED.length} required locales in order (found ${registered.length})`);
}
const onDisk = localeCodes();
for (const code of onDisk) if (!registered.includes(code)) problems.push(`locale folder "${code}" is not a supported locale code`);

const en = readLocale('en');
const enBases = new Set([...en.keys()].map(baseKey));

/* 1 — keys used in source */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'locales' || name === 'node_modules') continue;
      yield* walk(p);
    } else if (['.ts', '.tsx'].includes(extname(p)) && !/\.test\.tsx?$/.test(p)) yield p;
  }
}
const used = new Map();
const staticRe = /(?:\bt|i18n\.t)\(\s*(['"])([A-Za-z0-9_.-]+)\1/g;
const propRe = /\b(?:labelKey|messageKey|titleKey|descKey|hintKey)\s*:\s*(['"])([A-Za-z0-9_.-]+)\1/g;
const dynamicRe = /(?:\bt|i18n\.t)\(\s*`[^`]*\$\{/g;
let infoDynamic = 0;
for (const file of walk(srcDir)) {
  const text = readFileSync(file, 'utf8');
  for (const re of [staticRe, propRe]) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) if (!used.has(m[2])) used.set(m[2], file.replace(root, '').replaceAll('\\', '/'));
  }
  infoDynamic += [...text.matchAll(dynamicRe)].length;
}
// `t('dev.ranges.' + range)` is matched up to the concatenation: a key ending in "." is a dynamic PREFIX, so it is
// valid when the English catalog has at least one key beneath it (the exact values are enumerated in unit tests).
const isPrefix = (k) => k.endsWith('.');
const missingUsed = [...used.entries()].filter(([k]) => (isPrefix(k) ? ![...enBases].some((b) => b.startsWith(k)) : !enBases.has(k) && !en.has(k)));
if (missingUsed.length) {
  problems.push(`${missingUsed.length} key(s) used in source but missing from the English catalog`);
  if (verbose || flag('--print-missing')) for (const [k, f] of missingUsed) console.error(`   missing  ${k}   (${f})`);
}

/* informational — English keys nothing references (remove them with scripts/i18n-remove.mjs) */
if (flag('--unused')) {
  const literals = new Set();
  const prefixes = [];
  for (const file of walk(srcDir)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/['"`]([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)['"`]/g)) literals.add(m[1]);
    for (const m of text.matchAll(/['"`]([A-Za-z0-9_.-]+\.)(?:['"`]\s*\+|\$\{)/g)) prefixes.push(m[1]);
  }
  const unusedKeys = [...enBases].filter((k) => !literals.has(k) && !prefixes.some((p) => k.startsWith(p)));
  console.log(unusedKeys.length ? `${unusedKeys.length} English key(s) are not referenced by the source:\n  ${unusedKeys.join('\n  ')}\n` : 'no unused English keys\n');
}

/* 2–5 — every locale against English */
const summary = [];
let translatedCount = 0;
const MARKER = /\b(TODO|TRANSLATE_?ME|TBD|FIXME|LOREM)\b/; // upper-case only: "todo" is an ordinary word in Spanish and Portuguese
for (const { code } of registry) {
  if (code === 'en' || (only.length && !only.includes(code))) continue;
  if (!onDisk.includes(code)) {
    summary.push({ code, state: 'no catalog yet' });
    if (!allowPartial) problems.push(`${code}: no catalog (src/i18n/locales/${code}/ is missing)`);
    continue;
  }
  translatedCount++;
  const tr = readLocale(code);
  const trBases = new Set([...tr.keys()].map(baseKey));
  const missing = [...enBases].filter((k) => !trBases.has(k));
  const extra = [...trBases].filter((k) => !enBases.has(k));

  const cats = pluralCategories(code);
  const families = new Map();
  for (const k of tr.keys()) if (PLURAL.test(k)) (families.get(baseKey(k)) ?? families.set(baseKey(k), new Set()).get(baseKey(k))).add(k.match(PLURAL)[1]);
  const pluralGaps = [];
  for (const [base, have] of families) for (const c of cats) if (!have.has(c)) pluralGaps.push(`${base}_${c}`);

  const placeholderMismatch = [];
  const empty = [];
  const markers = [];
  let comparable = 0;
  let identical = 0;
  for (const [k, v] of tr) {
    if (v.trim() === '') empty.push(k);
    if (MARKER.test(v)) markers.push(k);
    const enKey = en.has(k) ? k : PLURAL.test(k) ? [...en.keys()].find((e) => baseKey(e) === baseKey(k)) : undefined;
    if (!enKey) continue;
    const a = placeholders(v);
    const b = placeholders(en.get(enKey));
    if (a !== b) {
      // plural forms may legitimately omit {{count}} (e.g. a "one" form that says "a single …")
      const strip = (s) => s.split('|').filter((x) => x && x !== 'count').join('|');
      if (strip(a) !== strip(b)) placeholderMismatch.push(k);
    }
    const english = en.get(enKey);
    if (/\p{L}{4,}/u.test(english.replace(/\{\{[^}]*\}\}/g, ''))) {
      comparable++;
      if (v.trim() === english.trim()) identical++;
    }
  }
  const identicalRatio = comparable ? identical / comparable : 0;
  const looksCopied = identicalRatio > 0.35;

  const bad = missing.length + extra.length + pluralGaps.length + placeholderMismatch.length + empty.length + markers.length + (looksCopied ? 1 : 0);
  summary.push({ code, state: bad ? 'FAIL' : 'ok', keys: tr.size, missing: missing.length, extra: extra.length, pluralGaps: pluralGaps.length, placeholders: placeholderMismatch.length, empty: empty.length, copied: Math.round(identicalRatio * 100) });
  if (bad) {
    problems.push(
      `${code}: ${missing.length} missing, ${extra.length} extra, ${pluralGaps.length} plural gap(s), ${placeholderMismatch.length} placeholder mismatch(es), ${empty.length} empty, ${markers.length} marker(s)` +
        (looksCopied ? `, ${Math.round(identicalRatio * 100)}% identical to English (looks untranslated)` : ''),
    );
    if (verbose) {
      for (const k of missing.slice(0, 40)) console.error(`   [${code}] missing  ${k}`);
      for (const k of extra.slice(0, 20)) console.error(`   [${code}] extra    ${k}`);
      for (const k of pluralGaps.slice(0, 20)) console.error(`   [${code}] plural   ${k}`);
      for (const k of placeholderMismatch.slice(0, 20)) console.error(`   [${code}] {{ }}    ${k}`);
      for (const k of [...empty, ...markers].slice(0, 20)) console.error(`   [${code}] empty/marker  ${k}`);
    }
  }
}

console.log(`en: ${en.size} entries (${enBases.size} keys) · source uses ${used.size} static keys (+${infoDynamic} dynamic) · registry: ${registered.length} locales`);
for (const s of summary) {
  if (s.state === 'no catalog yet') console.log(`  ${s.code.padEnd(6)} — no catalog yet`);
  else console.log(`  ${s.code.padEnd(6)} ${String(s.keys).padStart(4)} entries  missing:${s.missing} extra:${s.extra} plural:${s.pluralGaps} {{}}:${s.placeholders} empty:${s.empty} same-as-en:${s.copied}%`);
}
if (problems.length) {
  console.error(`\n✖ i18n check failed:\n  - ${problems.join('\n  - ')}`);
  if (!verbose) console.error('  (re-run with --verbose to list the keys)');
  process.exit(1);
}
console.log(`\n✔ i18n check passed — ${translatedCount + 1} of ${registered.length} locales have complete catalogs`);
