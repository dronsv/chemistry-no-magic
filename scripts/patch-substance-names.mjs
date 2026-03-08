/**
 * patch-substance-names.mjs
 *
 * One-shot script: generates substance names from ion morphology and patches
 * data-src/translations/{locale}/substances.json (only adds missing names,
 * never overwrites existing ones).
 *
 * Usage: node scripts/patch-substance-names.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSubstanceNames } from './lib/generate-substance-names.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_SRC  = join(__dirname, '..', 'data-src');
const DRY_RUN   = process.argv.includes('--dry-run');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// Load all substance objects
const substancesDir = join(DATA_SRC, 'substances');
const substances = readdirSync(substancesDir)
  .filter(f => extname(f) === '.json')
  .map(f => {
    const d = readJson(join(substancesDir, f));
    return { ...d, _file: basename(f, '.json') };
  });

// Load ion overlays for all locales
const LOCALES = ['ru', 'en', 'pl', 'es'];
const ionOverlays = {};
for (const locale of LOCALES) {
  ionOverlays[locale] = readJson(join(DATA_SRC, 'translations', locale, 'ions.json'));
}

// Generate names
const generated = generateSubstanceNames(substances, ionOverlays);

// Patch each locale overlay
for (const locale of LOCALES) {
  const overlayPath = join(DATA_SRC, 'translations', locale, 'substances.json');
  const overlay = readJson(overlayPath);

  let added = 0;
  for (const [id, name] of Object.entries(generated[locale])) {
    if (!overlay[id]) {
      overlay[id] = { name };
      added++;
    } else if (!overlay[id].name) {
      overlay[id].name = name;
      added++;
    }
    // already has a name → skip (explicit overlay wins)
  }

  console.log(`${locale.toUpperCase()}: +${added} generated names`);

  if (!DRY_RUN) {
    writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + '\n', 'utf-8');
  }
}

if (DRY_RUN) {
  console.log('\n[dry-run] No files written.');
}
