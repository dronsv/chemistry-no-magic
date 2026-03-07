/**
 * scripts/migrate-to-locale-packs.mjs
 *
 * One-shot migration: extract all *_ru / *_en / *_pl / *_es fields from core
 * data-src/ JSON files into data-src/translations/{locale}/ overlay packs,
 * and rename existing overlay field keys (name_ru → name, etc.).
 *
 * Run once: node scripts/migrate-to-locale-packs.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_SRC = join(__dirname, '..', 'data-src');
const TRANSLATIONS = join(DATA_SRC, 'translations');
const LOCALES = ['ru', 'en', 'pl', 'es'];

// ---------------------------------------------------------------------------
// Mapping: relative path in data-src → { overlayName, keyField }
// overlayName = the filename (without .json) in translations/{locale}/
// keyField = the property used to identify items (for array files)
// null keyField = file has a single object or complex structure handled specially
// ---------------------------------------------------------------------------
const FILE_MAPPING = {
  'elements.json':                        { overlayName: 'elements',              keyField: 'symbol' },
  'ions.json':                            { overlayName: 'ions',                  keyField: 'id' },
  'element-groups.json':                  { overlayName: 'element_groups',        keyField: null }, // dict keyed by group id
  'effects_vocab.json':                   { overlayName: 'effects_vocab',         keyField: 'id' },
  'process_vocab.json':                   { overlayName: 'process_vocab',         keyField: 'id' },
  'topics.json':                          { overlayName: 'topics',                keyField: 'id' },
  'topic_pages.json':                     { overlayName: 'topic_pages',           keyField: null }, // dict keyed by topic id
  'periodic-table-content.json':          { overlayName: 'periodic_table_content',keyField: null }, // mixed structure
  'quantities_units_ontology.json':       { overlayName: 'quantities_units_ontology', keyField: null }, // nested arrays
  'sources_list.json':                    { overlayName: 'sources_list',          keyField: null }, // has sources[] with source_id
  'rules/competencies.json':              { overlayName: 'competencies',          keyField: 'id' },
  'rules/bond_theory.json':              { overlayName: 'bond_theory',           keyField: 'id' },
  'rules/classification_rules.json':     { overlayName: 'classification_rules',  keyField: 'id' },
  'rules/ion_nomenclature.json':         { overlayName: 'ion_nomenclature',      keyField: null }, // complex dict structure
  'rules/naming_rules.json':             { overlayName: 'naming_rules',          keyField: 'id' },
  'rules/oxidation_rules.json':          { overlayName: 'oxidation_rules',       keyField: 'id' },
  'rules/activity_series.json':          { overlayName: 'activity_series',       keyField: 'symbol' },
  'rules/genetic_chains.json':           { overlayName: 'genetic_chains',        keyField: 'chain_id' },
  'rules/qualitative_reactions.json':    { overlayName: 'qualitative_reactions', keyField: 'target_id' },
  'rules/energy_catalyst_theory.json':   { overlayName: 'energy_catalyst_theory',keyField: null }, // nested arrays
  'rules/calculations_data.json':        { overlayName: 'calculations_data',     keyField: null }, // has calc_substances[] calc_reactions[]
  'rules/oxidation_theory.json':         { overlayName: 'oxidation_theory',      keyField: null }, // has rules[] array
  'rules/periodic-table-theory.json':    { overlayName: 'periodic_table_theory', keyField: null }, // has property_trends[] etc.
  'rules/applicability_rules.json':      { overlayName: 'applicability_rules',   keyField: 'id' },
  'reactions/reaction_roles.json':       { overlayName: 'reaction_roles',        keyField: 'role_id' },
  'reactions/reactions.json':            { overlayName: 'reactions',             keyField: 'reaction_id' }, // bare 'title' field
  'diagnostic/questions.json':           { overlayName: 'diagnostic_questions',  keyField: 'id' },
  'contexts/terms.json':                 { overlayName: 'terms',                 keyField: 'id' },
  'courses/oge_inorganic_classification.json': { overlayName: 'oge_inorganic_classification', keyField: null },
  'dictionaries/exam_profiles.json':     { overlayName: 'exam_profiles',         keyField: null }, // has profiles[] with id
  'exercises/bonds-exercises.json':      { overlayName: 'bonds_exercises',       keyField: 'id' },
  'exercises/oxidation-exercises.json':  { overlayName: 'oxidation_exercises',   keyField: 'id' },
  'exercises/periodic-table-exercises.json': { overlayName: 'periodic_table_exercises', keyField: 'id' },
  'engine/task_templates.json':          { overlayName: 'engine_task_templates', keyField: 'template_id' },
  'templates/reaction_templates.json':   { overlayName: 'reaction_templates',    keyField: 'id' },
  'templates/task_templates.json':       { overlayName: 'task_templates_legacy', keyField: 'id' },
  'exam/oge/tasks.json':                 { overlayName: 'oge_tasks',             keyField: 'task_id' },
  'exam/oge/algorithms.json':            { overlayName: 'oge_algorithms',        keyField: 'task_number' },
  'exam/oge_tasks.json':                 { overlayName: 'oge_tasks_legacy',      keyField: 'id' },
  'exam/oge_solution_algorithms.json':   { overlayName: 'oge_solution_algorithms', keyField: 'id' },
  'exam/ege/tasks.json':                 { overlayName: 'ege_tasks',             keyField: 'task_id' },
  'exam/ege/algorithms.json':            { overlayName: 'ege_algorithms',        keyField: 'task_number' },
  'exam/gcse/tasks.json':               { overlayName: 'gcse_tasks',            keyField: 'task_id' },
  'exam/gcse/algorithms.json':          { overlayName: 'gcse_algorithms',       keyField: 'task_number' },
  'exam/egzamin/tasks.json':            { overlayName: 'egzamin_tasks',         keyField: 'task_id' },
  'exam/egzamin/algorithms.json':       { overlayName: 'egzamin_algorithms',    keyField: 'task_number' },
  'exam/ebau/tasks.json':               { overlayName: 'ebau_tasks',            keyField: 'task_id' },
  'exam/ebau/algorithms.json':          { overlayName: 'ebau_algorithms',       keyField: 'task_number' },
  'exam/oge/meta.json':                 { overlayName: 'oge_meta',              keyField: null },
  'exam/ege/meta.json':                 { overlayName: 'ege_meta',              keyField: null },
  'exam/gcse/meta.json':                { overlayName: 'gcse_meta',             keyField: null },
  'exam/egzamin/meta.json':             { overlayName: 'egzamin_meta',          keyField: null },
  'exam/ebau/meta.json':                { overlayName: 'ebau_meta',             keyField: null },
  'exam/systems.json':                  { overlayName: 'exam_systems',          keyField: null },
};

// Theory modules are handled as a directory (one overlay per file)
// Substances are handled specially (individual files → aggregate overlay)

// ---------------------------------------------------------------------------
// Locale suffix patterns
// ---------------------------------------------------------------------------
const LOCALE_SUFFIX_RE = /^(.+?)_(ru|en|pl|es)(?:_(.+))?$/;

/** Strip locale suffix from a field key: "name_ru" → { base: "name", locale: "ru" } */
function parseLocaleSuffix(key) {
  const m = key.match(/^(.+)_(ru|en|pl|es)$/);
  if (!m) return null;
  return { base: m[1], locale: m[2] };
}

