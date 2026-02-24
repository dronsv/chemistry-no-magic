import * as m from '../../../paraglide/messages.js';
import type { ClassificationRule, NamingRule, SubstanceIndexEntry } from '../../../types/classification';
import type { Element } from '../../../types/element';

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

function classLabel(cls: string): string {
  const labels: Record<string, () => string> = {
    oxide: m.sub_ex_class_oxide,
    acid: m.sub_ex_class_acid,
    base: m.sub_ex_class_base,
    salt: m.sub_ex_class_salt,
  };
  return labels[cls]?.() ?? cls;
}

function subclassLabel(sub: string): string {
  const labels: Record<string, () => string> = {
    basic: m.sub_ex_subclass_basic,
    acidic: m.sub_ex_subclass_acidic,
    amphoteric: m.sub_ex_subclass_amphoteric,
    indifferent: m.sub_ex_subclass_indifferent,
    oxygen_containing: m.sub_ex_subclass_oxygen_containing,
    oxygen_free: m.sub_ex_subclass_oxygen_free,
    soluble: m.sub_ex_subclass_soluble,
    insoluble: m.sub_ex_subclass_insoluble,
    normal: m.sub_ex_subclass_normal,
    acidic_salt: m.sub_ex_subclass_acidic_salt,
    basic_salt: m.sub_ex_subclass_basic_salt,
  };
  return labels[sub]?.() ?? sub;
}

const MAIN_CLASSES = ['oxide', 'acid', 'base', 'salt'];

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

/** Substances from the 4 main classes (exclude "other" like NH3). */
function mainSubstances(substances: SubstanceIndexEntry[]): SubstanceIndexEntry[] {
  return substances.filter(s => MAIN_CLASSES.includes(s.class));
}

/** Collect all formula->name pairs from naming rules for distractor pool. */
function allNamingExamples(namingRules: NamingRule[]): Array<{ formula: string; name_ru: string }> {
  const examples: Array<{ formula: string; name_ru: string }> = [];
  for (const rule of namingRules) {
    for (const ex of rule.examples) {
      examples.push(ex);
    }
  }
  return examples;
}

type GeneratorFn = (
  substances: SubstanceIndexEntry[],
  classRules: ClassificationRule[],
  namingRules: NamingRule[],
  elements: Element[],
) => Exercise;

