import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generate concept_lookup.{locale}.json — maps surface forms to concept IDs.
 * Used by SmartText to detect concept terms in text.
 *
 * @param {object} concepts - concept registry (data-src/concepts.json)
 * @param {string} translationsDir - data-src/translations/
 * @param {string} outDir - bundle output directory
 * @param {string[]} locales - ['ru', 'en', 'pl', 'es']
 * @returns {Record<string, number>} locale → entry count
 */
export async function generateConceptLookups(concepts, translationsDir, outDir, locales) {
  const counts = {};
  for (const locale of locales) {
    const lookup = {};
    let overlay;
    try {
      const raw = await readFile(join(translationsDir, locale, 'concepts.json'), 'utf-8');
      overlay = JSON.parse(raw);
    } catch {
      counts[locale] = 0;
      continue;
    }

    for (const conceptId of Object.keys(concepts)) {
      const ov = overlay[conceptId];
      if (!ov) continue;

      // Add surface_forms
      if (ov.surface_forms) {
        for (const form of ov.surface_forms) {
          lookup[form.toLowerCase()] = conceptId;
        }
      }

      // Add all grammatical forms as surface forms too
      if (ov.forms) {
        for (const text of Object.values(ov.forms)) {
          lookup[text.toLowerCase()] = conceptId;
        }
      }
    }

    await writeFile(
      join(outDir, `concept_lookup.${locale}.json`),
      JSON.stringify(lookup, null, 0),
    );
    counts[locale] = Object.keys(lookup).length;
  }
  return counts;
}