// ---------------------------------------------------------------------------
// Generic _ru/_en/_pl/_es extractor (works on any JSON value recursively)
// Returns { localeData: { ru: {...}, en: {...}, ... }, cleaned: cleanedValue }
// ---------------------------------------------------------------------------
function extractLocaleFields(value) {
  if (value === null || typeof value !== 'object') {
    return { localeData: {}, cleaned: value };
  }

  if (Array.isArray(value)) {
    const cleaned = [];
    const mergedLocaleData = {};
    for (const item of value) {
      const { localeData, cleaned: c } = extractLocaleFields(item);
      cleaned.push(c);
      for (const [loc, data] of Object.entries(localeData)) {
        if (!mergedLocaleData[loc]) mergedLocaleData[loc] = {};
        Object.assign(mergedLocaleData[loc], data);
      }
    }
    return { localeData: mergedLocaleData, cleaned };
  }

  // It's a plain object
  const localeData = {};
  const cleaned = {};

  for (const [key, val] of Object.entries(value)) {
    const parsed = parseLocaleSuffix(key);
    if (parsed) {
      // This is a localized field - extract it
      const { base, locale } = parsed;
      if (!localeData[locale]) localeData[locale] = {};
      // Recursively clean the value too (in case it's nested)
      const { cleaned: cleanedVal } = extractLocaleFields(val);
      localeData[locale][base] = cleanedVal;
    } else {
      // Recurse into nested objects
      const { localeData: childLocaleData, cleaned: cleanedVal } = extractLocaleFields(val);
      cleaned[key] = cleanedVal;
      // Nest child locale data under this key
      for (const [loc, data] of Object.entries(childLocaleData)) {
        if (!localeData[loc]) localeData[loc] = {};
        if (Object.keys(data).length > 0) {
          localeData[loc][key] = data;
        }
      }
    }
  }

  return { localeData, cleaned };
}

// ---------------------------------------------------------------------------
// Overlay key renaming: strip _ru/_en/_pl/_es from existing overlay files
// ---------------------------------------------------------------------------
function renameOverlayKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(renameOverlayKeys);

  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const parsed = parseLocaleSuffix(key);
    const newKey = parsed ? parsed.base : key;
    result[newKey] = renameOverlayKeys(val);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Load / save helpers
