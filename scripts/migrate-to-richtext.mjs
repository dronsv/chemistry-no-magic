#!/usr/bin/env node
/**
 * Migrate exam data files from plain text to RichText segments.
 *
 * Usage:
 *   node scripts/migrate-to-richtext.mjs --file data-src/exam/oge_tasks.json
 *   node scripts/migrate-to-richtext.mjs --file data-src/translations/ru/oge_tasks.json
 *   node scripts/migrate-to-richtext.mjs --all
 *   node scripts/migrate-to-richtext.mjs --dry-run --file data-src/exam/oge_tasks.json
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve, basename, dirname } from 'node:path';
import { textToRichText } from './lib/text-to-richtext.mjs';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');

// ---------------------------------------------------------------------------
// Formula lookup builder (mirrors generate-formula-lookup.mjs logic)
// ---------------------------------------------------------------------------

async function buildFormulaLookup() {
  const lookup = {};

  // 1. Substances (highest priority — typically longer formulas)
  const substDir = join(ROOT, 'data-src', 'substances');
  let substFiles;
  try {
    substFiles = await readdir(substDir);
  } catch {
    substFiles = [];
  }
  for (const f of substFiles) {
    if (!f.endsWith('.json')) continue;
    const data = JSON.parse(await readFile(join(substDir, f), 'utf-8'));
    if (data.formula && data.id) {
      lookup[data.formula] = { type: 'substance', id: data.id, cls: data.class };
    }
  }

  // 2. Ions (medium priority)
  try {
    const ions = JSON.parse(await readFile(join(ROOT, 'data-src', 'ions.json'), 'utf-8'));
    for (const ion of ions) {
      if (!lookup[ion.formula]) {
        lookup[ion.formula] = { type: 'ion', id: ion.id, ionType: ion.type };
      }
    }
  } catch { /* no ions file */ }

  // 3. Elements (lowest priority)
  try {
    const elements = JSON.parse(await readFile(join(ROOT, 'data-src', 'elements.json'), 'utf-8'));
    for (const el of elements) {
      if (!lookup[el.symbol]) {
        lookup[el.symbol] = { type: 'element', id: el.symbol, Z: el.Z };
      }
    }
  } catch { /* no elements file */ }

  return lookup;
}

// ---------------------------------------------------------------------------
// Known file schemas: which fields to convert
// ---------------------------------------------------------------------------

/**
 * Base OGE tasks (array of task objects).
 * Fields: options[].text, items[].text, left_items[].text
 */
function convertBaseTask(task, lookup, stats) {
  if (task.options) {
    for (const opt of task.options) {
      if (typeof opt.text === 'string') {
        const result = textToRichText(opt.text, lookup);
        stats.totalFields++;
        if (result !== opt.text) {
          opt.text = result;
          stats.convertedFields++;
        }
      }
    }
  }
  if (task.items) {
    for (const item of task.items) {
      if (typeof item.text === 'string') {
        const result = textToRichText(item.text, lookup);
        stats.totalFields++;
        if (result !== item.text) {
          item.text = result;
          stats.convertedFields++;
        }
      }
    }
  }
  if (task.left_items) {
    for (const li of task.left_items) {
      if (typeof li.text === 'string') {
        const result = textToRichText(li.text, lookup);
        stats.totalFields++;
        if (result !== li.text) {
          li.text = result;
          stats.convertedFields++;
        }
      }
    }
  }
}

/**
 * Translation overlay (object keyed by task_id).
 * Fields: {taskId}.question, .explanation, .context,
 *         .options[].text, .left_items[].text, .items[].text
 */
function convertOverlayEntry(entry, lookup, stats) {
  for (const field of ['question', 'explanation', 'context']) {
    if (typeof entry[field] === 'string') {
      const result = textToRichText(entry[field], lookup);
      stats.totalFields++;
      if (result !== entry[field]) {
        entry[field] = result;
        stats.convertedFields++;
      }
    }
  }
  for (const arrayField of ['options', 'items', 'left_items']) {
    if (Array.isArray(entry[arrayField])) {
      for (const item of entry[arrayField]) {
        if (typeof item.text === 'string') {
          const result = textToRichText(item.text, lookup);
          stats.totalFields++;
          if (result !== item.text) {
            item.text = result;
            stats.convertedFields++;
          }
        }
      }
    }
  }
}

/**
 * Detect file type from structure and apply conversions.
 * Returns stats about the conversion.
 */
function convertFile(data, lookup) {
  const stats = { totalFields: 0, convertedFields: 0 };

  if (Array.isArray(data)) {
    // Base tasks file (array of task objects)
    for (const task of data) {
      convertBaseTask(task, lookup, stats);
    }
  } else if (typeof data === 'object' && data !== null) {
    // Translation overlay (keyed by task_id)
    for (const key of Object.keys(data)) {
      const entry = data[key];
      if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
        convertOverlayEntry(entry, lookup, stats);
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Known files for --all mode
// ---------------------------------------------------------------------------

const KNOWN_FILES = [
  'data-src/exam/oge_tasks.json',
  'data-src/translations/ru/oge_tasks.json',
  'data-src/translations/en/oge_tasks.json',
  'data-src/translations/pl/oge_tasks.json',
  'data-src/translations/es/oge_tasks.json',
];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const all = args.includes('--all');
  const fileIdx = args.indexOf('--file');
  const singleFile = fileIdx >= 0 ? args[fileIdx + 1] : null;

  if (!all && !singleFile) {
    console.error('Usage: node scripts/migrate-to-richtext.mjs [--dry-run] (--file <path> | --all)');
    process.exit(1);
  }

  const files = all
    ? KNOWN_FILES.map(f => join(ROOT, f))
    : [resolve(ROOT, singleFile)];

  console.log('Building formula lookup...');
  const lookup = await buildFormulaLookup();
  console.log(`  ${Object.keys(lookup).length} formulas in lookup`);

  let totalStats = { totalFields: 0, convertedFields: 0, filesProcessed: 0 };

  for (const filePath of files) {
    let raw;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch (err) {
      console.warn(`  SKIP ${basename(filePath)}: ${err.message}`);
      continue;
    }

    const data = JSON.parse(raw);
    const stats = convertFile(data, lookup);

    console.log(`  ${basename(filePath)}: ${stats.totalFields} fields, ${stats.convertedFields} converted`);
    totalStats.totalFields += stats.totalFields;
    totalStats.convertedFields += stats.convertedFields;
    totalStats.filesProcessed++;

    if (!dryRun && stats.convertedFields > 0) {
      await writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
      console.log(`    -> written`);
    }
  }

  console.log('\nSummary:');
  console.log(`  Files processed: ${totalStats.filesProcessed}`);
  console.log(`  Total fields:    ${totalStats.totalFields}`);
  console.log(`  Converted:       ${totalStats.convertedFields}`);
  console.log(`  Unchanged:       ${totalStats.totalFields - totalStats.convertedFields}`);
  if (dryRun) {
    console.log('  (dry-run mode — no files written)');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
