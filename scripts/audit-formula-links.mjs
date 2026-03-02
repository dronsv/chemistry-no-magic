#!/usr/bin/env node
/**
 * Audit script: find formula strings in data-src/ JSON files and check
 * whether they resolve to a known substance, element, or ion.
 *
 * Usage:
 *   node scripts/audit-formula-links.mjs           # full report
 *   node scripts/audit-formula-links.mjs --json     # machine-readable JSON
 *   node scripts/audit-formula-links.mjs --orphans  # only unresolved formulas
 *
 * Exit code: 0 if no orphans, 1 if orphans found (useful for CI).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DATA_SRC = join(ROOT, 'data-src');

// ---------------------------------------------------------------------------
// 1. Build formula → entity lookup
// ---------------------------------------------------------------------------

/** Normalize formula: strip Unicode sub/superscripts, coefficients, annotations, precipitate/gas arrows */
function normalize(formula) {
  return formula
    .replace(/[\u2080-\u2089]/g, ch => String(ch.charCodeAt(0) - 0x2080))  // ₀-₉ → 0-9
    .replace(/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]/g, '')               // superscripts → remove
    .replace(/[\u207A\u207B]/g, '')                                          // ⁺⁻ → remove
    .replace(/[\u2191\u2193↑↓]/g, '')                                        // ↑↓ (gas/precipitate) → remove
    .replace(/^\d+/, '')                                                     // leading coeff: "2HCl" → "HCl"
    .replace(/\(разб\.\)$/, '')                                              // "(разб.)" annotation
    .replace(/\(конц\.\)$/, '')                                              // "(конц.)" annotation
    .trim();
}

/**
 * Split a formula field that may contain multiple substances separated by " + ".
 * Returns array of individual formula strings.
 */
function splitFormulas(raw) {
  if (raw.includes(' + ')) {
    return raw.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean);
  }
  return [raw];
}

function loadJson(relPath) {
  return JSON.parse(readFileSync(join(DATA_SRC, relPath), 'utf-8'));
}

// --- Substances ---
const substanceDir = join(DATA_SRC, 'substances');
const substanceMap = new Map();   // normalizedFormula → { id, formula }
const substanceById = new Map();  // id → { id, formula }

for (const f of readdirSync(substanceDir)) {
  if (!f.endsWith('.json')) continue;
  const data = JSON.parse(readFileSync(join(substanceDir, f), 'utf-8'));
  const entry = { id: data.id, formula: data.formula, class: data.class };
  substanceMap.set(normalize(data.formula), entry);
  substanceById.set(data.id, entry);
}

// --- Elements ---
const elements = loadJson('elements.json');
const elementMap = new Map();  // symbol → { symbol, Z }
for (const el of elements) {
  elementMap.set(el.symbol, { symbol: el.symbol, Z: el.Z });
}

// --- Ions ---
const ions = loadJson('ions.json');
const ionMap = new Map();  // normalizedFormula → { id, formula, type }
for (const ion of ions) {
  ionMap.set(normalize(ion.formula), { id: ion.id, formula: ion.formula, type: ion.type });
}

// ---------------------------------------------------------------------------
// 2. Resolve a formula string
// ---------------------------------------------------------------------------

function resolve(rawFormula) {
  const norm = normalize(rawFormula);
  if (!norm || norm === '?' || norm === 'нагревание') return { status: 'skip', reason: 'not a formula' };

  const sub = substanceMap.get(norm);
  if (sub) return { status: 'substance', id: sub.id, formula: sub.formula, class: sub.class };

  const ion = ionMap.get(norm);
  if (ion) return { status: 'ion', id: ion.id, formula: ion.formula, type: ion.type };

  // Pure element symbol? (1-2 uppercase letters)
  if (elementMap.has(norm)) {
    return { status: 'element', symbol: norm, Z: elementMap.get(norm).Z };
  }

  return { status: 'orphan', normalized: norm };
}

// ---------------------------------------------------------------------------
// 3. Walk JSON files and extract formula fields
// ---------------------------------------------------------------------------

/**
 * Define where formulas live in each data file.
 * Each entry: { file, extractor(data) → [{ formula, context }] }
 */
const SCANNERS = [
  {
    file: 'rules/bond_examples.json',
    extract(data) {
      return data.examples.map(e => ({ formula: e.formula, context: `bond_type=${e.bond_type}` }));
    },
  },
  {
    file: 'rules/oxidation_examples.json',
    extract(data) {
      return data.map(e => ({
        formula: e.formula,
        context: `target=${e.target_element} ox=${e.oxidation_state}`,
      }));
    },
  },
  {
    file: 'rules/qualitative_reactions.json',
    extract(data) {
      return data.map(e => ({ formula: e.reagent_formula, context: `reagent for target=${e.target_id}` }));
    },
  },
  {
    file: 'rules/genetic_chains.json',
    extract(data) {
      const results = [];
      for (const chain of data) {
        for (const step of chain.steps) {
          results.push({ formula: step.substance, context: `chain=${chain.chain_id} substance` });
          results.push({ formula: step.next, context: `chain=${chain.chain_id} next` });
          results.push({ formula: step.reagent, context: `chain=${chain.chain_id} reagent` });
        }
      }
      return results;
    },
  },
  {
    file: 'rules/classification_rules.json',
    extract(data) {
      const results = [];
      for (const rule of data) {
        for (const formula of rule.examples) {
          results.push({ formula, context: `rule=${rule.id}` });
        }
      }
      return results;
    },
  },
  {
    file: 'rules/naming_rules.json',
    extract(data) {
      const results = [];
      for (const rule of data) {
        for (const ex of rule.examples) {
          results.push({ formula: ex.formula, context: `rule=${rule.id}` });
        }
      }
      return results;
    },
  },
  {
    file: 'rules/energy_catalyst_theory.json',
    extract(data) {
      return (data.common_catalysts ?? []).map(c => ({
        formula: c.catalyst,
        context: `catalyst for "${c.reaction_example_ru}"`,
      }));
    },
  },
  {
    file: 'templates/reaction_templates.json',
    extract(data) {
      const results = [];
      for (const tpl of data) {
        for (const ex of tpl.examples ?? []) {
          for (const f of ex.reactants ?? []) results.push({ formula: f, context: `template=${tpl.id} reactant` });
          for (const f of ex.products ?? []) results.push({ formula: f, context: `template=${tpl.id} product` });
        }
      }
      return results;
    },
  },
  {
    file: 'rules/ion_nomenclature.json',
    extract(data) {
      const results = [];
      for (const pair of data.acid_to_anion_pairs ?? []) {
        results.push({ formula: pair.acid, context: `acid_to_anion acid` });
      }
      return results;
    },
  },
];