// ---------------------------------------------------------------------------
async function loadJson(filePath) {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function saveJson(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function loadJsonOptional(filePath) {
  if (!existsSync(filePath)) return null;
  return loadJson(filePath);
}

// ---------------------------------------------------------------------------
// Build an overlay object from an array of items with a key field
// ---------------------------------------------------------------------------
function buildArrayOverlay(items, keyField, localeExtractor) {
  const overlays = {};
  for (const [locale, data] of Object.entries(localeExtractor)) {
    // data is the extracted locale fields for each item
    // We need to re-index by keyField
  }
  return overlays;
}

// ---------------------------------------------------------------------------
// Extract from an array keyed by keyField
// Returns { [locale]: { [key]: { fields } }, cleanedArray }
// ---------------------------------------------------------------------------
function extractFromArray(items, keyField) {
  const localeOverlays = {};
  const cleaned = [];

  for (const item of items) {
    const itemKey = String(item[keyField]);
    const { localeData, cleaned: cleanedItem } = extractLocaleFields(item);
    cleaned.push(cleanedItem);

    for (const [locale, fields] of Object.entries(localeData)) {
      if (Object.keys(fields).length === 0) continue;
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale][itemKey] = fields;
    }
  }

  return { localeOverlays, cleaned };
}

// ---------------------------------------------------------------------------
// Process a single data file with a known array keyField
// ---------------------------------------------------------------------------
async function processArrayFile(relPath, overlayName, keyField) {
  const filePath = join(DATA_SRC, relPath);
  if (!existsSync(filePath)) {
    console.log(`  SKIP (not found): ${relPath}`);
    return;
  }

  const data = await loadJson(filePath);
  if (!Array.isArray(data)) {
    console.warn(`  WARN: expected array in ${relPath}, got ${typeof data}`);
    return;
  }

  const { localeOverlays, cleaned } = extractFromArray(data, keyField);

  // Write overlay files + merge with existing
  for (const locale of LOCALES) {
    if (!localeOverlays[locale] || Object.keys(localeOverlays[locale]).length === 0) continue;
    const overlayPath = join(TRANSLATIONS, locale, `${overlayName}.json`);
    const existing = await loadJsonOptional(overlayPath) || {};
    // Rename existing overlay keys (strip _ru etc.)
    const renamedExisting = renameOverlayKeys(existing);
    // Merge: new extracted takes precedence
    const merged = deepMergeOverlays(renamedExisting, localeOverlays[locale]);
    await saveJson(overlayPath, merged);
  }

  // Write cleaned core file
  await saveJson(filePath, cleaned);
  const fieldCount = Object.values(localeOverlays).reduce((s, o) => s + Object.values(o).reduce((s2, f) => s2 + Object.keys(f).length, 0), 0);
  console.log(`  ${relPath} → ${overlayName} (${fieldCount} locale fields extracted)`);
}

// ---------------------------------------------------------------------------
// Merge two overlay objects deeply
// ---------------------------------------------------------------------------
function deepMergeOverlays(base, override) {
  if (typeof base !== 'object' || base === null) return override;
  if (typeof override !== 'object' || override === null) return base;
  if (Array.isArray(base) || Array.isArray(override)) return override;

  const result = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (k in result && typeof result[k] === 'object' && !Array.isArray(result[k]) && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = deepMergeOverlays(result[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Process a file with null keyField (complex/custom structure)
// For these, we extract _ru/_en/_pl/_es from the top-level structure
// and write the full extracted object as the overlay (no per-item keying)
// ---------------------------------------------------------------------------
async function processComplexFile(relPath, overlayName, customHandler) {
  const filePath = join(DATA_SRC, relPath);
  if (!existsSync(filePath)) {
    console.log(`  SKIP (not found): ${relPath}`);
    return;
  }

  const data = await loadJson(filePath);

  let localeOverlays;
  let cleaned;

  if (customHandler) {
    const result = customHandler(data);
    localeOverlays = result.localeOverlays;
    cleaned = result.cleaned;
  } else {
    const result = extractLocaleFields(data);
    localeOverlays = {};
    cleaned = result.cleaned;
    for (const [locale, fields] of Object.entries(result.localeData)) {
      if (Object.keys(fields).length > 0) {
        localeOverlays[locale] = fields;
      }
    }
  }

  // Write overlay files + merge with existing
  for (const locale of LOCALES) {
    if (!localeOverlays[locale] || Object.keys(localeOverlays[locale]).length === 0) continue;
    const overlayPath = join(TRANSLATIONS, locale, `${overlayName}.json`);
    const existing = await loadJsonOptional(overlayPath) || {};
    const renamedExisting = renameOverlayKeys(existing);
    const merged = deepMergeOverlays(renamedExisting, localeOverlays[locale]);
    await saveJson(overlayPath, merged);
  }

  // Write cleaned core file
  await saveJson(filePath, cleaned);
  console.log(`  ${relPath} → ${overlayName} (complex)`);
}

// ---------------------------------------------------------------------------
// Custom handlers for complex files
// ---------------------------------------------------------------------------

/** element-groups.json: dict { group_id: { name_ru, ... } } */
function handleElementGroups(data) {
  const localeOverlays = {};
  const cleaned = {};

  for (const [groupId, groupData] of Object.entries(data)) {
    const { localeData, cleaned: cleanedGroup } = extractLocaleFields(groupData);
    cleaned[groupId] = cleanedGroup;

    for (const [locale, fields] of Object.entries(localeData)) {
      if (Object.keys(fields).length === 0) continue;
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale][groupId] = fields;
    }
  }

  return { localeOverlays, cleaned };
}

/** topic_pages.json: dict { topic_id: { seo_title_ru, faq_ru, ... } } */
function handleTopicPages(data) {
  const localeOverlays = {};
  const cleaned = {};

  for (const [topicId, pageData] of Object.entries(data)) {
    const { localeData, cleaned: cleanedPage } = extractLocaleFields(pageData);
    cleaned[topicId] = cleanedPage;

    for (const [locale, fields] of Object.entries(localeData)) {
      if (Object.keys(fields).length === 0) continue;
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale][topicId] = fields;
    }
  }

  return { localeOverlays, cleaned };
}

/** ion_nomenclature.json: dict with nested arrays */
function handleIonNomenclature(data) {
  const { localeData, cleaned } = extractLocaleFields(data);
  const localeOverlays = {};
  for (const [locale, fields] of Object.entries(localeData)) {
    if (Object.keys(fields).length > 0) {
      localeOverlays[locale] = fields;
    }
  }
  return { localeOverlays, cleaned };
}

/** exam_profiles.json: { schema_version, description, profiles: [{id, name_ru, ...}] } */
function handleExamProfiles(data) {
  const localeOverlays = {};
  const cleaned = { ...data };

  if (Array.isArray(data.profiles)) {
    const { localeOverlays: profileOverlays, cleaned: cleanedProfiles } = extractFromArray(data.profiles, 'id');
    cleaned.profiles = cleanedProfiles;
    for (const [locale, fields] of Object.entries(profileOverlays)) {
      localeOverlays[locale] = { profiles: fields };
    }
  }

  return { localeOverlays, cleaned };
}

/** calculations_data.json: { calc_substances: [{formula, name_ru,...}], calc_reactions: [{equation_ru,...}] } */
function handleCalculationsData(data) {
  const localeOverlays = {};
  const cleaned = { ...data };

  if (Array.isArray(data.calc_substances)) {
    const { localeOverlays: subOverlays, cleaned: cleanedSubs } = extractFromArray(data.calc_substances, 'formula');
    cleaned.calc_substances = cleanedSubs;
    for (const [locale, fields] of Object.entries(subOverlays)) {
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale].calc_substances = fields;
    }
  }

  if (Array.isArray(data.calc_reactions)) {
    // calc_reactions don't have a clear key - use index-based key
    const locReactions = {};
    const cleanedReactions = data.calc_reactions.map((rx, i) => {
      const { localeData, cleaned: c } = extractLocaleFields(rx);
      for (const [locale, fields] of Object.entries(localeData)) {
        if (Object.keys(fields).length === 0) continue;
        if (!locReactions[locale]) locReactions[locale] = {};
        locReactions[locale][String(i)] = fields;
      }
      return c;
    });
    cleaned.calc_reactions = cleanedReactions;
    for (const [locale, fields] of Object.entries(locReactions)) {
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale].calc_reactions = fields;
    }
  }

  return { localeOverlays, cleaned };
}

/** energy_catalyst_theory.json: { rate_factors: [...], catalyst_types: [...], ... } */
function handleEnergyCatalystTheory(data) {
  const localeOverlays = {};
  const cleaned = {};

  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      // Try to key by factor_id or id
      const idField = val[0]?.factor_id ? 'factor_id' : (val[0]?.id ? 'id' : null);
      if (idField) {
        const { localeOverlays: arrOverlays, cleaned: cleanedArr } = extractFromArray(val, idField);
        cleaned[key] = cleanedArr;
        for (const [locale, fields] of Object.entries(arrOverlays)) {
          if (!localeOverlays[locale]) localeOverlays[locale] = {};
          localeOverlays[locale][key] = fields;
        }
      } else {
        const { localeData, cleaned: c } = extractLocaleFields(val);
        cleaned[key] = c;
        for (const [locale, fields] of Object.entries(localeData)) {
          if (!localeOverlays[locale]) localeOverlays[locale] = {};
          localeOverlays[locale][key] = fields;
        }
      }
    } else {
      const { localeData, cleaned: c } = extractLocaleFields(val);
      cleaned[key] = c;
      for (const [locale, fields] of Object.entries(localeData)) {
        if (!localeOverlays[locale]) localeOverlays[locale] = {};
        localeOverlays[locale][key] = fields;
      }
    }
  }

  return { localeOverlays, cleaned };
}

