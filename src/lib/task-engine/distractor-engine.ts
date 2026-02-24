import type { OntologyData, InteractionType, SlotValues } from './types';

/**
 * Generate plausible wrong answer options (distractors) for a task.
 *
 * Strategy is chosen based on context clues in slots, interaction type,
 * and the shape of the correct answer (in priority order):
 *
 *  1. element compare (slots have elementA, elementB): other element + "одинаково" + "нельзя определить"
 *  2. melting compare (slots have formulaA, formulaB, crystal_typeA): other formula + "одинаково" + "нельзя определить"
 *  3. domain enum (answer matches a known domain like bond_type, crystal_type, etc.)
 *  4. solubility (answer is "soluble"/"insoluble"): opposite + "slightly soluble" variants
 *  5. numeric_input or numeric answer: nearby values (±1, ±2, ×2, ×0.5)
 *  6. formula (slots have cation_id): swap subscripts, other anions from ontology
 *  7. substance formula (slots have bond_type or substance_class): formulas from same data source
 *  8. fallback: generic "wrong" options from ontology elements
 *
 * Returned distractors never include the correct answer and are unique.
 */
export function generateDistractors(
  correctAnswer: string | number | string[],
  slots: SlotValues,
  interaction: InteractionType,
  data: OntologyData,
  count: number,
): string[] {
  const correctStr = Array.isArray(correctAnswer)
    ? correctAnswer.join(',')
    : String(correctAnswer);

  let candidates: string[];

  // 1. Element comparison context
  if (slots.elementA && slots.elementB && typeof correctAnswer === 'string') {
    candidates = generateElementCompareDistractors(correctAnswer, slots);
  }
  // 2. Melting point comparison context
  else if (
    slots.formulaA && slots.formulaB && slots.crystal_typeA &&
    typeof correctAnswer === 'string'
  ) {
    candidates = generateMeltingCompareDistractors(correctAnswer, slots);
  }
  // 3. Domain enum context
  else if (typeof correctAnswer === 'string' && generateDomainEnumDistractors(correctAnswer) !== null) {
    candidates = generateDomainEnumDistractors(correctAnswer)!;
  }
  // 4. Solubility context
  else if (
    (slots.expected_solubility !== undefined || isSolubilityAnswer(correctAnswer)) &&
    typeof correctAnswer === 'string'
  ) {
    candidates = generateSolubilityDistractors(correctAnswer);
  }
  // 5. Numeric context
  else if (interaction === 'numeric_input' || typeof correctAnswer === 'number') {
    candidates = generateNumericDistractors(correctAnswer);
  }
  // 6. Formula / ion context
  else if (slots.cation_id && typeof correctAnswer === 'string') {
    candidates = generateFormulaDistractors(correctAnswer, slots, data);
  }
  // 7. Substance formula context
  else if (
    (slots.bond_type || slots.substance_class) &&
    typeof correctAnswer === 'string'
  ) {
    candidates = generateSubstanceFormulaDistractors(correctAnswer, slots, data);
  }
  // 8. Fallback
  else {
    candidates = generateFallbackDistractors(correctAnswer, data);
  }

  // Deduplicate and remove correct answer
  const seen = new Set<string>([correctStr]);
  const result: string[] = [];
  for (const c of candidates) {
    if (!seen.has(c) && c !== '') {
      seen.add(c);
      result.push(c);
    }
    if (result.length >= count) break;
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────

function isSolubilityAnswer(answer: string | number | string[]): boolean {
  if (typeof answer !== 'string') return false;
  return ['soluble', 'insoluble', 'slightly_soluble', 'decomposes'].includes(answer);
}

// ── Strategy: element compare ────────────────────────────────────

function generateElementCompareDistractors(
  correctAnswer: string,
  slots: SlotValues,
): string[] {
  const a = String(slots.elementA);
  const b = String(slots.elementB);
  const other = correctAnswer === a ? b : a;
  return [other, 'одинаково', 'нельзя определить'];
}

// ── Strategy: melting point comparison ────────────────────────────

function generateMeltingCompareDistractors(
  correctAnswer: string,
  slots: SlotValues,
): string[] {
  const a = String(slots.formulaA);
  const b = String(slots.formulaB);
  const other = correctAnswer === a ? b : a;
  return [other, 'одинаково', 'нельзя определить'];
}

// ── Strategy: domain enum ────────────────────────────────────────

const DOMAIN_ENUMS: Record<string, string[]> = {
  bond_type: ['ionic', 'covalent_polar', 'covalent_nonpolar', 'metallic'],
  crystal_type: ['ionic', 'molecular', 'atomic', 'metallic'],
  substance_class: ['oxide', 'acid', 'base', 'salt'],
  reaction_type: ['exchange', 'substitution', 'decomposition', 'redox'],
};

function generateDomainEnumDistractors(correctAnswer: string): string[] | null {
  for (const values of Object.values(DOMAIN_ENUMS)) {
    if (values.includes(correctAnswer)) {
      return values.filter(v => v !== correctAnswer);
    }
  }
  return null;
}

// ── Strategy: solubility ─────────────────────────────────────────

function generateSolubilityDistractors(correctAnswer: string): string[] {
  const options = ['soluble', 'insoluble', 'slightly_soluble'];
  return options.filter(o => o !== correctAnswer);
}

// ── Strategy: numeric ────────────────────────────────────────────

function generateNumericDistractors(correctAnswer: string | number | string[]): string[] {
  const num = Number(correctAnswer);
  if (isNaN(num)) return [];

  const candidates: string[] = [];

  // Integer-friendly offsets for small integers (oxidation states, etc.)
  if (Number.isInteger(num)) {
    const offsets = [1, -1, 2, -2];
    for (const off of offsets) {
      candidates.push(String(num + off));
    }
    // Sign flip (for oxidation states)
    if (num !== 0) {
      candidates.push(String(-num));
    }
    candidates.push('0');
  } else {
    // Float-friendly: ±0.5, ±1, double, half
    candidates.push(String(num + 0.5));
    candidates.push(String(num - 0.5));
    candidates.push(String(num + 1));
    candidates.push(String(num - 1));
    if (num !== 0) {
      candidates.push(String(num * 2));
      candidates.push(String(num / 2));
    }
  }

  return candidates;
}

// ── Strategy: formula / ion ──────────────────────────────────────

function generateFormulaDistractors(
  correctAnswer: string,
  slots: SlotValues,
  data: OntologyData,
): string[] {
  const candidates: string[] = [];

  // Use other anions from the ontology to produce plausible wrong formulas
  const anions = data.ions.filter(i => i.type === 'anion');
  const currentAnionId = String(slots.anion_id ?? '');

  for (const an of anions) {
    if (an.id !== currentAnionId) {
      // Use the anion's base formula as a distractor
      candidates.push(stripCharge(an.formula));
    }
  }

  // Simple transformations on the correct formula
  // Swap a subscript 2→3, drop subscripts
  if (correctAnswer.length > 1) {
    candidates.push(correctAnswer.replace(/[\u2082]/g, '\u2083')); // 2→3
    candidates.push(correctAnswer.replace(/[\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089]/g, '')); // no subscripts
  }

  return candidates;
}

/**
 * Strip trailing Unicode superscript charge markers from an ion formula.
 */
const SUPERSCRIPT_CHARS = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u207a\u207b';

function stripCharge(formula: string): string {
  let end = formula.length;
  while (end > 0 && SUPERSCRIPT_CHARS.includes(formula[end - 1])) {
    end--;
  }
  return formula.slice(0, end);
}

// ── Strategy: substance formula ──────────────────────────────────

function generateSubstanceFormulaDistractors(
  correctAnswer: string,
  slots: SlotValues,
  data: OntologyData,
): string[] {
  const candidates: string[] = [];

  if (slots.bond_type && data.bondExamples?.examples) {
    for (const ex of data.bondExamples.examples) {
      if (ex.formula !== correctAnswer) {
        candidates.push(ex.formula);
      }
    }
  }

  if (slots.substance_class && data.substanceIndex) {
    for (const s of data.substanceIndex) {
      if (s.class !== slots.substance_class && s.formula !== correctAnswer) {
        candidates.push(s.formula);
      }
    }
  }

  // Shuffle (Fisher-Yates)
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates;
}

// ── Strategy: fallback ───────────────────────────────────────────

function generateFallbackDistractors(
  correctAnswer: string | number | string[],
  data: OntologyData,
): string[] {
  const correctStr = Array.isArray(correctAnswer)
    ? correctAnswer.join(',')
    : String(correctAnswer);

  // Pick element symbols that are not the correct answer
  const candidates: string[] = [];
  for (const el of data.elements) {
    if (el.symbol !== correctStr) {
      candidates.push(el.symbol);
    }
  }

  // Shuffle (Fisher-Yates)
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates;
}
