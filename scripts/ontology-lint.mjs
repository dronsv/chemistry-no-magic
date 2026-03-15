#!/usr/bin/env node
/**
 * ontology-lint.mjs — CI lint script that validates referential integrity,
 * locale-free core compliance, and formula graph closure across the
 * chemistry ontology data files.
 *
 * Usage:  node scripts/ontology-lint.mjs
 * Exit:   0 on success, 1 if any errors found.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const DATA = path.join(ROOT, 'data-src');

// ── helpers ──────────────────────────────────────────────────────────────────

function readJSON(relPath) {
  const abs = path.join(DATA, relPath);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

/** Recursively list all .json files under `dir`, excluding `excludeDirs`. */
function walkJSON(dir, excludeDirs = []) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludeDirs.includes(entry.name)) {
        results.push(...walkJSON(full, []));
      }
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

/** Recursively collect all string values of a given key from any nested object/array. */
function collectFieldValues(obj, fieldName) {
  const values = [];
  if (obj == null || typeof obj !== 'object') return values;
  if (Array.isArray(obj)) {
    for (const item of obj) values.push(...collectFieldValues(item, fieldName));
  } else {
    for (const [k, v] of Object.entries(obj)) {
      if (k === fieldName && typeof v === 'string') values.push(v);
      if (typeof v === 'object' && v !== null) values.push(...collectFieldValues(v, fieldName));
    }
  }
  return values;
}

// ── load data ────────────────────────────────────────────────────────────────

const elements = readJSON('elements.json') || [];
const elementSymbols = new Set(elements.map(e => e.symbol));

const substanceFiles = fs.existsSync(path.join(DATA, 'substances'))
  ? fs.readdirSync(path.join(DATA, 'substances')).filter(f => f.endsWith('.json'))
  : [];
// Build substance ID set from actual id fields inside each file, plus
// a filename-based set (lowercase) as fallback for file-existence checks.
const substanceIds = new Set();
const substanceFileIds = new Set(substanceFiles.map(f => f.replace(/\.json$/, '')));
for (const f of substanceFiles) {
  try {
    const sub = JSON.parse(fs.readFileSync(path.join(DATA, 'substances', f), 'utf8'));
    if (sub.id) {
      // Store the raw suffix after "sub:" prefix
      const suffix = sub.id.startsWith('sub:') ? sub.id.slice(4) : sub.id;
      substanceIds.add(suffix);
    }
  } catch { /* skip unparseable files */ }
}
// Also add lowercase filename stems so refs like "sub:nacl" match "nacl.json"
for (const f of substanceFiles) {
  substanceIds.add(f.replace(/\.json$/, ''));
}

const quantOnt = readJSON('quantities_units_ontology.json');
const quantityIds = new Set((quantOnt?.quantities || []).map(q => q.id));
const unitIds = new Set((quantOnt?.units || []).map(u => u.id));

const constants = readJSON('foundations/constants.json') || [];
const constantIds = new Set(constants.map(c => c.id));

const formulas = readJSON('foundations/formulas.json') || [];
const formulaIds = new Set(formulas.map(f => f.id));

const substanceVariants = readJSON('contexts/substance_variants.json') || [];
const substanceVariantIds = new Set(substanceVariants.map(v => v.id));

const termBindings = readJSON('contexts/term_bindings.json') || [];

// ── state ────────────────────────────────────────────────────────────────────

let errors = 0;
let warnings = 0;

function error(msg) {
  console.log(`    \u274C ${msg}`);
  errors++;
}

function warn(msg) {
  console.log(`    \u26A0\uFE0F  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  \u2705 ${msg}`);
}