/** quantities_units_ontology.json: { meta, quantities:[{id,...}], units:[{id,...}], ... } */
function handleQuantitiesOntology(data) {
  const localeOverlays = {};
  const cleaned = { ...data };

  for (const [key, val] of Object.entries(data)) {
    if (key === 'meta') { cleaned[key] = val; continue; }
    if (Array.isArray(val)) {
      const idField = val[0]?.id ? 'id' : null;
      if (idField) {
        const { localeOverlays: arrOverlays, cleaned: cleanedArr } = extractFromArray(val, idField);
        cleaned[key] = cleanedArr;
        for (const [locale, fields] of Object.entries(arrOverlays)) {
          if (!localeOverlays[locale]) localeOverlays[locale] = {};
          localeOverlays[locale][key] = fields;
        }
      } else {
        const { localeData, cleaned: c } = extractLocaleFields(val);
        cleaned[key] = c;
        for (const [locale, fields] of Object.entries(localeData)) {
          if (!localeOverlays[locale]) localeOverlays[locale] = {};
          localeOverlays[locale][key] = fields;
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      const { localeData, cleaned: c } = extractLocaleFields(val);
      cleaned[key] = c;
      for (const [locale, fields] of Object.entries(localeData)) {
        if (!localeOverlays[locale]) localeOverlays[locale] = {};
        localeOverlays[locale][key] = fields;
      }
    }
  }

  return { localeOverlays, cleaned };
}

/** Generic dict-with-arrays handler: handles any dict where values are arrays of {id,...} or {factor_id,...} */
function handleDictWithArrays(data) {
  const localeOverlays = {};
  const cleaned = {};

  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      const idField = val[0]?.id ? 'id' : (val[0]?.factor_id ? 'factor_id' : (val[0]?.symbol ? 'symbol' : null));
      if (idField) {
        const { localeOverlays: arrOverlays, cleaned: cleanedArr } = extractFromArray(val, idField);
        cleaned[key] = cleanedArr;
        for (const [locale, fields] of Object.entries(arrOverlays)) {
          if (!localeOverlays[locale]) localeOverlays[locale] = {};
          localeOverlays[locale][key] = fields;
        }
      } else {
        const { localeData, cleaned: c } = extractLocaleFields(val);
        cleaned[key] = c;
        for (const [locale, fields] of Object.entries(localeData)) {
          if (!localeOverlays[locale]) localeOverlays[locale] = {};
          if (Object.keys(fields).length > 0) localeOverlays[locale][key] = fields;
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      const { localeData, cleaned: c } = extractLocaleFields(val);
      cleaned[key] = c;
      for (const [locale, fields] of Object.entries(localeData)) {
        if (!localeOverlays[locale]) localeOverlays[locale] = {};
        if (Object.keys(fields).length > 0) localeOverlays[locale][key] = fields;
      }
    } else {
      // Scalar: check for locale suffix on key itself
      const parsed = parseLocaleSuffix(key);
      if (parsed) {
        if (!localeOverlays[parsed.locale]) localeOverlays[parsed.locale] = {};
        localeOverlays[parsed.locale][parsed.base] = val;
      } else {
        cleaned[key] = val;
      }
    }
  }

  return { localeOverlays, cleaned };
}

/** oxidation_theory.json: { rules: [{id, name_ru, rule_ru,...}], redox_concepts: {oxidizer_ru,...} } */
function handleOxidationTheory(data) {
  return handleDictWithArrays(data);
}

/** periodic-table-theory.json: { property_trends: [{id,...}], ... } */
function handlePeriodicTableTheory(data) {
  const localeOverlays = {};
  const cleaned = {};

  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      const idField = val[0]?.id ? 'id' : null;
      if (idField) {
        const { localeOverlays: arrOverlays, cleaned: cleanedArr } = extractFromArray(val, idField);
        cleaned[key] = cleanedArr;
        for (const [locale, fields] of Object.entries(arrOverlays)) {
          if (!localeOverlays[locale]) localeOverlays[locale] = {};
          localeOverlays[locale][key] = fields;
        }
      } else {
        const { localeData, cleaned: c } = extractLocaleFields(val);
        cleaned[key] = c;
      }
    } else {
      const { localeData, cleaned: c } = extractLocaleFields(val);
      cleaned[key] = c;
      for (const [locale, fields] of Object.entries(localeData)) {
        if (!localeOverlays[locale]) localeOverlays[locale] = {};
        localeOverlays[locale][key] = fields;
      }
    }
  }

  return { localeOverlays, cleaned };
}

