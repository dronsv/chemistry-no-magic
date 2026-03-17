/**
 * generate-characteristics.mjs
 *
 * Reads flat numeric properties from elements, substances, ions, and
 * calculations_data and emits TypedCharacteristic records into
 * data-src/characteristics/.
 *
 * Usage: node scripts/lib/generate-characteristics.mjs
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_SRC = join(__dirname, '../../data-src');
const OUT_DIR = join(DATA_SRC, 'characteristics');

// ---------------------------------------------------------------------------
// Property → concept / unit mapping
// ---------------------------------------------------------------------------
const PROP_META = {
  atomic_mass:    { concept: 'concept:atomic_mass',          unit: 'unit:u' },
  electronegativity: { concept: 'concept:electronegativity', unit: null },
  melting_point_C: { concept: 'concept:melting_point',       unit: 'unit:celsius' },
  boiling_point_C: { concept: 'concept:boiling_point',       unit: 'unit:celsius' },
  density_g_cm3:  { concept: 'concept:density',              unit: 'unit:g_per_cm3' },
  charge:         { concept: 'concept:ion_charge',           unit: 'unit:elementary_charge' },
  M:              { concept: 'concept:molar_mass',           unit: 'unit:g_per_mol' },
  delta_Hf_kJmol: { concept: 'concept:enthalpy_of_formation', unit: 'unit:kJ_per_mol' },
  S_JmolK:        { concept: 'concept:standard_entropy',     unit: 'unit:J_per_mol_K' },
};

// Property key → short suffix for ID
const PROP_SUFFIX = {
  atomic_mass:      'atomic_mass',
  electronegativity:'electronegativity',
  melting_point_C:  'melting_point',
  boiling_point_C:  'boiling_point',
  density_g_cm3:    'density',
  charge:           'charge',
  M:                'molar_mass',
  delta_Hf_kJmol:   'enthalpy_of_formation',
  S_JmolK:          'standard_entropy',
};

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

/**
 * Build a short subject tag from a full prefixed ID.
 * e.g. "el:Na" → "Na", "sub:h2o" → "h2o", "ion:H_plus" → "H_plus"
 */
function shortSubject(prefixedId) {
  const colon = prefixedId.indexOf(':');
  return colon >= 0 ? prefixedId.slice(colon + 1) : prefixedId;
}

function makeCharId(subjectId, propKey) {
  return `char:${shortSubject(subjectId)}_${PROP_SUFFIX[propKey]}`;
}

function makeRecord(subjectId, propKey, value) {
  const meta = PROP_META[propKey];
  const rec = {
    id: makeCharId(subjectId, propKey),
    characteristic_concept_id: meta.concept,
    subject_id: subjectId,
    value_kind: 'number',
    value,
    source: { kind: 'asserted' },
  };
  if (meta.unit !== null) {
    rec.unit = meta.unit;
  }
  return rec;
}

// ---------------------------------------------------------------------------
// 1. Element properties
// ---------------------------------------------------------------------------
function generateElementProperties() {
  const elements = JSON.parse(readFileSync(join(DATA_SRC, 'elements.json'), 'utf8'));
  const records = [];

  const props = ['atomic_mass', 'electronegativity', 'melting_point_C', 'boiling_point_C', 'density_g_cm3'];

  for (const el of elements) {
    const subjectId = `el:${el.symbol}`;
    for (const prop of props) {
      const val = el[prop];
      if (val != null && typeof val === 'number') {
        records.push(makeRecord(subjectId, prop, val));
      }
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// 2. Substance properties
// ---------------------------------------------------------------------------
function generateSubstanceProperties() {
  const substancesDir = join(DATA_SRC, 'substances');
  const files = readdirSync(substancesDir).filter(
    f => f.endsWith('.json') && f !== 'substance_properties.json'
  );

  const records = [];
  const props = ['melting_point_C', 'boiling_point_C', 'density_g_cm3'];

  for (const file of files) {
    let sub;
    try {
      sub = JSON.parse(readFileSync(join(substancesDir, file), 'utf8'));
    } catch {
      continue;
    }
    if (!sub.id) continue;

    for (const prop of props) {
      const val = sub[prop];
      if (val != null && typeof val === 'number') {
        records.push(makeRecord(sub.id, prop, val));
      }
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// 3. Ion properties (charge)
// ---------------------------------------------------------------------------
function generateIonProperties() {
  const ions = JSON.parse(readFileSync(join(DATA_SRC, 'ions.json'), 'utf8'));
  const records = [];

  for (const ion of ions) {
    if (ion.id && typeof ion.charge === 'number') {
      records.push(makeRecord(ion.id, 'charge', ion.charge));
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// 4. Thermochemical properties from calculations_data.json
// ---------------------------------------------------------------------------
function buildFormulaToIdMap() {
  const substancesDir = join(DATA_SRC, 'substances');
  const files = readdirSync(substancesDir).filter(
    f => f.endsWith('.json') && f !== 'substance_properties.json'
  );

  const map = new Map(); // formula (Unicode) → sub:id
  for (const file of files) {
    let sub;
    try {
      sub = JSON.parse(readFileSync(join(substancesDir, file), 'utf8'));
    } catch {
      continue;
    }
    if (sub.id && sub.formula) {
      map.set(sub.formula, sub.id);
    }
  }
  return map;
}

function generateThermochemical() {
  const calcData = JSON.parse(
    readFileSync(join(DATA_SRC, 'rules/calculations_data.json'), 'utf8')
  );
  const formulaToId = buildFormulaToIdMap();

  const records = [];
  const props = ['M', 'delta_Hf_kJmol', 'S_JmolK'];

  for (const entry of calcData.calc_substances) {
    const subjectId = formulaToId.get(entry.formula);
    if (!subjectId) {
      // Formula not found in substances — skip with a warning
      process.stderr.write(`[generate-characteristics] WARNING: no substance found for formula "${entry.formula}", skipping thermochemical record\n`);
      continue;
    }

    for (const prop of props) {
      const val = entry[prop];
      if (val != null && typeof val === 'number') {
        records.push(makeRecord(subjectId, prop, val));
      }
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const elementProps = generateElementProperties();
  const substanceProps = generateSubstanceProperties();
  const ionProps = generateIonProperties();
  const thermoProps = generateThermochemical();

  const files = [
    { name: 'element_properties.json',  data: elementProps },
    { name: 'substance_properties.json', data: substanceProps },
    { name: 'ion_properties.json',       data: ionProps },
    { name: 'thermochemical.json',       data: thermoProps },
  ];

  for (const { name, data } of files) {
    const outPath = join(OUT_DIR, name);
    writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  Wrote ${data.length} records → ${outPath.replace(process.cwd() + '/', '')}`);
  }

  const total = files.reduce((sum, f) => sum + f.data.length, 0);
  console.log(`\nDone. Total records: ${total}`);
}

main();
