/**
 * check-i18n.cjs
 * 
 * Scans all src/**\/*.tsx files for t("key") calls and verifies
 * that every key exists in src/locales/en.json.
 * 
 * Exit 0 = all keys present.
 * Exit 1 = missing keys found (lists them clearly).
 * 
 * Run via: node scripts/check-i18n.cjs
 * Or:      npm run check:i18n
 */

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "src");
const EN_LOCALE = path.join(SRC_DIR, "locales", "en.json");

// --- Load en.json ---
if (!fs.existsSync(EN_LOCALE)) {
  console.error("[check-i18n] ERROR: Could not find src/locales/en.json");
  process.exit(1);
}
const enKeys = new Set(Object.keys(JSON.parse(fs.readFileSync(EN_LOCALE, "utf-8"))));

// --- Recursively collect all .tsx files ---
function collectFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, results);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

// --- Extract t("key") and t('key') calls ---
// Matches: t("some_key") or t('some_key')
// Does NOT match: t(`template`) or dynamic t(variable)
const T_CALL_REGEX = /\bt\(\s*["']([^"'`]+)["']\s*[),]/g;

const files = collectFiles(SRC_DIR);
const missingKeys = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  let match;
  while ((match = T_CALL_REGEX.exec(content)) !== null) {
    const key = match[1];
    if (!enKeys.has(key)) {
      const relPath = path.relative(SRC_DIR, file);
      missingKeys.push({ key, file: relPath });
    }
  }
}

// --- Report ---
if (missingKeys.length > 0) {
  console.error(`[check-i18n] ✗ Found ${missingKeys.length} missing key(s) in en.json:\n`);
  const grouped = {};
  for (const { key, file } of missingKeys) {
    if (!grouped[file]) grouped[file] = [];
    grouped[file].push(key);
  }
  for (const [file, keys] of Object.entries(grouped)) {
    console.error(`  ${file}:`);
    for (const key of keys) {
      console.error(`    - "${key}"`);
    }
  }
  console.error("\nAdd these keys to src/locales/en.json before shipping.");
  process.exit(1);
}

// --- Check Locale Parity across all built-in locales ---
const BUILTIN_LOCALES = [
  "zh.json",
  "zh_TW.json",
  "ja.json",
  "es.json",
  "ru.json",
  "ko.json",
  "pt_BR.json",
];

let parityErrors = 0;

for (const locFile of BUILTIN_LOCALES) {
  const locPath = path.join(SRC_DIR, "locales", locFile);
  if (fs.existsSync(locPath)) {
    const locKeys = new Set(Object.keys(JSON.parse(fs.readFileSync(locPath, "utf-8"))));
    const missing = [...enKeys].filter((k) => !locKeys.has(k));
    if (missing.length > 0) {
      console.error(
        `[check-i18n] ✗ ${locFile} is missing ${missing.length} key(s) from en.json (e.g. ${missing.slice(0, 5).join(", ")}...)`
      );
      parityErrors++;
    }
  }
}

if (parityErrors > 0) {
  process.exit(1);
}

console.log(
  `[check-i18n] ✓ All translation keys are present in en.json and all ${BUILTIN_LOCALES.length} built-in locales.`
);
process.exit(0);