/** periodic-table-content.json: { theory_blocks: [{id,...}], oxidation_explanation_template_ru, competency_descriptions } */
function handlePeriodicTableContent(data) {
  const localeOverlays = {};
  const cleaned = {};

  // theory_blocks: array with id
  if (Array.isArray(data.theory_blocks)) {
    const { localeOverlays: blockOverlays, cleaned: cleanedBlocks } = extractFromArray(data.theory_blocks, 'id');
    cleaned.theory_blocks = cleanedBlocks;
    for (const [locale, fields] of Object.entries(blockOverlays)) {
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale].theory_blocks = fields;
    }
  }

  // competency_descriptions: dict { comp_id: { ... } }
  if (data.competency_descriptions && typeof data.competency_descriptions === 'object') {
    const cdLocale = {};
    const cleanedCd = {};
    for (const [compId, desc] of Object.entries(data.competency_descriptions)) {
      const { localeData, cleaned: c } = extractLocaleFields(desc);
      cleanedCd[compId] = c;
      for (const [locale, fields] of Object.entries(localeData)) {
        if (!cdLocale[locale]) cdLocale[locale] = {};
        cdLocale[locale][compId] = fields;
      }
    }
    cleaned.competency_descriptions = cleanedCd;
    for (const [locale, fields] of Object.entries(cdLocale)) {
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale].competency_descriptions = fields;
    }
  }

  // Top-level _ru fields (e.g., oxidation_explanation_template_ru)
  for (const [key, val] of Object.entries(data)) {
    if (key === 'theory_blocks' || key === 'competency_descriptions') continue;
    const parsed = parseLocaleSuffix(key);
    if (parsed) {
      if (!localeOverlays[parsed.locale]) localeOverlays[parsed.locale] = {};
      localeOverlays[parsed.locale][parsed.base] = val;
    } else {
      cleaned[key] = val;
    }
  }

  return { localeOverlays, cleaned };
}

/** reactions/reactions.json: bare 'title' + delete molecular[].name */
async function handleReactions() {
  const filePath = join(DATA_SRC, 'reactions', 'reactions.json');
  if (!existsSync(filePath)) {
    console.log(`  SKIP (not found): reactions/reactions.json`);
    return;
  }

  const data = await loadJson(filePath);
  const localeOverlays = { ru: {} };
  const cleaned = [];

  for (const rx of data) {
    const rxKey = rx.reaction_id;

    // Extract _ru/_en/_pl/_es fields
    const { localeData, cleaned: cleanedRx } = extractLocaleFields(rx);
    for (const [locale, fields] of Object.entries(localeData)) {
      if (Object.keys(fields).length === 0) continue;
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale][rxKey] = fields;
    }

    // Handle bare 'title' (Russian text in core)
    if (cleanedRx.title && typeof cleanedRx.title === 'string') {
      if (!localeOverlays.ru[rxKey]) localeOverlays.ru[rxKey] = {};
      localeOverlays.ru[rxKey].title = cleanedRx.title;
      delete cleanedRx.title;
    }

    // Delete molecular[].name (runtime derives from substance locale pack)
    if (cleanedRx.molecular) {
      if (Array.isArray(cleanedRx.molecular.reactants)) {
        cleanedRx.molecular.reactants = cleanedRx.molecular.reactants.map(r => {
          const { name, ...rest } = r;
          return rest;
        });
      }
      if (Array.isArray(cleanedRx.molecular.products)) {
        cleanedRx.molecular.products = cleanedRx.molecular.products.map(r => {
          const { name, ...rest } = r;
          return rest;
        });
      }
    }

    cleaned.push(cleanedRx);
  }

  // Write overlay files
  for (const locale of LOCALES) {
    if (!localeOverlays[locale] || Object.keys(localeOverlays[locale]).length === 0) continue;
    const overlayPath = join(TRANSLATIONS, locale, 'reactions.json');
    const existing = await loadJsonOptional(overlayPath) || {};
    const renamedExisting = renameOverlayKeys(existing);
    const merged = deepMergeOverlays(renamedExisting, localeOverlays[locale]);
    await saveJson(overlayPath, merged);
  }

  await saveJson(filePath, cleaned);
  console.log(`  reactions/reactions.json → reactions (bare title extracted, molecular[].name removed)`);
}

