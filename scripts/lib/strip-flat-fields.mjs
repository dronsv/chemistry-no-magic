/**
 * strip-flat-fields.mjs
 *
 * Removes flat numeric fields from data source files.
 * All these values are now stored in characteristics.json (generated
 * by scripts/lib/generate-characteristics.mjs).
 *
 * Fields removed:
 *   elements.json          : atomic_mass, electronegativity, melting_point_C, boiling_point_C, density_g_cm3
 *   substances/*.json      : melting_point_C, boiling_point_C, density_g_cm3
 *   ions.json              : charge
 *   rules/calculations_data.json  : M, delta_Hf_kJmol, S_JmolK (per substance in substances[])
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const DATA_SRC = join(ROOT, 'data-src');

// ── helpers ────────────────────────────────────────────────────────────────

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function removeFields(obj, fields) {
  let removed = 0;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(obj, f)) {
      delete obj[f];
      removed++;
    }
  }
  return removed;
}

// ── 1. elements.json ───────────────────────────────────────────────────────

const ELEMENT_FIELDS = ['atomic_mass', 'electronegativity', 'melting_point_C', 'boiling_point_C', 'density_g_cm3'];

const elementsPath = join(DATA_SRC, 'elements.json');
const elements = readJson(elementsPath);

let elementRemovals = 0;
for (const el of elements) {
  elementRemovals += removeFields(el, ELEMENT_FIELDS);
}

writeJson(elementsPath, elements);
console.log(`elements.json: removed ${elementRemovals} flat fields across ${elements.length} elements`);

// ── 2. substances/*.json (except substance_properties.json) ───────────────

const SUBSTANCE_FIELDS = ['melting_point_C', 'boiling_point_C', 'density_g_cm3'];

const substancesDir = join(DATA_SRC, 'substances');
const substanceFiles = readdirSync(substancesDir).filter(
  f => f.endsWith('.json') && f !== 'substance_properties.json',
);

let substanceFilesModified = 0;
let substanceRemovals = 0;

for (const file of substanceFiles) {
  const filePath = join(substancesDir, file);
  const data = readJson(filePath);

  // Skip non-object entries (arrays, etc.)
  if (!data || typeof data !== 'object' || Array.isArray(data)) continue;

  const removed = removeFields(data, SUBSTANCE_FIELDS);
  if (removed > 0) {
    writeJson(filePath, data);
    substanceFilesModified++;
    substanceRemovals += removed;
  }
}

console.log(`substances/: removed ${substanceRemovals} flat fields across ${substanceFilesModified} files`);

// ── 3. ions.json ───────────────────────────────────────────────────────────

const ION_FIELDS = ['charge'];

const ionsPath = join(DATA_SRC, 'ions.json');
const ions = readJson(ionsPath);

let ionRemovals = 0;
for (const ion of ions) {
  ionRemovals += removeFields(ion, ION_FIELDS);
}

writeJson(ionsPath, ions);
console.log(`ions.json: removed ${ionRemovals} flat fields across ${ions.length} ions`);

// ── 4. rules/calculations_data.json ───────────────────────────────────────

const CALC_SUBSTANCE_FIELDS = ['M', 'delta_Hf_kJmol', 'S_JmolK'];

const calcPath = join(DATA_SRC, 'rules/calculations_data.json');
const calcData = readJson(calcPath);

let calcRemovals = 0;
if (Array.isArray(calcData.calc_substances)) {
  for (const sub of calcData.calc_substances) {
    calcRemovals += removeFields(sub, CALC_SUBSTANCE_FIELDS);
  }
}

writeJson(calcPath, calcData);
console.log(`rules/calculations_data.json: removed ${calcRemovals} flat fields across ${calcData.calc_substances?.length ?? 0} substances`);

// ── summary ────────────────────────────────────────────────────────────────

const total = elementRemovals + substanceRemovals + ionRemovals + calcRemovals;
console.log(`\nTotal fields removed: ${total}`);
