import type { OntologyData, InteractionType, SlotValues } from './types';

/**
 * Generate plausible wrong answer options (distractors) for a task.
 *
 * Strategy is chosen based on context clues in slots, interaction type,
 * and the shape of the correct answer (in priority order):
 *
 *  1.  element compare (slots have elementA, elementB): other element + "одинаково" + "нельзя определить"
 *  2.  melting compare (slots have formulaA, formulaB, crystal_typeA): other formula + "одинаково" + "нельзя определить"
 *  3.  domain enum (answer matches a known domain like bond_type, crystal_type, etc.)
 *  4.  solubility (answer is "soluble"/"insoluble"): opposite + "slightly soluble" variants
 *  5.  activity series response (answer is 'yes'/'no' with metalA/metalB slots)
 *  6.  calculation multiplier (choice_single + numeric answer + M/composition slots)
 *  7.  numeric_input or numeric answer: nearby values (±1, ±2, ×2, ×0.5)
 *  8.  formula (slots have cation_id): swap subscripts, other anions from ontology
 *  9.  substance formula (slots have bond_type or substance_class): formulas from same data source
 *  10. electron config (answer contains orbital notation + Z slot)
 *  11. observation (slots have observation + target_ion, qualitative test context)
 *  12. chain substance (guided_selection + chain_substances slot)
 *  13. fallback: generic "wrong" options from ontology elements
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
  else if (typeof correctAnswer === 'string' && generateDomainEnumDistractors(correctAnswer, slots) !== null) {
    candidates = generateDomainEnumDistractors(correctAnswer, slots)!;
  }
  // 4. Solubility context
  else if (
    (slots.expected_solubility !== undefined || isSolubilityAnswer(correctAnswer)) &&
    typeof correctAnswer === 'string'
  ) {
    candidates = generateSolubilityDistractors(correctAnswer);
  }
  // 5. Activity series response context (yes/no with metal pair)
  else if (
    typeof correctAnswer === 'string' &&
    (correctAnswer === 'yes' || correctAnswer === 'no') &&
    slots.metalA !== undefined && slots.metalB !== undefined
  ) {
    candidates = generateActivityDistractors(correctAnswer);
  }
  // 6. Calculation multiplier context (choice_single + numeric + M/composition slots)
  else if (
    interaction === 'choice_single' &&
    (typeof correctAnswer === 'number' || isNumericString(correctAnswer)) &&
    hasCalculationSlots(slots)
  ) {
    candidates = generateCalculationMultiplierDistractors(correctAnswer);
  }
  // 7. Numeric context
  else if (interaction === 'numeric_input' || typeof correctAnswer === 'number') {
    candidates = generateNumericDistractors(correctAnswer);
  }
  // 8. Formula / ion context
  else if (slots.cation_id && typeof correctAnswer === 'string') {
    candidates = generateFormulaDistractors(correctAnswer, slots, data);
  }
  // 9. Substance formula context
  else if (
    (slots.bond_type || slots.substance_class) &&
    typeof correctAnswer === 'string'
  ) {
    candidates = generateSubstanceFormulaDistractors(correctAnswer, slots, data);
  }
  // 10. Electron config context
  else if (
    typeof correctAnswer === 'string' &&
    isElectronConfigAnswer(correctAnswer) &&
    slots.Z !== undefined
  ) {
    candidates = generateElectronConfigDistractors(correctAnswer, slots);
  }
  // 11. Observation context (qualitative test)
  else if (
    slots.observation !== undefined &&
    slots.target_ion !== undefined &&
    typeof correctAnswer === 'string'
  ) {
    candidates = generateObservationDistractors(correctAnswer, data);
  }
  // 12. Chain substance context (guided_selection + chain_substances)
  else if (
    interaction === 'guided_selection' &&
    slots.chain_substances !== undefined &&
    typeof correctAnswer === 'string'
  ) {
    candidates = generateChainSubstanceDistractors(correctAnswer, data);
  }
  // 13. Fallback
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

/** Check if value is a numeric string. */
function isNumericString(answer: string | number | string[]): boolean {
  if (typeof answer === 'number') return true;
  if (typeof answer !== 'string') return false;
  return !isNaN(Number(answer)) && answer.trim() !== '';
}

/** Check if slots contain calculation-related fields (M, mass, or composition). */
function hasCalculationSlots(slots: SlotValues): boolean {
  return slots.M !== undefined || slots.composition !== undefined;
}