/** diagnostic/questions.json: bare options[].text */
async function handleDiagnosticQuestions() {
  const filePath = join(DATA_SRC, 'diagnostic', 'questions.json');
  if (!existsSync(filePath)) return;

  const data = await loadJson(filePath);
  const localeOverlays = {};
  const cleaned = [];

  for (const question of data) {
    const qKey = question.id;
    const { localeData, cleaned: cleanedQ } = extractLocaleFields(question);

    // Handle bare options[].text (Russian text)
    if (Array.isArray(cleanedQ.options)) {
      const optionTexts = {};
      cleanedQ.options = cleanedQ.options.map(opt => {
        if (opt.text) {
          optionTexts[opt.id] = { text: opt.text };
          return { ...opt };  // Keep text for now - it's plain text, may be locale-neutral
        }
        return opt;
      });
      // If options have text, record for ru overlay
      if (Object.keys(optionTexts).length > 0) {
        if (!localeData.ru) localeData.ru = {};
        localeData.ru.options = optionTexts;
      }
    }

    for (const [locale, fields] of Object.entries(localeData)) {
      if (Object.keys(fields).length === 0) continue;
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale][qKey] = fields;
    }

    cleaned.push(cleanedQ);
  }

  for (const locale of LOCALES) {
    if (!localeOverlays[locale] || Object.keys(localeOverlays[locale]).length === 0) continue;
    const overlayPath = join(TRANSLATIONS, locale, 'diagnostic_questions.json');
    const existing = await loadJsonOptional(overlayPath) || {};
    const renamedExisting = renameOverlayKeys(existing);
    const merged = deepMergeOverlays(renamedExisting, localeOverlays[locale]);
    await saveJson(overlayPath, merged);
  }

  await saveJson(filePath, cleaned);
  console.log(`  diagnostic/questions.json → diagnostic_questions`);
}

/** sources_list.json: has sources[]{source_id, title, description} */
async function handleSourcesList() {
  const filePath = join(DATA_SRC, 'sources_list.json');
  if (!existsSync(filePath)) return;

  const data = await loadJson(filePath);
  const localeOverlays = { ru: {} };
  const cleaned = { ...data };

  if (Array.isArray(data.sources)) {
    const cleanedSources = data.sources.map(src => {
      const s = { ...src };
      // Bare title/description are Russian → ru overlay
      if (s.title) {
        if (!localeOverlays.ru[s.source_id]) localeOverlays.ru[s.source_id] = {};
        localeOverlays.ru[s.source_id].title = s.title;
        delete s.title;
      }
      if (s.description) {
        if (!localeOverlays.ru[s.source_id]) localeOverlays.ru[s.source_id] = {};
        localeOverlays.ru[s.source_id].description = s.description;
        delete s.description;
      }
      return s;
    });
    cleaned.sources = cleanedSources;
  }

  if (Object.keys(localeOverlays.ru).length > 0) {
    const overlayPath = join(TRANSLATIONS, 'ru', 'sources_list.json');
    await saveJson(overlayPath, localeOverlays.ru);
  }

  await saveJson(filePath, cleaned);
  console.log(`  sources_list.json → sources_list (bare title/description extracted)`);
}

/** courses/*.json: single object with title_ru */
async function handleSingleObjectFile(relPath, overlayName) {
  const filePath = join(DATA_SRC, relPath);
  if (!existsSync(filePath)) return;

  const data = await loadJson(filePath);
  const { localeData, cleaned } = extractLocaleFields(data);

  for (const locale of LOCALES) {
    if (!localeData[locale] || Object.keys(localeData[locale]).length === 0) continue;
    const overlayPath = join(TRANSLATIONS, locale, `${overlayName}.json`);
    const existing = await loadJsonOptional(overlayPath) || {};
    const renamedExisting = renameOverlayKeys(existing);
    const merged = deepMergeOverlays(renamedExisting, localeData[locale]);
    await saveJson(overlayPath, merged);
  }

  await saveJson(filePath, cleaned);
  console.log(`  ${relPath} → ${overlayName}`);
}

// ---------------------------------------------------------------------------
// Process substances/ directory: individual files → aggregate overlay
// ---------------------------------------------------------------------------
async function processSubstances() {
  const { readdir } = await import('node:fs/promises');
  const subsDir = join(DATA_SRC, 'substances');
  const localeOverlays = {};
  let count = 0;

  const files = (await readdir(subsDir)).filter(f => f.endsWith('.json')).sort();
  for (const file of files) {
    const filePath = join(subsDir, file);
    const data = await loadJson(filePath);
    const substanceId = data.id;

    const { localeData, cleaned } = extractLocaleFields(data);
    await saveJson(filePath, cleaned);

    for (const [locale, fields] of Object.entries(localeData)) {
      if (Object.keys(fields).length === 0) continue;
      if (!localeOverlays[locale]) localeOverlays[locale] = {};
      localeOverlays[locale][substanceId] = fields;
    }
    count++;
  }

  // Write aggregate overlay files
  for (const locale of LOCALES) {
    if (!localeOverlays[locale] || Object.keys(localeOverlays[locale]).length === 0) continue;
    const overlayPath = join(TRANSLATIONS, locale, 'substances.json');
    const existing = await loadJsonOptional(overlayPath) || {};
    const renamedExisting = renameOverlayKeys(existing);
    const merged = deepMergeOverlays(renamedExisting, localeOverlays[locale]);
    await saveJson(overlayPath, merged);
  }

  console.log(`  substances/ (${count} files) → substances.json aggregate overlay`);
}