// ---------------------------------------------------------------------------
// 4. Run audit
// ---------------------------------------------------------------------------

const flags = new Set(process.argv.slice(2));
const jsonMode = flags.has('--json');
const orphansOnly = flags.has('--orphans');

const report = [];
let totalFormulas = 0;
let totalOrphans = 0;
let totalSubstances = 0;
let totalElements = 0;
let totalIons = 0;
let totalSkipped = 0;

for (const scanner of SCANNERS) {
  let data;
  try {
    data = loadJson(scanner.file);
  } catch {
    if (!jsonMode) console.warn(`  [skip] ${scanner.file} — file not found`);
    continue;
  }

  const entries = scanner.extract(data);
  const fileReport = { file: scanner.file, entries: [] };

  for (const { formula, context } of entries) {
    // Split compound fields like "H₂O + O₂" into individual formulas
    const parts = splitFormulas(formula);
    for (const part of parts) {
      totalFormulas++;
      const result = resolve(part);

      const entry = { formula: part, context, ...result };
      if (parts.length > 1) entry.originalField = formula;
      fileReport.entries.push(entry);

      if (result.status === 'orphan') totalOrphans++;
      else if (result.status === 'substance') totalSubstances++;
      else if (result.status === 'element') totalElements++;
      else if (result.status === 'ion') totalIons++;
      else if (result.status === 'skip') totalSkipped++;
    }
  }

  report.push(fileReport);
}

// ---------------------------------------------------------------------------
// 5. Output
// ---------------------------------------------------------------------------

if (jsonMode) {
  const output = orphansOnly
    ? report.map(f => ({
        file: f.file,
        entries: f.entries.filter(e => e.status === 'orphan'),
      })).filter(f => f.entries.length > 0)
    : report;
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log('\n=== Formula Links Audit ===\n');
  console.log(`Known entities: ${substanceMap.size} substances, ${elementMap.size} elements, ${ionMap.size} ions\n`);

  for (const fileReport of report) {
    const orphans = fileReport.entries.filter(e => e.status === 'orphan');
    const substances = fileReport.entries.filter(e => e.status === 'substance');
    const elems = fileReport.entries.filter(e => e.status === 'element');
    const ionsMatched = fileReport.entries.filter(e => e.status === 'ion');
    const skipped = fileReport.entries.filter(e => e.status === 'skip');

    if (orphansOnly && orphans.length === 0) continue;

    console.log(`--- ${fileReport.file} ---`);
    console.log(`  Total: ${fileReport.entries.length}  |  Substance: ${substances.length}  |  Element: ${elems.length}  |  Ion: ${ionsMatched.length}  |  Skip: ${skipped.length}  |  Orphan: ${orphans.length}`);

    if (!orphansOnly) {
      for (const e of substances) {
        console.log(`  \x1b[32m[subst]\x1b[0m ${e.formula} → substance:${e.id} (${e.context})`);
      }
      for (const e of ionsMatched) {
        console.log(`  \x1b[34m[ion]\x1b[0m   ${e.formula} → ion:${e.id} (${e.context})`);
      }
      for (const e of elems) {
        console.log(`  \x1b[36m[elem]\x1b[0m  ${e.formula} → element:${e.symbol} Z=${e.Z} (${e.context})`);
      }
    }
    for (const e of orphans) {
      console.log(`  \x1b[31m[orphan]\x1b[0m ${e.formula} (normalized: ${e.normalized}) (${e.context})`);
    }
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Total formulas scanned: ${totalFormulas}`);
  console.log(`  Resolved to substance: ${totalSubstances}`);
  console.log(`  Resolved to element:   ${totalElements}`);
  console.log(`  Resolved to ion:       ${totalIons}`);
  console.log(`  Skipped (not formula): ${totalSkipped}`);
  console.log(`  \x1b[31mOrphans:                ${totalOrphans}\x1b[0m`);
  console.log(`\nKnown substances: ${substanceMap.size} | Orphan formulas: ${totalOrphans}`);

  if (totalOrphans > 0) {
    // Deduplicated orphan list
    const uniqueOrphans = new Map();
    for (const fr of report) {
      for (const e of fr.entries) {
        if (e.status === 'orphan' && !uniqueOrphans.has(e.normalized)) {
          uniqueOrphans.set(e.normalized, e.formula);
        }
      }
    }
    console.log(`\nUnique orphan formulas (${uniqueOrphans.size}):`);
    for (const [norm, raw] of [...uniqueOrphans].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${raw}${raw !== norm ? ` (norm: ${norm})` : ''}`);
    }
  }
}

process.exit(totalOrphans > 0 ? 1 : 0);
