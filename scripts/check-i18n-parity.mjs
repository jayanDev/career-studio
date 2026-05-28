#!/usr/bin/env node
/**
 * i18n key-parity check.
 *
 * Walks messages/en.json (the authoritative locale) and verifies that
 * every nested key exists in messages/si.json and messages/ta.json.
 * Missing keys cause a silent next-intl fallback to English, which is
 * fine in dev but a launch-blocker for production users on /si or /ta.
 *
 * Exit codes:
 *   0  All keys present in every locale
 *   1  Missing keys detected (printed to stderr)
 *   2  Could not read or parse a locale file
 *
 * Usage: `node scripts/check-i18n-parity.mjs` (wired into CI).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = resolve(here, "..", "messages");

const BASE_LOCALE = "en";
const COMPARE_LOCALES = ["si", "ta"];

function load(locale) {
  try {
    const raw = readFileSync(resolve(messagesDir, `${locale}.json`), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[i18n-parity] could not load ${locale}.json:`, error.message);
    process.exit(2);
  }
}

/** Recursively flatten a nested object into dotted-path leaf keys. */
function flatten(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  const keys = [];
  for (const [k, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${k}` : k;
    keys.push(...flatten(v, path));
  }
  return keys;
}

const base = load(BASE_LOCALE);
const baseKeys = new Set(flatten(base));

let hasMissing = false;
for (const locale of COMPARE_LOCALES) {
  const data = load(locale);
  const localeKeys = new Set(flatten(data));
  const missing = [...baseKeys].filter((k) => !localeKeys.has(k));
  const extra = [...localeKeys].filter((k) => !baseKeys.has(k));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`[i18n-parity] ${locale}: OK (${localeKeys.size} keys)`);
    continue;
  }

  hasMissing ||= missing.length > 0;
  if (missing.length > 0) {
    console.error(`[i18n-parity] ${locale}: missing ${missing.length} keys from ${BASE_LOCALE}:`);
    for (const key of missing.slice(0, 30)) console.error(`  - ${key}`);
    if (missing.length > 30) console.error(`  ... and ${missing.length - 30} more`);
  }
  if (extra.length > 0) {
    console.warn(`[i18n-parity] ${locale}: ${extra.length} extra keys not in ${BASE_LOCALE} (informational, not failed):`);
    for (const key of extra.slice(0, 10)) console.warn(`  + ${key}`);
    if (extra.length > 10) console.warn(`  ... and ${extra.length - 10} more`);
  }
}

if (hasMissing) {
  console.error("\n[i18n-parity] FAIL — locale files are missing keys. Run a sync or update CI.");
  process.exit(1);
}

console.log("\n[i18n-parity] OK — all locales have full key coverage.");
