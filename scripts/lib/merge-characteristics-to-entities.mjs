/**
 * merge-characteristics-to-entities.mjs
 *
 * Reads all 5 characteristics files from data-src/characteristics/ and merges
 * the data onto the corresponding entity files (elements, ions, substances,
 * calc_substances).
 *
 * Run: node scripts/lib/merge-characteristics-to-entities.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA_SRC = join(ROOT, "data-src");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Build a compact characteristic entry from a raw record.
 * Drops `source: { kind: "asserted" }` (it's the default for everything).
 * Keeps `explanation_concept_id` only for pKa records.
 * Keeps `conditions` for pKa records (dissociation steps).
 */
function buildEntry(record) {
  const entry = { value: record.value };

  if (record.unit != null) {
    entry.unit = record.unit;
  }

  if (record.conditions != null) {
    entry.conditions = record.conditions;
  }

  // Only pKa records have a meaningful explanation_concept_id
  if (
    record.characteristic_concept_id === "concept:pKa" &&
    record.explanation_concept_id != null
  ) {
    entry.explanation_concept_id = record.explanation_concept_id;
  }

  return entry;
}

/**
 * Group all characteristic records by subject_id, then by concept_id.
 * When multiple records share the same (subject_id, concept_id) pair,
 * store as an array (e.g., multi-step pKa).
 */
function groupCharacteristics(records) {
  // Map<subject_id, Map<concept_id, entry | entry[]>>
  const bySubject = new Map();

  for (const record of records) {
    const { subject_id, characteristic_concept_id } = record;

    if (!bySubject.has(subject_id)) {
      bySubject.set(subject_id, new Map());
    }
    const byConcept = bySubject.get(subject_id);
    const entry = buildEntry(record);

    if (byConcept.has(characteristic_concept_id)) {
      const existing = byConcept.get(characteristic_concept_id);
      if (Array.isArray(existing)) {
        existing.push(entry);
      } else {
        byConcept.set(characteristic_concept_id, [existing, entry]);
      }
    } else {
      byConcept.set(characteristic_concept_id, entry);
    }
  }

  return bySubject;
}

/**
 * Convert a Map<concept_id, entry> to a plain object, sorted by concept_id
 * for deterministic output.
 */
