/**
 * Shared helpers for the i18n scripts.
 *
 * Catalog layout:  src/i18n/locales/<code>/<namespace>.json   (nested JSON, plural forms as key_one / key_other …)
 * Namespaces:      src/i18n/namespaces.json   — maps each TOP-LEVEL key group (e.g. "wallet") to one namespace file
 * Registry:        src/i18n/languages.json    — the exact list of supported locales
 *
 * The scripts work on a FLAT view ("wallet.activity.send" → text) because flat lists are what translators, tools
 * and reviewers handle best; this module converts between the flat view and the namespaced files.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const localesDir = join(root, 'src', 'i18n', 'locales');
export const registry = JSON.parse(readFileSync(join(root, 'src', 'i18n', 'languages.json'), 'utf8'));
const nsMap = JSON.parse(readFileSync(join(root, 'src', 'i18n', 'namespaces.json'), 'utf8'));

export const NAMESPACES = Object.keys(nsMap);
export const PLURAL = /_(zero|one|two|few|many|other)$/;
export const PLURAL_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];
export const baseKey = (key) => key.replace(PLURAL, '');
export const placeholders = (text) =>
  [...String(text).matchAll(/\{\{\s*([\w.]+)(?:\s*,[^}]*)?\s*\}\}/g)].map((m) => m[1]).sort().join('|');

const groupToNamespace = new Map();
for (const [ns, groups] of Object.entries(nsMap)) for (const group of groups) groupToNamespace.set(group, ns);

export function namespaceOf(key) {
  const group = key.split('.')[0];
  const ns = groupToNamespace.get(group);
  if (!ns) throw new Error(`key "${key}": the group "${group}" is not assigned to a namespace in src/i18n/namespaces.json`);
  return ns;
}

/** Nested object → flat Map (insertion order preserved). */
export function flatten(node, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out.set(key, String(v));
  }
  return out;
}

/** Flat entries → nested object. */
export function unflatten(entries) {
  const out = {};
  for (const [key, value] of entries) {
    const parts = key.split('.');
    let node = out;
    for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] ??= {};
    node[parts[parts.length - 1]] = value;
  }
  return out;
}

export const localeDir = (code) => join(localesDir, code);

export function localeCodes() {
  if (!existsSync(localesDir)) return [];
  return readdirSync(localesDir).filter((name) => statSync(join(localesDir, name)).isDirectory());
}

/** Read every namespace file of a locale into one flat Map (namespace order, then file order). */
export function readLocale(code) {
  const flat = new Map();
  const dir = localeDir(code);
  if (!existsSync(dir)) return flat;
  for (const ns of NAMESPACES) {
    const file = join(dir, `${ns}.json`);
    if (existsSync(file)) flatten(JSON.parse(readFileSync(file, 'utf8')), '', flat);
  }
  // files that are not in the namespace list are a bug: surface them rather than silently ignoring them
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json') || !NAMESPACES.includes(name.replace(/\.json$/, ''))) {
      throw new Error(`${code}: unexpected file "${name}" (not a registered namespace)`);
    }
  }
  return flat;
}

/** Write a flat Map as namespace files. Namespaces with no keys get no file; stale files are removed. */
export function writeLocale(code, flat) {
  const dir = localeDir(code);
  mkdirSync(dir, { recursive: true });
  const byNs = new Map(NAMESPACES.map((ns) => [ns, []]));
  for (const [key, value] of flat) byNs.get(namespaceOf(key)).push([key, value]);
  for (const ns of NAMESPACES) {
    const file = join(dir, `${ns}.json`);
    const entries = byNs.get(ns);
    if (entries.length === 0) {
      if (existsSync(file)) rmSync(file);
      continue;
    }
    writeFileSync(file, JSON.stringify(unflatten(entries), null, 2) + '\n', 'utf8');
  }
}

/** The plural categories a language needs (CLDR, via Intl.PluralRules). */
export const pluralCategories = (code) =>
  PLURAL_ORDER.filter((c) => new Intl.PluralRules(code).resolvedOptions().pluralCategories.includes(c));

/** Parse a `dotted.key=value` list (blank lines and `#` comments ignored; only the first `=` splits). */
export function readFlatList(path) {
  const out = new Map();
  for (const [i, raw] of readFileSync(path, 'utf8').split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) throw new Error(`${path}:${i + 1}: not a key=value pair: ${line.slice(0, 60)}`);
    out.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return out;
}