const generators: Record<string, GeneratorFn> = {
  classify_by_formula(substances) {
    const pool = mainSubstances(substances);
    const s = pick(pool);
    const correctLbl = classLabel(s.class);
    const distractors = MAIN_CLASSES
      .filter(c => c !== s.class)
      .map(c => classLabel(c));
    const options = shuffleOptions([
      { id: 'correct', text: correctLbl },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'classify_by_formula',
      question: m.sub_ex_q_class({ formula: s.formula }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.sub_ex_a_class({ formula: s.formula, name: s.name_ru ? ` (${s.name_ru})` : '', label: correctLbl.toLowerCase() }),
      competencyMap: { classification: 'P' },
    };
  },

  classify_subclass(substances, classRules) {
    const pool = mainSubstances(substances).filter(s => s.subclass);
    if (pool.length === 0) return generators.classify_by_formula(substances, classRules, [], []);
    const s = pick(pool);
    const rulesForClass = classRules.filter(r => r.class === s.class);
    if (rulesForClass.length < 2) {
      return generators.classify_by_formula(substances, classRules, [], []);
    }

    const correctLbl = subclassLabel(s.subclass!);
    const distractorRules = rulesForClass.filter(r => r.subclass !== s.subclass);
    const distractorLabels = distractorRules.map(r => subclassLabel(r.subclass));

    while (distractorLabels.length < 3) {
      distractorLabels.push(subclassLabel('indifferent'));
    }

    const matchingRule = rulesForClass.find(r => r.subclass === s.subclass) ?? rulesForClass[0];
    const options = shuffleOptions([
      { id: 'correct', text: correctLbl },
      ...distractorLabels.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'classify_subclass',
      question: m.sub_ex_q_subclass({ formula: s.formula }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.sub_ex_a_subclass({ formula: s.formula, desc: matchingRule.description_ru }),
      competencyMap: { classification: 'P' },
    };
  },

  identify_class_by_description(_substances, classRules) {
    const rule = pick(classRules);
    const correctLbl = `${classLabel(rule.class)} (${subclassLabel(rule.subclass)})`;
    const otherRules = classRules.filter(r => r.id !== rule.id);
    const distractorRules = pickN(otherRules, 3);
    const options = shuffleOptions([
      { id: 'correct', text: correctLbl },
      ...distractorRules.map((r, i) => ({
        id: `d${i}`,
        text: `${classLabel(r.class)} (${subclassLabel(r.subclass)})`,
      })),
    ]);
    return {
      type: 'identify_class_by_description',
      question: m.sub_ex_q_class_by_desc({ desc: rule.description_ru }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.sub_ex_a_class_by_desc({ label: correctLbl, examples: rule.examples.join(', ') }),
      competencyMap: { classification: 'P' },
    };
  },

  formula_to_name(substances, _classRules, namingRules) {
    const examples = allNamingExamples(namingRules);
    const named = mainSubstances(substances).filter(s => s.name_ru);
    if (named.length === 0) return generators.classify_by_formula(substances, _classRules, namingRules, []);
    const s = pick(named);
    const correctName = s.name_ru!;

    const sameClassNames = examples
      .filter(ex => ex.name_ru !== correctName)
      .map(ex => ex.name_ru);
    const uniqueNames = [...new Set(sameClassNames)];
    const distractors = pickN(uniqueNames, 3);

    while (distractors.length < 3) {
      const fallback = pick(examples.filter(ex => ex.name_ru !== correctName && !distractors.includes(ex.name_ru)));
      if (fallback) distractors.push(fallback.name_ru);
      else break;
    }

    const options = shuffleOptions([
      { id: 'correct', text: correctName },
      ...distractors.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'formula_to_name',
      question: m.sub_ex_q_name({ formula: s.formula }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.sub_ex_a_name({ formula: s.formula, name: correctName }),
      competencyMap: { naming: 'P', classification: 'S' },
    };
  },

  name_to_formula(substances, _classRules, namingRules) {
    const named = mainSubstances(substances).filter(s => s.name_ru);
    if (named.length === 0) return generators.classify_by_formula(substances, _classRules, namingRules, []);
    const s = pick(named);
    const correctFormula = s.formula;

    const sameClass = mainSubstances(substances).filter(sub => sub.class === s.class && sub.formula !== correctFormula);
    let distractorFormulas = pickN(sameClass, 3).map(sub => sub.formula);

    if (distractorFormulas.length < 3) {
      const others = mainSubstances(substances).filter(sub => sub.formula !== correctFormula && !distractorFormulas.includes(sub.formula));
      distractorFormulas = [...distractorFormulas, ...pickN(others, 3 - distractorFormulas.length).map(sub => sub.formula)];
    }

    const options = shuffleOptions([
      { id: 'correct', text: correctFormula },
      ...distractorFormulas.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'name_to_formula',
      question: m.sub_ex_q_formula({ name: s.name_ru! }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.sub_ex_a_formula({ name: s.name_ru!, formula: correctFormula }),
      competencyMap: { naming: 'P', classification: 'S' },
    };
  },

  identify_amphoteric(substances, classRules) {
    const amphotericPool = mainSubstances(substances).filter(
      s => s.subclass === 'amphoteric' && (s.class === 'oxide' || s.class === 'base'),
    );
    if (amphotericPool.length === 0) return generators.classify_by_formula(substances, classRules, [], []);
    const correct = pick(amphotericPool);

    const nonAmphoteric = mainSubstances(substances).filter(
      s => s.subclass !== 'amphoteric' && (s.class === 'oxide' || s.class === 'base'),
    );
    const distractors = pickN(nonAmphoteric, 3);

    if (distractors.length < 3) {
      const others = mainSubstances(substances).filter(
        s => s.formula !== correct.formula && !distractors.some(d => d.formula === s.formula),
      );
      distractors.push(...pickN(others, 3 - distractors.length));
    }

    const options = shuffleOptions([
      { id: 'correct', text: correct.formula },
      ...distractors.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d.formula })),
    ]);
    return {
      type: 'identify_amphoteric',
      question: m.sub_ex_q_amphoteric(),
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: m.sub_ex_a_amphoteric({ formula: correct.formula, name: correct.name_ru ? ` (${correct.name_ru})` : '' }),
      competencyMap: { amphoterism_logic: 'P', classification: 'S' },
    };
  },

  amphoteric_reaction_partner(substances, classRules) {
    const amphotericPool = mainSubstances(substances).filter(
      s => s.subclass === 'amphoteric' && (s.class === 'oxide' || s.class === 'base'),
    );
    if (amphotericPool.length === 0) return generators.classify_by_formula(substances, classRules, [], []);
    const s = pick(amphotericPool);

    const options = shuffleOptions([
      { id: 'correct', text: m.sub_ex_both_acids_bases() },
      { id: 'd0', text: m.sub_ex_only_acids() },
      { id: 'd1', text: m.sub_ex_only_bases() },
      { id: 'd2', text: m.sub_ex_neither() },
    ]);
    return {
      type: 'amphoteric_reaction_partner',
      question: m.sub_ex_q_amphoteric_partner({ formula: s.formula }),
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: m.sub_ex_a_amphoteric_partner({ formula: s.formula }),
      competencyMap: { amphoterism_logic: 'P' },
    };
  },

  amphoteric_elements(_substances, _classRules, _namingRules, elements) {
    const amphotericMetals = elements
      .filter(e => e.amphoteric)
      .map(e => e.symbol);
    const nonAmphotericMetals = elements
      .filter(e => e.metal_type === 'metal' && !e.amphoteric)
      .map(e => e.symbol);
    const correct = pick(amphotericMetals);
    const distractors = pickN(nonAmphotericMetals, 3);

    const options = shuffleOptions([
      { id: 'correct', text: correct },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'amphoteric_elements',
      question: m.sub_ex_q_amphoteric_element(),
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: m.sub_ex_a_amphoteric_element({ symbol: correct }),
      competencyMap: { amphoterism_logic: 'P', classification: 'S' },
    };
  },

  naming_rule_template(_substances, _classRules, namingRules) {
    const rule = pick(namingRules);
    const example = pick(rule.examples);
    const correctTemplate = rule.template_ru;

    const otherRules = namingRules.filter(r => r.id !== rule.id && r.template_ru !== correctTemplate);
    const distractorTemplates = pickN(otherRules, 3).map(r => r.template_ru);

    const options = shuffleOptions([
      { id: 'correct', text: correctTemplate },
      ...distractorTemplates.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'naming_rule_template',
      question: m.sub_ex_q_naming_rule({ name: example.name_ru, formula: example.formula }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.sub_ex_a_naming_rule({ formula: example.formula, name: example.name_ru, template: correctTemplate }),
      competencyMap: { naming: 'P' },
    };
  },
};

const EXERCISE_TYPES = Object.keys(generators);

export function generateExercise(
  substances: SubstanceIndexEntry[],
  classificationRules: ClassificationRule[],
  namingRules: NamingRule[],
  elements: Element[] = [],
  type?: string,
): Exercise {
  const t = type ?? pick(EXERCISE_TYPES);
  const gen = generators[t];
  if (!gen) throw new Error(`Unknown exercise type: ${t}`);
  return gen(substances, classificationRules, namingRules, elements);
}