function fail(msg) {
  console.log(`  \u274C ${msg}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// A. Referential Integrity
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== A. Referential Integrity ===\n');

// A1. sub:* refs in term_bindings → must have matching substance file
{
  const sectionErrors = [];
  for (const tb of termBindings) {
    const ref = tb.ref;
    if (!ref) continue;
    if (ref.kind === 'substance' && typeof ref.id === 'string' && ref.id.startsWith('sub:')) {
      const subKey = ref.id.slice(4); // remove "sub:" prefix
      if (!substanceIds.has(subKey)) {
        sectionErrors.push(`term_bindings: ${tb.term_id} → ${ref.id} not found in substances/`);
      }
    }
  }
  if (sectionErrors.length === 0) {
    ok('sub:* refs in term_bindings → all resolve');
  } else {
    fail('sub:* refs in term_bindings');
    sectionErrors.forEach(e => error(e));
  }
}

// A2. sub:* refs in substance_variants (base.id) → must resolve
{
  const sectionErrors = [];
  for (const sv of substanceVariants) {
    const base = sv.base;
    if (!base || typeof base.id !== 'string') continue;
    if (base.id.startsWith('sub:')) {
      const subKey = base.id.slice(4);
      // Substance variants reference simple element substances (e.g., sub:C, sub:P)
      // which may be stored as single-element substance files
      if (!substanceIds.has(subKey)) {
        sectionErrors.push(`substance_variants: ${sv.id} → base ${base.id} not found in substances/`);
      }
    }
  }
  if (sectionErrors.length === 0) {
    ok('sub:* refs in substance_variants → all resolve');
  } else {
    fail('sub:* refs in substance_variants');
    sectionErrors.forEach(e => error(e));
  }
}

// A3. elem:* refs → must exist in elements.json by symbol
// Scan all JSON files for elem:* string values
{
  const sectionErrors = [];
  const allFiles = walkJSON(DATA, ['translations']);
  const elemRefPattern = /elem:([A-Z][a-z]?)/g;

  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = elemRefPattern.exec(content)) !== null) {
      const symbol = match[1];
      if (!elementSymbols.has(symbol)) {
        const relFile = path.relative(DATA, file);
        sectionErrors.push(`${relFile}: elem:${symbol} — symbol not found in elements.json`);
      }
    }
  }

  if (sectionErrors.length === 0) {
    ok('elem:* refs → all resolve to known element symbols');
  } else {
    fail('elem:* refs');
    // Deduplicate
    [...new Set(sectionErrors)].forEach(e => error(e));
  }
}

// A4. q:* refs in formulas/constants → must exist in quantities_units_ontology.json
{
  const sectionErrors = [];
  // From formulas
  for (const f of formulas) {
    for (const v of f.variables || []) {
      if (v.quantity && v.quantity.startsWith('q:') && !quantityIds.has(v.quantity)) {
        sectionErrors.push(`formulas: ${f.id} variable ${v.symbol} → ${v.quantity} not in ontology`);
      }
    }
  }
  // From constants
  for (const c of constants) {
    if (c.quantity && c.quantity.startsWith('q:') && !quantityIds.has(c.quantity)) {
      sectionErrors.push(`constants: ${c.id} → quantity ${c.quantity} not in ontology`);
    }
  }

  if (sectionErrors.length === 0) {
    ok('q:* refs in formulas/constants → all resolve');
  } else {
    fail('q:* refs in formulas/constants');
    [...new Set(sectionErrors)].forEach(e => error(e));
  }
}

// A5. unit:* refs in formulas/constants → must exist in quantities_units_ontology.json
{
  const sectionErrors = [];
  // From formulas
  for (const f of formulas) {
    for (const v of f.variables || []) {
      if (v.unit && v.unit.startsWith('unit:') && !unitIds.has(v.unit)) {
        sectionErrors.push(`formulas: ${f.id} variable ${v.symbol} → ${v.unit} not in ontology`);
      }
    }
  }
  // From constants
  for (const c of constants) {
    if (c.unit && c.unit.startsWith('unit:') && !unitIds.has(c.unit)) {
      sectionErrors.push(`constants: ${c.id} → unit ${c.unit} not in ontology`);
    }
  }

  if (sectionErrors.length === 0) {
    ok('unit:* refs in formulas/constants → all resolve');
  } else {
    fail('unit:* refs in formulas/constants');
    [...new Set(sectionErrors)].forEach(e => error(e));
  }
}

// A6. const:* refs in formulas → must exist in constants.json
{
  const sectionErrors = [];
  for (const f of formulas) {
    for (const cRef of f.constants_used || []) {
      if (cRef.startsWith('const:') && !constantIds.has(cRef)) {
        sectionErrors.push(`formulas: ${f.id} → ${cRef} not found in constants.json`);
      }
    }
    // Also check expression tree for const refs
    const constRefs = collectFieldValues(f.expression, 'ref');
    const inversionRefs = collectFieldValues(f.inversions, 'ref');
    for (const ref of [...constRefs, ...inversionRefs]) {
      if (ref.startsWith('const:') && !constantIds.has(ref)) {
        sectionErrors.push(`formulas: ${f.id} expression → ${ref} not found in constants.json`);
      }
    }
  }
  if (sectionErrors.length === 0) {
    ok('const:* refs in formulas → all resolve');
  } else {
    fail('const:* refs in formulas');
    [...new Set(sectionErrors)].forEach(e => error(e));
  }
}

// A7. formula:* refs (prerequisite_formulas) → must exist in formulas.json
{
  const sectionErrors = [];
  for (const f of formulas) {
    for (const prereq of f.prerequisite_formulas || []) {
      if (prereq.startsWith('formula:') && !formulaIds.has(prereq)) {
        sectionErrors.push(`formulas: ${f.id} → prerequisite ${prereq} not found`);
      }
    }
  }
  if (sectionErrors.length === 0) {
    ok('formula:* prerequisite refs → all resolve');
  } else {
    fail('formula:* prerequisite refs');
    [...new Set(sectionErrors)].forEach(e => error(e));
  }
}

// A8. term_bindings kind values → must be in allowed list
// (Handled in section B below)

// ══════════════════════════════════════════════════════════════════════════════
// B. Allowed Ref Kinds
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== B. Allowed Ref Kinds ===\n');

{
  const ALLOWED_KINDS = new Set([
    'substance', 'element', 'ion', 'context', 'context_template',
    'substance_variant', 'quantity', 'unit', 'formula', 'constant',
    'reaction', 'process', 'property', 'concept'
  ]);

  const sectionErrors = [];
  for (const tb of termBindings) {
    const kind = tb.ref?.kind;
    if (kind && !ALLOWED_KINDS.has(kind)) {
      sectionErrors.push(`term_bindings: ${tb.term_id} has unknown kind "${kind}"`);
    }
  }

  if (sectionErrors.length === 0) {
    ok(`All term_binding kinds are in allowed set (${ALLOWED_KINDS.size} kinds)`);
  } else {
    fail('Unknown term_binding kinds found');
    sectionErrors.forEach(e => error(e));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// C. No Legacy Localized Fields
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== C. No Legacy Localized Fields ===\n');

{
  // Match field names like "name_ru", "description_en", "title_pl", etc.
  // Pattern: any key ending in _(ru|en|pl|es) where the base looks like
  // a human-readable text field (contains lowercase letters, possibly underscores).
  const localeSuffixPattern = /^[a-z][a-z0-9_]*_(ru|en|pl|es)$/;

  /** Recursively check all keys in an object for locale-suffixed fields. */
  function findLocalizedKeys(obj, filePath, results) {
    if (obj == null || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const item of obj) findLocalizedKeys(item, filePath, results);
    } else {
      for (const key of Object.keys(obj)) {
        if (localeSuffixPattern.test(key)) {
          results.push({ file: filePath, key });
        }
        findLocalizedKeys(obj[key], filePath, results);
      }
    }
  }

  const allFiles = walkJSON(DATA, ['translations']);
  const violations = [];

  for (const file of allFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      findLocalizedKeys(data, path.relative(DATA, file), violations);
    } catch {
      // Skip files that can't be parsed
    }
  }

  if (violations.length === 0) {
    ok(`No legacy localized fields found (scanned ${allFiles.length} files, excluding translations/)`);
  } else {
    fail('Legacy localized fields found in core data');
    // Group by file
    const byFile = {};
    for (const v of violations) {
      if (!byFile[v.file]) byFile[v.file] = [];
      byFile[v.file].push(v.key);
    }
    for (const [file, keys] of Object.entries(byFile)) {
      error(`${file}: ${[...new Set(keys)].join(', ')}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// D. Formula Graph Closure
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== D. Formula Graph Closure ===\n');

{
  const missingQuantities = [];
  const missingUnits = [];

  // Check formulas.json variables
  for (const f of formulas) {
    for (const v of f.variables || []) {
      if (v.quantity && v.quantity.startsWith('q:') && !quantityIds.has(v.quantity)) {
        missingQuantities.push({ source: `formula ${f.id}`, ref: v.quantity });
      }
      if (v.unit && v.unit.startsWith('unit:') && !unitIds.has(v.unit)) {
        missingUnits.push({ source: `formula ${f.id}`, ref: v.unit });
      }
    }
  }

  // Check constants.json unit field
  for (const c of constants) {
    if (c.unit && c.unit.startsWith('unit:') && !unitIds.has(c.unit)) {
      missingUnits.push({ source: `constant ${c.id}`, ref: c.unit });
    }
    if (c.quantity && c.quantity.startsWith('q:') && !quantityIds.has(c.quantity)) {
      missingQuantities.push({ source: `constant ${c.id}`, ref: c.quantity });
    }
  }

  const allMissing = [...missingQuantities, ...missingUnits];
  if (allMissing.length === 0) {
    ok('Formula graph is closed — all q:* and unit:* refs exist in ontology');
  } else {
    fail('Formula graph has dangling references');
    for (const { source, ref } of missingQuantities) {
      error(`${source} → quantity ${ref} missing from ontology`);
    }
    for (const { source, ref } of missingUnits) {
      error(`${source} → unit ${ref} missing from ontology`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// E. Coverage Reports (warnings only)
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n=== E. Coverage Reports ===\n');

// E1. Substances with/without phase_standard
{
  let withPhase = 0;
  let withoutPhase = 0;
  const substDir = path.join(DATA, 'substances');

  if (fs.existsSync(substDir)) {
    for (const f of substanceFiles) {
      try {
        const sub = JSON.parse(fs.readFileSync(path.join(substDir, f), 'utf8'));
        if (!sub.id || !sub.id.startsWith('sub:')) continue; // skip meta-files
        if (sub.phase_standard) withPhase++;
        else withoutPhase++;
      } catch {
        // skip
      }
    }
  }

  const total = withPhase + withoutPhase;
  if (withoutPhase > 0) {
    warn(`phase_standard: ${withPhase}/${total} substances have it, ${withoutPhase} missing`);
  } else {
    ok(`phase_standard: all ${total} substances have it`);
  }
}

// E2. Morphology entries per locale vs total elements (118)
{
  const TOTAL_ELEMENTS = 118;
  const locales = ['ru', 'en', 'pl', 'es'];

  for (const locale of locales) {
    const morphPath = path.join(DATA, 'translations', locale, 'morphology.json');
    if (fs.existsSync(morphPath)) {
      try {
        const morph = JSON.parse(fs.readFileSync(morphPath, 'utf8'));
        const elemCount = morph.elements ? Object.keys(morph.elements).length : 0;
        if (elemCount < TOTAL_ELEMENTS) {
          warn(`morphology [${locale}]: ${elemCount}/${TOTAL_ELEMENTS} elements covered`);
        } else {
          ok(`morphology [${locale}]: ${elemCount}/${TOTAL_ELEMENTS} elements covered`);
        }
      } catch {
        warn(`morphology [${locale}]: file exists but could not be parsed`);
      }
    } else {
      warn(`morphology [${locale}]: file not found`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(60));
console.log(`\nSummary: ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}`);

if (errors > 0) {
  console.log('\nLint FAILED.\n');
  process.exit(1);
} else {
  console.log('\nLint PASSED.\n');
  process.exit(0);
}