function conceptMapToObject(conceptMap) {
  const obj = {};
  for (const [conceptId, entry] of [...conceptMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    obj[conceptId] = entry;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Load all characteristics files
// ---------------------------------------------------------------------------

const CHAR_FILES = [
  "element_properties.json",
  "substance_properties.json",
  "ion_properties.json",
  "thermochemical.json",
  "acid_dissociation.json",
];

console.log("Loading characteristics files...");
const allRecords = [];
for (const fileName of CHAR_FILES) {
  const filePath = join(DATA_SRC, "characteristics", fileName);
  const records = readJson(filePath);
  console.log(`  ${fileName}: ${records.length} records`);
  allRecords.push(...records);
}
console.log(`  Total: ${allRecords.length} records\n`);

const charsBySubject = groupCharacteristics(allRecords);
console.log(`Grouped into ${charsBySubject.size} subjects\n`);

// ---------------------------------------------------------------------------
// Counters for summary
// ---------------------------------------------------------------------------

let elementsWithChars = 0;
let elementsTotalChars = 0;
let ionsWithChars = 0;
let ionsTotalChars = 0;
let substancesWithChars = 0;
let substancesTotalChars = 0;
let calcSubsWithChars = 0;
let calcSubsTotalChars = 0;

// ---------------------------------------------------------------------------
// 1. Elements (data-src/elements.json)
// ---------------------------------------------------------------------------

console.log("Processing elements...");
const elementsPath = join(DATA_SRC, "elements.json");
const elements = readJson(elementsPath);

for (const element of elements) {
  const subjectId = `el:${element.symbol}`;
  const conceptMap = charsBySubject.get(subjectId);
  if (conceptMap && conceptMap.size > 0) {
    element.characteristics = conceptMapToObject(conceptMap);
    elementsWithChars++;
    elementsTotalChars += conceptMap.size;
  }
}

writeJson(elementsPath, elements);
console.log(
  `  ${elementsWithChars}/${elements.length} elements updated, ${elementsTotalChars} characteristic entries\n`
);

// ---------------------------------------------------------------------------
// 2. Ions (data-src/ions.json)
// ---------------------------------------------------------------------------

console.log("Processing ions...");
const ionsPath = join(DATA_SRC, "ions.json");
const ions = readJson(ionsPath);

for (const ion of ions) {
  const conceptMap = charsBySubject.get(ion.id);
  if (conceptMap && conceptMap.size > 0) {
    ion.characteristics = conceptMapToObject(conceptMap);
    ionsWithChars++;
    ionsTotalChars += conceptMap.size;
  }
}

writeJson(ionsPath, ions);
console.log(
  `  ${ionsWithChars}/${ions.length} ions updated, ${ionsTotalChars} characteristic entries\n`
);

// ---------------------------------------------------------------------------
// 3. Substances (data-src/substances/*.json)
//    Skip substance_properties.json subjects here — those records ARE in allRecords
//    and will be matched by sub:id just fine.
//    The task says "SKIP substance_properties.json" meaning don't process that
//    characteristics file separately — but we already loaded it into allRecords,
//    so the data is already grouped. The instruction means: don't process the
//    characteristics file itself as an entity file. We match by sub:id normally.
// ---------------------------------------------------------------------------

console.log("Processing substances...");
const substancesDir = join(DATA_SRC, "substances");
const substanceFiles = readdirSync(substancesDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

// Build formula → sub:id mapping while processing
const formulaToSubId = new Map();

for (const fileName of substanceFiles) {
  const filePath = join(substancesDir, fileName);
  const substance = readJson(filePath);

  // Build formula lookup for calc_substances step
  if (substance.formula) {
    formulaToSubId.set(substance.formula, substance.id);
  }

  const conceptMap = charsBySubject.get(substance.id);
  if (conceptMap && conceptMap.size > 0) {
    substance.characteristics = conceptMapToObject(conceptMap);
    substancesWithChars++;
    substancesTotalChars += conceptMap.size;
    writeJson(filePath, substance);
  }
}

console.log(
  `  ${substancesWithChars}/${substanceFiles.length} substances updated, ${substancesTotalChars} characteristic entries\n`
);

// ---------------------------------------------------------------------------
// 4. CalcSubstances (data-src/rules/calculations_data.json → calc_substances)
//    Match thermochemical chars using formula→sub:id lookup.
//    The thermochemical.json records are already in charsBySubject under sub:* keys.
// ---------------------------------------------------------------------------

console.log("Processing calc_substances...");
const calcDataPath = join(DATA_SRC, "rules", "calculations_data.json");
const calcData = readJson(calcDataPath);

for (const calcSub of calcData.calc_substances) {
  const subId = formulaToSubId.get(calcSub.formula);
  if (!subId) {
    // Not all calc formulas necessarily have a substance file (e.g., element H₂)
    // Try a few fallbacks: remove subscripts to match substance id
    continue;
  }

  const conceptMap = charsBySubject.get(subId);
  if (conceptMap && conceptMap.size > 0) {
    calcSub.characteristics = conceptMapToObject(conceptMap);
    calcSubsWithChars++;
    calcSubsTotalChars += conceptMap.size;
  }
}

writeJson(calcDataPath, calcData);
console.log(
  `  ${calcSubsWithChars}/${calcData.calc_substances.length} calc_substances updated, ${calcSubsTotalChars} characteristic entries\n`
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const totalEntitiesWithChars =
  elementsWithChars + ionsWithChars + substancesWithChars + calcSubsWithChars;
const totalCharsAdded =
  elementsTotalChars +
  ionsTotalChars +
  substancesTotalChars +
  calcSubsTotalChars;

console.log("=== Summary ===");
console.log(
  `Elements:       ${elementsWithChars} entities, ${elementsTotalChars} characteristics`
);
console.log(
  `Ions:           ${ionsWithChars} entities, ${ionsTotalChars} characteristics`
);
console.log(
  `Substances:     ${substancesWithChars} entities, ${substancesTotalChars} characteristics`
);
console.log(
  `CalcSubstances: ${calcSubsWithChars} entities, ${calcSubsTotalChars} characteristics`
);
console.log(`---`);
console.log(
  `Total:          ${totalEntitiesWithChars} entities received characteristics, ${totalCharsAdded} characteristic entries added`
);
