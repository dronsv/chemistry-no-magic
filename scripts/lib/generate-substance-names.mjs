/**
 * generate-substance-names.mjs
 *
 * Derives substance names from ion locale overlays using morphological rules.
 * Covers substances with exactly 2 ions (normal salts, acidic salts, hydroxides).
 *
 * Per-locale strategy:
 *   ru  — anion nominative (strip "-ион" from name) + cation.name_genitive
 *   en  — cation base (strip " ion") + anion base (strip " ion", lowercase)
 *   es  — Anion base + "de" + cation base  (strip "Ion " prefix)
 *   pl  — anion.salt_anion + cation.name_genitive  (explicit morphological fields)
 */

const LOCALES = ['ru', 'en', 'pl', 'es'];

/**
 * Identify which ion is cation and which is anion by ID convention.
 * IDs ending in "_plus" / "_2plus" / "_3plus" = cations; "_minus" / "_2minus" etc. = anions.
 */
function classifyIon(ionId) {
  if (/_plus$/.test(ionId) || /\d+plus$/.test(ionId)) return 'cation';
  if (/_minus$/.test(ionId) || /\d+minus$/.test(ionId)) return 'anion';
  return null;
}

/**
 * Build name for a single substance in a single locale.
 * Returns null if data is insufficient.
 */
function buildName(substance, ionOverlays, locale) {
  // Acids need special naming (e.g. "Sulfuric acid", not "Hydrogen sulfate") — skip.
  if (substance.class === 'acid') return null;

  const ions = substance.ions ?? [];
  if (ions.length !== 2) return null;

  const [id0, id1] = ions;
  const type0 = classifyIon(id0);
  const type1 = classifyIon(id1);

  if (!type0 || !type1 || type0 === type1) return null;

  const cationId = type0 === 'cation' ? id0 : id1;
  const anionId  = type0 === 'anion'  ? id0 : id1;

  const overlay = ionOverlays[locale] ?? {};
  const cation  = overlay[cationId];
  const anion   = overlay[anionId];

  if (!cation || !anion) return null;

  if (locale === 'ru') return buildRu(cation, anion);
  if (locale === 'en') return buildEn(cation, anion);
  if (locale === 'es') return buildEs(cation, anion);
  if (locale === 'pl') return buildPl(cation, anion);
  return null;
}

/** RU: "{Анион-nominative} {cation-genitive}"
 *  Anion nominative = name with trailing "-ион" stripped (e.g. "Хлорид-ион" → "Хлорид"). */
function buildRu(cation, anion) {
  const cationGen = cation.name_genitive;
  if (!cationGen) return null;

  const anionName = anion.name ?? '';
  // Strip "-ион" (with optional hyphen) from end
  const anionNom = anionName.replace(/-ион$/, '').trim();
  if (!anionNom || anionNom === anionName) return null; // didn't change → not an anion name

  return `${anionNom} ${cationGen}`;
}

/** EN: "{Cation-base} {anion-base}"
 *  Strip " ion" from both, lowercase anion. */
function buildEn(cation, anion) {
  const cationName = cation.name ?? '';
  const anionName  = anion.name ?? '';

  const cationBase = cationName.replace(/\s+ion$/i, '').trim();
  const anionBase  = anionName.replace(/\s+ion$/i, '').trim().toLowerCase();

  if (!cationBase || !anionBase) return null;
  return `${cationBase} ${anionBase}`;
}

/** ES: "{Anion-base} de {cation-base}"
 *  Strip leading "Ion " from both. Capitalize anion. */
function buildEs(cation, anion) {
  const cationName = cation.name ?? '';
  const anionName  = anion.name ?? '';

  const cationBase = cationName.replace(/^Ion\s+/i, '').trim();
  const anionBase  = anionName.replace(/^Ion\s+/i, '').trim();

  if (!cationBase || !anionBase) return null;

  const anionCap = anionBase.charAt(0).toUpperCase() + anionBase.slice(1);
  return `${anionCap} de ${cationBase}`;
}

/** PL: "{anion.salt_anion} {cation.name_genitive}" */
function buildPl(cation, anion) {
  const saltAnion = anion.salt_anion;
  const cationGen = cation.name_genitive;
  if (!saltAnion || !cationGen) return null;
  return `${saltAnion} ${cationGen}`;
}

/**
 * Generate substance names for all locales.
 *
 * @param {object[]} substances  - array of substance objects from data-src/substances/*.json
 * @param {object}   ionOverlays - { locale: { ionId: { name, name_genitive?, salt_anion?, ... } } }
 * @returns {{ locale: { substanceId: string } }} - generated names per locale
 */
export function generateSubstanceNames(substances, ionOverlays) {
  const result = Object.fromEntries(LOCALES.map(l => [l, {}]));

  for (const substance of substances) {
    const id = substance.id;
    if (!id) continue;

    for (const locale of LOCALES) {
      const name = buildName(substance, ionOverlays, locale);
      if (name) result[locale][id] = name;
    }
  }

  return result;
}