/** Check if answer looks like an electron configuration string. */
function isElectronConfigAnswer(answer: string): boolean {
  // Must contain 's' (orbital letter) and at least one superscript digit
  const SUPERSCRIPT_DIGITS = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';
  const hasOrbitalLetter = answer.includes('s');
  const hasSuperscript = [...answer].some(ch => SUPERSCRIPT_DIGITS.includes(ch));
  return hasOrbitalLetter && hasSuperscript;
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

function generateDomainEnumDistractors(correctAnswer: string, slots?: SlotValues): string[] | null {
  // If slots contain a key matching a domain name, prefer that domain
  // (e.g., slots.crystal_type exists -> use crystal_type domain, not bond_type)
  if (slots) {
    for (const [domain, values] of Object.entries(DOMAIN_ENUMS)) {
      if (slots[domain] !== undefined && values.includes(correctAnswer)) {
        return values.filter(v => v !== correctAnswer);
      }
    }
  }
  // Fallback: first domain that contains the answer
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

// ── Strategy: activity series response ───────────────────────────

function generateActivityDistractors(correctAnswer: string): string[] {
  const candidates: string[] = [];
  if (correctAnswer === 'yes') {
    candidates.push('no');
  } else {
    candidates.push('yes');
  }
  candidates.push('only with heating');
  candidates.push('depends on concentration');
  return candidates;
}

// ── Strategy: calculation multiplier ─────────────────────────────

function generateCalculationMultiplierDistractors(
  correctAnswer: string | number | string[],
): string[] {
  const num = Number(correctAnswer);
  if (isNaN(num) || num === 0) return [];

  const multipliers = [0.5, 2, 0.8, 1.2, 1.5, 0.1, 10, 3];
  const candidates: string[] = [];

  for (const m of multipliers) {
    const val = num * m;
    const rounded = Math.round(val * 100) / 100;
    candidates.push(String(rounded));
  }

  return candidates;
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
    // Float-friendly: +-0.5, +-1, double, half
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
  const anions = data.core.ions.filter(i => i.type === 'anion');
  const currentAnionId = String(slots.anion_id ?? '');

  for (const an of anions) {
    if (an.id !== currentAnionId) {
      // Use the anion's base formula as a distractor
      candidates.push(stripCharge(an.formula));
    }
  }

  // Simple transformations on the correct formula
  // Swap a subscript 2->3, drop subscripts
  if (correctAnswer.length > 1) {
    candidates.push(correctAnswer.replace(/[\u2082]/g, '\u2083')); // 2->3
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

  if (slots.bond_type && data.rules.bondExamples?.examples) {
    for (const ex of data.rules.bondExamples.examples) {
      if (ex.formula !== correctAnswer) {
        candidates.push(ex.formula);
      }
    }
  }

  if (slots.substance_class && data.data.substances) {
    for (const s of data.data.substances) {
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

// ── Strategy: electron config ────────────────────────────────────

/** Unicode superscript digit map for electron config notation. */
const SUPERSCRIPT_DIGITS: Record<number, string> = {
  0: '\u2070', 1: '\u00b9', 2: '\u00b2', 3: '\u00b3',
  4: '\u2074', 5: '\u2075', 6: '\u2076', 7: '\u2077',
  8: '\u2078', 9: '\u2079',
};

/** Convert an integer to Unicode superscript string. */
function toSuperscript(n: number): string {
  return String(n).split('').map(d => SUPERSCRIPT_DIGITS[Number(d)] ?? d).join('');
}

/** Klechkowski filling order: [n, l_letter, capacity]. */
const KLECHKOWSKI_ORDER: [number, string, number][] = [
  [1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6],
  [4, 's', 2], [3, 'd', 10], [4, 'p', 6], [5, 's', 2], [4, 'd', 10],
  [5, 'p', 6], [6, 's', 2], [4, 'f', 14], [5, 'd', 10], [6, 'p', 6],
  [7, 's', 2], [5, 'f', 14], [6, 'd', 10], [7, 'p', 6],
];

/** Build electron config string for a given atomic number Z. */
function buildElectronConfig(Z: number): string {
  if (Z < 1) return '';
  let remaining = Z;
  const parts: string[] = [];

  for (const [n, l, capacity] of KLECHKOWSKI_ORDER) {
    if (remaining <= 0) break;
    const electrons = Math.min(remaining, capacity);
    parts.push(`${n}${l}${toSuperscript(electrons)}`);
    remaining -= electrons;
  }

  return parts.join(' ');
}

function generateElectronConfigDistractors(
  correctAnswer: string,
  slots: SlotValues,
): string[] {
  const Z = Number(slots.Z);
  if (!Number.isInteger(Z) || Z < 1) return [];

  const candidates: string[] = [];
  const offsets = [-1, 1, -2, 2];

  for (const off of offsets) {
    const adjZ = Z + off;
    if (adjZ >= 1) {
      const config = buildElectronConfig(adjZ);
      if (config && config !== correctAnswer) {
        candidates.push(config);
      }
    }
  }

  return candidates;
}

// ── Strategy: observation (qualitative test) ─────────────────────

function generateObservationDistractors(
  correctAnswer: string,
  data: OntologyData,
): string[] {
  const candidates: string[] = [];

  if (data.rules.qualitativeTests) {
    for (const test of data.rules.qualitativeTests) {
      if (test.observation_ru !== correctAnswer) {
        candidates.push(test.observation_ru);
      }
    }
  }

  // If no qualitative tests available, provide generic observation options
  if (candidates.length === 0) {
    const genericObservations = [
      'белый осадок',
      'голубой осадок',
      'жёлтый осадок',
      'выделение газа',
      'изменение цвета',
    ];
    for (const obs of genericObservations) {
      if (obs !== correctAnswer) {
        candidates.push(obs);
      }
    }
  }

  return candidates;
}

// ── Strategy: chain substance ────────────────────────────────────

function generateChainSubstanceDistractors(
  correctAnswer: string,
  data: OntologyData,
): string[] {
  const candidates: string[] = [];

  if (data.data.substances) {
    for (const s of data.data.substances) {
      if (s.formula !== correctAnswer) {
        candidates.push(s.formula);
      }
    }
  }

  // If no substance index, fall back to element symbols
  if (candidates.length === 0) {
    for (const el of data.core.elements) {
      if (el.symbol !== correctAnswer) {
        candidates.push(el.symbol);
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
  for (const el of data.core.elements) {
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
