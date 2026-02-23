import * as m from '../../../paraglide/messages.js';
import type { Ion } from '../../../types/ion';
import type { IonNomenclatureRules } from '../../../types/ion-nomenclature';

export interface ExerciseOption {
  id: string;
  text: string;
}

export interface Exercise {
  type: string;
  question: string;
  format: 'multiple_choice';
  options: ExerciseOption[];
  correctId: string;
  explanation: string;
  competencyMap: Record<string, 'P' | 'S'>;
}

export interface GeneratorContext {
  ions: Ion[];
  nomenclatureRules: IonNomenclatureRules;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function shuffleOptions(options: ExerciseOption[]): ExerciseOption[] {
  return [...options].sort(() => Math.random() - 0.5);
}

/** Get anions that have naming data */
function namedAnions(ions: Ion[]): Ion[] {
  return ions.filter(i => i.type === 'anion' && i.naming);
}

/**
 * Pick N unique distractors from a pool, excluding a given correct value.
 * Returns up to N items (fewer if pool is too small).
 */
function pickDistractors(pool: string[], correct: string, n: number): string[] {
  const unique = [...new Set(pool.filter(v => v !== correct))];
  return pickN(unique, n);
}

/**
 * Build full suffix label including prefix when present.
 * E.g. "пер-...-ат" for permanganate, "-ат" for sulfate.
 */
function fullSuffixLabel(ion: Ion): string {
  const naming = ion.naming!;
  if (naming.prefix_ru) {
    return `${naming.prefix_ru}..${naming.suffix_ru}`;
  }
  return naming.suffix_ru;
}

// ---------------------------------------------------------------------------
// Generator 1: formulaToName
// ---------------------------------------------------------------------------

function formulaToName(ctx: GeneratorContext): Exercise {
  const anions = namedAnions(ctx.ions);
  const ion = pick(anions);
  const correctName = ion.name_ru;

  const distractors = pickDistractors(
    anions.map(a => a.name_ru),
    correctName,
    3,
  );

  const options = shuffleOptions([
    { id: 'correct', text: correctName },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'formula_to_name',
    question: m.ion_ex_formula_to_name({ formula: ion.formula }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `${ion.formula} — ${ion.name_ru}. ${ion.naming!.derivation_ru ?? ''}`.trim(),
    competencyMap: { ion_nomenclature: 'P' },
  };
}

// ---------------------------------------------------------------------------
// Generator 2: nameToFormula
// ---------------------------------------------------------------------------

function nameToFormula(ctx: GeneratorContext): Exercise {
  const anions = namedAnions(ctx.ions);
  const ion = pick(anions);
  const correctFormula = ion.formula;

  const distractors = pickDistractors(
    anions.map(a => a.formula),
    correctFormula,
    3,
  );

  const options = shuffleOptions([
    { id: 'correct', text: correctFormula },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'name_to_formula',
    question: m.ion_ex_name_to_formula({ name: ion.name_ru }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `${ion.name_ru} — ${ion.formula}`,
    competencyMap: { ion_nomenclature: 'P' },
  };
}

// ---------------------------------------------------------------------------
// Generator 3: suffixRule
// ---------------------------------------------------------------------------

function suffixRule(_ctx: GeneratorContext): Exercise {
  const acidTypes = [
    { key: 'binary', label: () => m.ion_ex_acid_type_binary(), suffix: '-ид' },
    { key: 'oxy_max', label: () => m.ion_ex_acid_type_oxy_max(), suffix: '-ат' },
    { key: 'oxy_lower', label: () => m.ion_ex_acid_type_oxy_lower(), suffix: '-ит' },
  ] as const;

  const chosen = pick([...acidTypes]);
  const correctSuffix = chosen.suffix;

  const allSuffixes = ['-ид', '-ат', '-ит', 'пер-...-ат'];
  const distractors = pickDistractors(allSuffixes, correctSuffix, 3);

  const options = shuffleOptions([
    { id: 'correct', text: correctSuffix },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'suffix_rule',
    question: m.ion_ex_suffix_rule({ acidType: chosen.label() }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `${chosen.label()} → суффикс ${correctSuffix}`,
    competencyMap: { ion_nomenclature: 'P', naming: 'S' },
  };
}

// ---------------------------------------------------------------------------
// Generator 4: acidToAnion
// ---------------------------------------------------------------------------

function acidToAnion(ctx: GeneratorContext): Exercise {
  const pairs = ctx.nomenclatureRules.acid_to_anion_pairs;
  const pair = pick(pairs);
  const anion = ctx.ions.find(i => i.id === pair.anion_id);
  if (!anion) throw new Error(`Anion ${pair.anion_id} not found`);

  const correctName = anion.name_ru;
  const anions = namedAnions(ctx.ions);
  const distractors = pickDistractors(
    anions.map(a => a.name_ru),
    correctName,
    3,
  );

  const options = shuffleOptions([
    { id: 'correct', text: correctName },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'acid_to_anion',
    question: m.ion_ex_acid_to_anion({ acid: pair.acid_name_ru, formula: pair.acid }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `${pair.acid_name_ru} (${pair.acid}) → ${anion.name_ru} (${anion.formula})`,
    competencyMap: { ion_nomenclature: 'P' },
  };
}

// ---------------------------------------------------------------------------
// Generator 5: anionToAcid
// ---------------------------------------------------------------------------

function anionToAcid(ctx: GeneratorContext): Exercise {
  const pairs = ctx.nomenclatureRules.acid_to_anion_pairs;
  const pair = pick(pairs);
  const anion = ctx.ions.find(i => i.id === pair.anion_id);
  if (!anion) throw new Error(`Anion ${pair.anion_id} not found`);

  const correctAcid = pair.acid_name_ru;
  const distractors = pickDistractors(
    pairs.map(p => p.acid_name_ru),
    correctAcid,
    3,
  );

  const options = shuffleOptions([
    { id: 'correct', text: correctAcid },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'anion_to_acid',
    question: m.ion_ex_anion_to_acid({ name: anion.name_ru }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `${anion.name_ru} (${anion.formula}) ← ${pair.acid_name_ru} (${pair.acid})`,
    competencyMap: { ion_nomenclature: 'P' },
  };
}

// ---------------------------------------------------------------------------
// Generator 6: ateItePair
// ---------------------------------------------------------------------------

function ateItePair(ctx: GeneratorContext): Exercise {
  const anions = namedAnions(ctx.ions);
  const pairedAnions = anions.filter(a => a.naming!.pair_id);
  if (pairedAnions.length < 2) throw new Error('Need at least 2 paired ions for ateItePair');

  const ion = pick(pairedAnions);
  const pairIon = ctx.ions.find(i => i.id === ion.naming!.pair_id);
  if (!pairIon) throw new Error(`Pair ion ${ion.naming!.pair_id} not found`);

  const correctName = pairIon.name_ru;
  const distractors = pickDistractors(
    anions.map(a => a.name_ru),
    correctName,
    3,
  );
  // Also exclude the source ion from distractors
  const filteredDistractors = distractors.filter(d => d !== ion.name_ru).slice(0, 3);
  while (filteredDistractors.length < 3) {
    const fallback = anions.find(
      a => a.name_ru !== correctName && a.name_ru !== ion.name_ru && !filteredDistractors.includes(a.name_ru),
    );
    if (fallback) filteredDistractors.push(fallback.name_ru);
    else break;
  }

  const options = shuffleOptions([
    { id: 'correct', text: correctName },
    ...filteredDistractors.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'ate_ite_pair',
    question: m.ion_ex_ate_ite_pair({ name: ion.name_ru, suffix: ion.naming!.suffix_ru }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `${ion.name_ru} (${ion.naming!.suffix_ru}) ↔ ${pairIon.name_ru} (${pairIon.naming?.suffix_ru ?? ''})`,
    competencyMap: { ion_nomenclature: 'P' },
  };
}

// ---------------------------------------------------------------------------
// Generator 7: oxidationStateToSuffix
// ---------------------------------------------------------------------------

function oxidationStateToSuffix(ctx: GeneratorContext): Exercise {
  const anions = namedAnions(ctx.ions);
  // Filter to oxyacid anions (oxidation_state > 0)
  const oxyAnions = anions.filter(a => a.naming!.oxidation_state > 0);
  if (oxyAnions.length < 2) throw new Error('Need at least 2 oxyacid anions for oxidationStateToSuffix');

  const ion = pick(oxyAnions);
  const naming = ion.naming!;
  const correctSuffix = fullSuffixLabel(ion);
  const elementName = naming.root_ru;

  const allSuffixes = ['-ид', '-ат', '-ит', 'пер-...-ат', 'гипо-...-ит'];
  const distractors = pickDistractors(allSuffixes, correctSuffix, 3);

  const options = shuffleOptions([
    { id: 'correct', text: correctSuffix },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'oxidation_state_to_suffix',
    question: m.ion_ex_ox_to_suffix({ element: elementName, ox: `+${naming.oxidation_state}` }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `${elementName} в СО +${naming.oxidation_state} → ${ion.name_ru} (${correctSuffix})`,
    competencyMap: { ion_nomenclature: 'P', oxidation_states: 'S' },
  };
}

// ---------------------------------------------------------------------------
// Generator 8: classifySuffixType
// ---------------------------------------------------------------------------

function classifySuffixType(ctx: GeneratorContext): Exercise {
  const anions = namedAnions(ctx.ions);
  const ion = pick(anions);
  const correctSuffix = fullSuffixLabel(ion);

  const allSuffixes = ['-ид', '-ат', '-ит', 'пер-...-ат', 'гипо-...-ит'];
  const distractors = pickDistractors(allSuffixes, correctSuffix, 3);

  const options = shuffleOptions([
    { id: 'correct', text: correctSuffix },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'classify_suffix_type',
    question: m.ion_ex_classify_suffix({ name: ion.name_ru }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `${ion.name_ru} → суффикс ${correctSuffix}`,
    competencyMap: { ion_nomenclature: 'P' },
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

type GeneratorFn = (ctx: GeneratorContext) => Exercise;

const generators: GeneratorFn[] = [
  formulaToName,
  nameToFormula,
  suffixRule,
  acidToAnion,
  anionToAcid,
  ateItePair,
  oxidationStateToSuffix,
  classifySuffixType,
];

export function generateExercise(ctx: GeneratorContext): Exercise {
  const anions = namedAnions(ctx.ions);
  if (anions.length < 4) throw new Error('Need at least 4 named anions');

  // Filter to generators that can produce exercises with current data
  const MAX_RETRIES = 3;
  for (let i = 0; i < MAX_RETRIES; i++) {
    const gen = pick(generators);
    try {
      return gen(ctx);
    } catch {
      // Generator can't work with current data, try another
    }
  }
  // Fallback to simplest generator
  return formulaToName(ctx);
}
