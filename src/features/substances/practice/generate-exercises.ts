import type { ClassificationRule, NamingRule, SubstanceIndexEntry } from '../../../types/classification';

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

const CLASS_LABELS: Record<string, string> = {
  oxide: 'Оксид',
  acid: 'Кислота',
  base: 'Основание',
  salt: 'Соль',
};

const SUBCLASS_LABELS: Record<string, string> = {
  basic: 'основный',
  acidic: 'кислотный',
  amphoteric: 'амфотерный',
  indifferent: 'несолеобразующий',
  oxygen_containing: 'кислородсодержащая',
  oxygen_free: 'бескислородная',
  soluble: 'растворимое (щёлочь)',
  insoluble: 'нерастворимое',
  normal: 'средняя (нормальная)',
  acidic_salt: 'кислая',
  basic_salt: 'основная',
};

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

/** Collect all formula→name pairs from naming rules for distractor pool. */
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
) => Exercise;

const generators: Record<string, GeneratorFn> = {
  classify_by_formula(substances) {
    const pool = mainSubstances(substances);
    const s = pick(pool);
    const correctLabel = CLASS_LABELS[s.class] ?? s.class;
    const distractors = MAIN_CLASSES
      .filter(c => c !== s.class)
      .map(c => CLASS_LABELS[c]);
    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'classify_by_formula',
      question: `К какому классу относится ${s.formula}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${s.formula}${s.name_ru ? ` (${s.name_ru})` : ''} — это ${correctLabel.toLowerCase()}.`,
      competencyMap: { classification: 'P' },
    };
  },

  classify_subclass(substances, classRules) {
    // Pick a substance that has a class with multiple subclasses
    const pool = mainSubstances(substances);
    const s = pick(pool);
    const rulesForClass = classRules.filter(r => r.class === s.class);
    if (rulesForClass.length < 2) {
      // Fallback to classify_by_formula if not enough subclasses
      return generators.classify_by_formula(substances, classRules, []);
    }
    const matchingRule = rulesForClass.find(r => r.subclass === (substances.find(sub => sub.id === s.id) as SubstanceIndexEntry & { subclass?: string })?.class);
    // We need to find the substance's subclass from the full data — but index doesn't have it
    // So we match by checking which rule's examples contain this formula
    const correctRule = rulesForClass.find(r => r.examples.some(ex => ex === s.formula))
      ?? rulesForClass[0];
    const correctLabel = SUBCLASS_LABELS[correctRule.subclass] ?? correctRule.subclass;
    const distractorRules = rulesForClass.filter(r => r.id !== correctRule.id);
    const distractorLabels = distractorRules.map(r => SUBCLASS_LABELS[r.subclass] ?? r.subclass);

    // Ensure we have exactly 3 distractors
    while (distractorLabels.length < 3) {
      distractorLabels.push('несолеобразующий');
    }

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractorLabels.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'classify_subclass',
      question: `К какому подклассу относится ${s.formula}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${s.formula} — ${correctRule.description_ru}`,
      competencyMap: { classification: 'P' },
    };
  },

  identify_class_by_description(_substances, classRules) {
    const rule = pick(classRules);
    const correctLabel = `${CLASS_LABELS[rule.class] ?? rule.class} (${SUBCLASS_LABELS[rule.subclass] ?? rule.subclass})`;
    const otherRules = classRules.filter(r => r.id !== rule.id);
    const distractorRules = pickN(otherRules, 3);
    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractorRules.map((r, i) => ({
        id: `d${i}`,
        text: `${CLASS_LABELS[r.class] ?? r.class} (${SUBCLASS_LABELS[r.subclass] ?? r.subclass})`,
      })),
    ]);
    return {
      type: 'identify_class_by_description',
      question: `Какой класс/подкласс описывает следующее определение: «${rule.description_ru}»?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `Это ${correctLabel}. Примеры: ${rule.examples.join(', ')}.`,
      competencyMap: { classification: 'P' },
    };
  },

  formula_to_name(substances, _classRules, namingRules) {
    const examples = allNamingExamples(namingRules);
    // Pick a substance that has a name
    const named = mainSubstances(substances).filter(s => s.name_ru);
    if (named.length === 0) return generators.classify_by_formula(substances, _classRules, namingRules);
    const s = pick(named);
    const correctName = s.name_ru!;

    // Build distractors from naming examples of the same class
    const sameClassNames = examples
      .filter(ex => ex.name_ru !== correctName)
      .map(ex => ex.name_ru);
    const uniqueNames = [...new Set(sameClassNames)];
    const distractors = pickN(uniqueNames, 3);

    // Ensure 3 distractors
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
      question: `Как называется ${s.formula}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${s.formula} — ${correctName}.`,
      competencyMap: { naming: 'P', classification: 'S' },
    };
  },

  name_to_formula(substances, _classRules, namingRules) {
    const named = mainSubstances(substances).filter(s => s.name_ru);
    if (named.length === 0) return generators.classify_by_formula(substances, _classRules, namingRules);
    const s = pick(named);
    const correctFormula = s.formula;

    // Build distractors from same class substances
    const sameClass = mainSubstances(substances).filter(sub => sub.class === s.class && sub.formula !== correctFormula);
    let distractorFormulas = pickN(sameClass, 3).map(sub => sub.formula);

    // If not enough same-class, use other classes
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
      question: `Какая формула у вещества «${s.name_ru}»?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${s.name_ru} — ${correctFormula}.`,
      competencyMap: { naming: 'P', classification: 'S' },
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
      question: `По какому шаблону образовано название «${example.name_ru}» (${example.formula})?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${example.formula} (${example.name_ru}) — шаблон: «${correctTemplate}».`,
      competencyMap: { naming: 'P' },
    };
  },
};

const EXERCISE_TYPES = Object.keys(generators);

export function generateExercise(
  substances: SubstanceIndexEntry[],
  classificationRules: ClassificationRule[],
  namingRules: NamingRule[],
  type?: string,
): Exercise {
  const t = type ?? pick(EXERCISE_TYPES);
  const gen = generators[t];
  if (!gen) throw new Error(`Unknown exercise type: ${t}`);
  return gen(substances, classificationRules, namingRules);
}