// ---------------------------------------------------------------------------
// Process theory_modules/ directory: one overlay per file
// Uses the specific overlay format expected by applyTheoryModuleOverlay:
// { sections: { [sectionId]: { title, blocks: [{...}] } } }
// Blocks array is positional, ox_rule blocks are omitted.
// ---------------------------------------------------------------------------

/** Extract _ru fields from a single block into overlay form (strips _ru suffix). */
function blockToOverlay(block) {
  const bo = {};
  for (const [key, val] of Object.entries(block)) {
    const parsed = parseLocaleSuffix(key);
    if (parsed && parsed.locale === 'ru') {
      bo[parsed.base] = val;
    }
  }
  return Object.keys(bo).length > 0 ? bo : null;
}

/** Remove all _ru/_en/_pl/_es fields from a block. */
function cleanBlock(block) {
  const cleaned = {};
  for (const [key, val] of Object.entries(block)) {
    if (!parseLocaleSuffix(key)) {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

/** Build theory module overlay in the format applyTheoryModuleOverlay expects. */
function buildTheoryModuleOverlay(module) {
  const sections = {};

  for (const section of module.sections || []) {
    const secOverlay = {};

    // Extract section title
    if (section.title_ru) secOverlay.title = section.title_ru;

    // Extract blocks (skip ox_rule, positional)
    const blockOverlays = [];
    for (const block of section.blocks || []) {
      if (block.t === 'ox_rule') continue; // applyTheoryModuleOverlay skips these
      const bo = blockToOverlay(block);
      blockOverlays.push(bo); // null = no overlay for this block
    }

    if (Object.keys(secOverlay).length > 0 || blockOverlays.some(b => b !== null)) {
      secOverlay.blocks = blockOverlays;
      sections[section.id] = secOverlay;
    }
  }

  return Object.keys(sections).length > 0 ? { sections } : null;
}

/** Clean a theory module: remove all _ru/_en/_pl/_es fields from sections/blocks. */
function cleanTheoryModule(module) {
  const cleaned = { ...module };

  cleaned.sections = (module.sections || []).map(section => {
    const { title_ru, ...rest } = section;
    return {
      ...rest,
      blocks: (section.blocks || []).map(cleanBlock),
    };
  });

  return cleaned;
}

async function processTheoryModules() {
  const { readdir } = await import('node:fs/promises');
  const dir = join(DATA_SRC, 'theory_modules');
  if (!existsSync(dir)) return;

  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  for (const file of files) {
    const filePath = join(dir, file);
    const data = await loadJson(filePath);

    // Build ru overlay in the format applyTheoryModuleOverlay expects
    const ruOverlay = buildTheoryModuleOverlay(data);
    if (ruOverlay) {
      const overlayPath = join(TRANSLATIONS, 'ru', 'theory_modules', file);
      await mkdir(dirname(overlayPath), { recursive: true });
      const existing = await loadJsonOptional(overlayPath) || {};
      // For theory modules, we replace (not merge) since structure is positional
      await saveJson(overlayPath, ruOverlay);
    }

    // Clean core module
    const cleaned = cleanTheoryModule(data);
    await saveJson(filePath, cleaned);
    console.log(`  theory_modules/${file} → translations/ru/theory_modules/${file}`);
  }
}

// ---------------------------------------------------------------------------
// Fix existing overlays that have _ru/_en etc. keys (rename them)
// ---------------------------------------------------------------------------
async function fixExistingOverlays() {
  const { readdir } = await import('node:fs/promises');
  let fixed = 0;

  for (const locale of LOCALES) {
    const localeDir = join(TRANSLATIONS, locale);
    if (!existsSync(localeDir)) continue;

    const processDir = async (dir, prefix = '') => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          const filePath = join(dir, entry.name);
          let data;
          try {
            data = await loadJson(filePath);
          } catch (e) {
            console.warn(`  WARN: skipping invalid JSON in ${locale}/${prefix}${entry.name}: ${e.message}`);
            continue;
          }
          const renamed = renameOverlayKeys(data);
          // Only write if something changed
          if (JSON.stringify(data) !== JSON.stringify(renamed)) {
            await saveJson(filePath, renamed);
            fixed++;
            console.log(`  Fixed overlay keys in ${locale}/${prefix}${entry.name}`);
          }
        } else if (entry.isDirectory()) {
          await processDir(join(dir, entry.name), prefix + entry.name + '/');
        }
      }
    };

    await processDir(localeDir);
  }

  if (fixed === 0) {
    console.log('  No existing overlay key renames needed.');
  } else {
    console.log(`  Fixed ${fixed} overlay files.`);
  }
}

// ---------------------------------------------------------------------------
// Final sweep: process any remaining locale fields in core data-src files
// ---------------------------------------------------------------------------

/** Generate a flat overlay name from a relative path */
function pathToOverlayName(relPath) {
  return relPath
    .replace(/^data-src\//, '')
    .replace(/\.json$/, '')
    .replace(/[\/\-]/g, '_')
    .replace(/^rules_/, '')
    .replace(/^exam_/, '');
}

async function finalSweep() {
  const { readdir } = await import('node:fs/promises');
  let processed = 0;

  const processFile = async (filePath, relToDataSrc) => {
    const text = await readFile(filePath, 'utf8');
    if (!/_ru"|_en"|_pl"|_es"/.test(text)) return; // no locale fields

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn(`  SKIP invalid JSON: ${relToDataSrc}`);
      return;
    }

    const overlayName = pathToOverlayName(relToDataSrc);
    const { localeData, cleaned } = extractLocaleFields(data);
    const hasLocaleData = Object.values(localeData).some(d => Object.keys(d).length > 0);
    if (!hasLocaleData) return;

    // Write overlays
    for (const locale of LOCALES) {
      if (!localeData[locale] || Object.keys(localeData[locale]).length === 0) continue;
      const overlayPath = join(TRANSLATIONS, locale, `${overlayName}.json`);
      const existing = await loadJsonOptional(overlayPath) || {};
      const renamedExisting = renameOverlayKeys(existing);
      const merged = deepMergeOverlays(renamedExisting, localeData[locale]);
      await saveJson(overlayPath, merged);
    }

    await saveJson(filePath, cleaned);
    processed++;
    console.log(`  SWEEP: ${relToDataSrc} → ${overlayName}`);
  };

  const walkDir = async (dir, baseRel) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const rel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
      if (entry.isFile() && entry.name.endsWith('.json')) {
        await processFile(fullPath, rel);
      } else if (entry.isDirectory() && entry.name !== 'translations') {
        await walkDir(fullPath, rel);
      }
    }
  };

  await walkDir(DATA_SRC, 'data-src');

  if (processed === 0) {
    console.log('  No remaining locale fields found.');
  } else {
    console.log(`  Swept ${processed} additional files.`);
  }
}

async function countRemainingLocaleFields() {
  const { readdir } = await import('node:fs/promises');
  let count = 0;

  const walkDir = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const text = await readFile(fullPath, 'utf8');
        const matches = text.match(/"[a-z_]*_(ru|en|pl|es)"/g);
        if (matches) count += matches.length;
      } else if (entry.isDirectory() && entry.name !== 'translations') {
        await walkDir(fullPath);
      }
    }
  };

  await walkDir(DATA_SRC);
  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Locale Pack Migration ===\n');

  // Step 1: Fix existing overlays (rename _ru/_en keys)
  console.log('Step 1: Fix existing overlay key names...');
  await fixExistingOverlays();
  console.log('');

  // Step 2: Process substances/ directory
  console.log('Step 2: Process substances/ directory...');
  await processSubstances();
  console.log('');

  // Step 3: Process theory_modules/ directory
  console.log('Step 3: Process theory_modules/ directory...');
  await processTheoryModules();
  console.log('');

  // Step 4: Process special files with custom handlers
  console.log('Step 4: Process special files...');
  await handleReactions();
  await handleDiagnosticQuestions();
  await handleSourcesList();
  await handleSingleObjectFile('courses/oge_inorganic_classification.json', 'oge_inorganic_classification');
  console.log('');

  // Step 5: Process mapped files
  console.log('Step 5: Process mapped files...');

  const CUSTOM_HANDLERS = {
    'element-groups.json': handleElementGroups,
    'topic_pages.json': handleTopicPages,
    'rules/ion_nomenclature.json': handleIonNomenclature,
    'dictionaries/exam_profiles.json': handleExamProfiles,
    'rules/calculations_data.json': handleCalculationsData,
    'rules/energy_catalyst_theory.json': handleEnergyCatalystTheory,
    'quantities_units_ontology.json': handleQuantitiesOntology,
    'rules/oxidation_theory.json': handleOxidationTheory,
    'rules/oxidation_rules.json': handleDictWithArrays,
    'rules/bond_theory.json': handleDictWithArrays,
    'rules/periodic-table-theory.json': handlePeriodicTableTheory,
    'periodic-table-content.json': handlePeriodicTableContent,
    'exercises/periodic-table-exercises.json': handleDictWithArrays,
    'exam/oge/meta.json': handleDictWithArrays,
    'exam/ege/meta.json': handleDictWithArrays,
    'exam/gcse/meta.json': handleDictWithArrays,
    'exam/egzamin/meta.json': handleDictWithArrays,
    'exam/ebau/meta.json': handleDictWithArrays,
    'exam/systems.json': handleDictWithArrays,
    'courses/oge_inorganic_classification.json': handleDictWithArrays,
  };

  // Skip files already handled (by step 4)
  const ALREADY_HANDLED = new Set([
    'reactions/reactions.json',
    'diagnostic/questions.json',
    'sources_list.json',
    'courses/oge_inorganic_classification.json',
  ]);

  for (const [relPath, { overlayName, keyField }] of Object.entries(FILE_MAPPING)) {
    if (ALREADY_HANDLED.has(relPath)) continue;

    const customHandler = CUSTOM_HANDLERS[relPath];

    if (keyField !== null && !customHandler) {
      await processArrayFile(relPath, overlayName, keyField);
    } else {
      await processComplexFile(relPath, overlayName, customHandler || null);
    }
  }
  console.log('');

  // Step 6: Final catch-all sweep for any remaining locale fields
  console.log('Step 6: Final catch-all sweep for remaining locale fields...');
  await finalSweep();
  console.log('');

  // Verify no _ru fields remain in core
  const remaining = await countRemainingLocaleFields();
  if (remaining > 0) {
    console.warn(`WARNING: ${remaining} locale field references still remain in core data-src/`);
  } else {
    console.log('✓ No locale-specific fields remain in core data-src/');
  }
  console.log('');

  console.log('=== Migration complete! ===\n');
  console.log('Next steps:');
  console.log('  1. Run: npm run validate:data');
  console.log('  2. Run: npm run build');
  console.log('  3. Run: npm test');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
