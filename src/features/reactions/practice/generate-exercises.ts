import type { ReactionTemplate } from '../../../types/templates';
import type { SolubilityEntry, ActivitySeriesEntry, ApplicabilityRule } from '../../../types/rules';
import type { Reaction } from '../../../types/reaction';

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

const TYPE_LABELS: Record<string, string> = {
  exchange: 'обмена',
  substitution: 'замещения',
  combination: 'соединения',
  decomposition: 'разложения',
};

const SOLUBILITY_LABELS: Record<string, string> = {
  soluble: 'Растворимое (Р)',
  insoluble: 'Нерастворимое (Н)',
  slightly_soluble: 'Малорастворимое (М)',
  decomposes: 'Разлагается водой',
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleOptions(options: ExerciseOption[]): ExerciseOption[] {
  return [...options].sort(() => Math.random() - 0.5);
}

type GeneratorFn = (
  templates: ReactionTemplate[],
  solubility: SolubilityEntry[],
  activitySeries: ActivitySeriesEntry[],
  applicabilityRules: ApplicabilityRule[],
  reactions: Reaction[],
) => Exercise;

/* ---- Distractor helpers for predict_exchange_products ---- */

/** Parse leading integer coefficient: "2KOH" → [2, "KOH"]; "NaCl" → [1, "NaCl"] */
function parseCoeff(s: string): [number, string] {
  const m = s.match(/^(\d+)(\D.*)$/);
  return m ? [parseInt(m[1], 10), m[2]] : [1, s];
}

function withCoeff(n: number, formula: string): string {
  return n === 1 ? formula : `${n}${formula}`;
}

/** Extract element symbols ("Ca", "O", "H") from a formula string */
function extractElements(s: string): Set<string> {
  return new Set(s.match(/[A-Z][a-z]?/g) ?? []);
}

function collectElements(formulas: string[]): Set<string> {
  const all = new Set<string>();
  for (const f of formulas) for (const el of extractElements(f)) all.add(el);
  return all;
}

/** Strategy 1: tweak coefficients (add / remove / change) */
function tweakCoefficients(products: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < products.length; i++) {
    const [c, f] = parseCoeff(products[i]);
    if (c > 1) {
      const v1 = [...products]; v1[i] = f; out.push(v1.join(' + '));
      const v2 = [...products]; v2[i] = withCoeff(c === 2 ? 3 : 2, f); out.push(v2.join(' + '));
    } else {
      const v1 = [...products]; v1[i] = `2${f}`; out.push(v1.join(' + '));
      const v2 = [...products]; v2[i] = `3${f}`; out.push(v2.join(' + '));
    }
  }
  return out;
}

/** Strategy 2: drop one product (multi-product reactions only) */
function dropOneProduct(products: string[]): string[] {
  if (products.length < 2) return [];
  return products.map((_, i) =>
    products.filter((__, j) => j !== i).join(' + '),
  );
}

/** Strategy 3: swap visually similar substances (common student confusions) */
const SIMILAR_SWAPS: [string, string][] = [
  ['H₂O', 'H₂↑'],
  ['CO₂↑', 'CO↑'],
  ['H₂SO₄', 'H₂SO₃'],
  ['SO₃', 'SO₂'],
];

function swapSimilar(products: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < products.length; i++) {
    const [c, f] = parseCoeff(products[i]);
    for (const [a, b] of SIMILAR_SWAPS) {
      if (f === a || f === b) {
        const swapped = f === a ? b : a;
        const v = [...products]; v[i] = withCoeff(c, swapped);
        out.push(v.join(' + '));
      }
    }
  }
  return out;
}

/** Strategy 4: add a plausible byproduct (for single-product reactions) */
const COMMON_BYPRODUCTS = ['H₂↑', 'H₂O', 'O₂↑'];

function addByproduct(products: string[], reactantElements: Set<string>): string[] {
  if (products.length > 1) return [];
  const out: string[] = [];
  const formula = parseCoeff(products[0])[1];

  const valid = COMMON_BYPRODUCTS.filter(bp =>
    bp !== formula && [...extractElements(bp)].every(el => reactantElements.has(el)),
  );

  for (const bp of valid) {
    const [c, f] = parseCoeff(products[0]);
    const base = c > 1 ? f : products[0];
    out.push(`${base} + ${bp}`);
  }
  return out;
}

/** Collect distractors built from the same elements as the correct answer */
function generateProductDistractors(products: string[], reactants: string[]): string[] {
  const correct = products.join(' + ');
  const seen = new Set<string>([correct]);
  const result: string[] = [];

  for (const arr of [
    tweakCoefficients(products),
    dropOneProduct(products),
    swapSimilar(products),
    addByproduct(products, collectElements(reactants)),
  ]) {
    for (const d of arr) {
      if (!seen.has(d)) { seen.add(d); result.push(d); }
    }
  }
  return result;
}

const generators: Record<string, GeneratorFn> = {
  classify_reaction_type(templates) {
    const t = pick(templates);
    const correctLabel = TYPE_LABELS[t.type] ?? t.type;
    const allTypes = Object.keys(TYPE_LABELS);
    const distractors = allTypes.filter(type => type !== t.type);

    const options = shuffleOptions([
      { id: 'correct', text: `Реакция ${correctLabel}` },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: `Реакция ${TYPE_LABELS[d]}` })),
    ]);

    return {
      type: 'classify_reaction_type',
      question: `К какому типу относится реакция: «${t.description_ru}»?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `Это реакция ${correctLabel}. Схема: ${t.pattern}.`,
      competencyMap: { reactions_exchange: 'P' },
    };
  },

  predict_exchange_products(templates) {
    const t = pick(templates);
    const example = pick(t.examples);
    const correctProducts = example.products.join(' + ');

    const candidates = generateProductDistractors(example.products, example.reactants);
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const distractors = shuffled.slice(0, 2);
    distractors.push('Реакция не идёт');

    const options = shuffleOptions([
      { id: 'correct', text: correctProducts },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'predict_exchange_products',
      question: `Какие продукты реакции ${example.reactants.join(' + ')}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${example.reactants.join(' + ')} → ${correctProducts}. Тип: ${t.description_ru}.`,
      competencyMap: { reactions_exchange: 'P' },
    };
  },

  identify_driving_force(templates) {
    // Pick an exchange template that demonstrates a driving force
    const exchangeTemplates = templates.filter(t => t.type === 'exchange');
    const t = pick(exchangeTemplates.length > 0 ? exchangeTemplates : templates);
    const example = pick(t.examples);
    const equation = `${example.reactants.join(' + ')} → ${example.products.join(' + ')}`;

    // Determine driving force from products
    const productsStr = example.products.join(' ');
    let correctForce: string;
    let explanation: string;
    if (productsStr.includes('↓') || productsStr.includes('↓')) {
      correctForce = 'Образование осадка';
      explanation = `В продуктах образуется осадок (↓).`;
    } else if (productsStr.includes('↑') || productsStr.includes('CO₂') || productsStr.includes('H₂S') || productsStr.includes('SO₂') || productsStr.includes('NH₃')) {
      correctForce = 'Выделение газа';
      explanation = `В продуктах выделяется газ (↑).`;
    } else if (productsStr.includes('H₂O') || productsStr.includes('вод')) {
      correctForce = 'Образование воды';
      explanation = `В продуктах образуется вода (слабый электролит).`;
    } else {
      correctForce = 'Образование воды';
      explanation = `Движущая сила — образование слабого электролита.`;
    }

    const allForces = ['Образование осадка', 'Выделение газа', 'Образование воды', 'Реакция не идёт'];
    const distractors = allForces.filter(f => f !== correctForce);

    const options = shuffleOptions([
      { id: 'correct', text: correctForce },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_driving_force',
      question: `Какая движущая сила реакции: ${equation}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation,
      competencyMap: { gas_precipitate_logic: 'P' },
    };
  },

  solubility_lookup(_templates, solubility, _activitySeries, _applicabilityRules, _reactions) {
    // Filter to standard cation+anion pairs (exclude extra anions like Br⁻, I⁻, F⁻)
    const mainAnions = new Set(['Cl⁻', 'SO₄²⁻', 'NO₃⁻', 'CO₃²⁻', 'PO₄³⁻', 'S²⁻', 'OH⁻', 'SiO₃²⁻']);
    const mainEntries = solubility.filter(e => mainAnions.has(e.anion));
    const entry = pick(mainEntries);
    const correctLabel = SOLUBILITY_LABELS[entry.solubility];

    const allSolLabels = Object.values(SOLUBILITY_LABELS);
    const distractors = allSolLabels.filter(l => l !== correctLabel);

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'solubility_lookup',
      question: `Какова растворимость соединения ${entry.cation} и ${entry.anion}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `Соединение ${entry.cation} + ${entry.anion} — ${correctLabel.toLowerCase()}.`,
      competencyMap: { gas_precipitate_logic: 'P' },
    };
  },

  will_reaction_occur(templates, solubility, _activitySeries, _applicabilityRules, _reactions) {
    // Pick an exchange reaction and determine if it produces precipitate/gas/water
    const exchangeTemplates = templates.filter(t => t.type === 'exchange');
    const t = pick(exchangeTemplates.length > 0 ? exchangeTemplates : templates);
    const example = pick(t.examples);
    const productsStr = example.products.join(' ');

    let correctAnswer: string;
    let explanation: string;
    if (productsStr.includes('↓')) {
      correctAnswer = 'Да, образуется осадок';
      explanation = `Реакция идёт, так как один из продуктов выпадает в осадок.`;
    } else if (productsStr.includes('↑') || productsStr.includes('CO₂')) {
      correctAnswer = 'Да, выделяется газ';
      explanation = `Реакция идёт, так как выделяется газ.`;
    } else if (productsStr.includes('H₂O')) {
      correctAnswer = 'Да, образуется вода';
      explanation = `Реакция идёт, так как образуется вода (слабый электролит).`;
    } else {
      correctAnswer = 'Да, образуется вода';
      explanation = `Реакция идёт с образованием слабого электролита.`;
    }

    const allAnswers = [
      'Да, образуется осадок',
      'Да, выделяется газ',
      'Да, образуется вода',
      'Нет, реакция не идёт',
    ];
    const distractors = allAnswers.filter(a => a !== correctAnswer);

    const options = shuffleOptions([
      { id: 'correct', text: correctAnswer },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'will_reaction_occur',
      question: `Пойдёт ли реакция ${example.reactants.join(' + ')}? Почему?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${example.reactants.join(' + ')} → ${example.products.join(' + ')}. ${explanation}`,
      competencyMap: { gas_precipitate_logic: 'P', reactions_exchange: 'S' },
    };
  },

  activity_series_compare(_templates, _solubility, activitySeries, _applicabilityRules, _reactions) {
    // Pick two metals and ask if one can displace the other
    const metals = activitySeries.filter(m => m.symbol !== 'H');
    const metal1 = pick(metals);
    const remaining = metals.filter(m => m.symbol !== metal1.symbol);
    const metal2 = pick(remaining);

    const canDisplace = metal1.position < metal2.position;
    const correctAnswer = canDisplace ? 'Да' : 'Нет';
    const explanation = canDisplace
      ? `${metal1.name_ru} (позиция ${metal1.position}) активнее ${metal2.name_ru} (позиция ${metal2.position}) в ряду активности, поэтому может вытеснить его из раствора соли.`
      : `${metal1.name_ru} (позиция ${metal1.position}) менее активен, чем ${metal2.name_ru} (позиция ${metal2.position}) в ряду активности, поэтому не может вытеснить его из раствора соли.`;

    const options = shuffleOptions([
      { id: 'correct', text: correctAnswer },
      { id: 'd0', text: canDisplace ? 'Нет' : 'Да' },
    ]);

    // Add two more options for 4 total
    options.push(
      { id: 'd1', text: 'Только при нагревании' },
      { id: 'd2', text: 'Только в присутствии катализатора' },
    );

    return {
      type: 'activity_series_compare',
      question: `Вытеснит ли ${metal1.name_ru} (${metal1.symbol}) металл ${metal2.name_ru} (${metal2.symbol}) из раствора его соли?`,
      format: 'multiple_choice',
      options: shuffleOptions(options),
      correctId: 'correct',
      explanation,
      competencyMap: { reactions_exchange: 'P' },
    };
  },

  match_ionic_equation(_templates, _solubility, _activitySeries, _applicabilityRules, reactions) {
    const withIonic = reactions.filter(r => r.ionic.net);
    if (withIonic.length < 4) throw new Error('Not enough reactions with ionic equations');

    const target = pick(withIonic);
    const correctNet = target.ionic.net!;

    const others = withIonic.filter(r => r.reaction_id !== target.reaction_id && r.ionic.net !== correctNet);
    const shuffledOthers = [...others].sort(() => Math.random() - 0.5);
    const distractorNets = shuffledOthers.slice(0, 2).map(r => r.ionic.net!);
    distractorNets.push('Реакция не идёт (ионное уравнение не составляется)');

    const options = shuffleOptions([
      { id: 'correct', text: correctNet },
      ...distractorNets.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'match_ionic_equation',
      question: `Сокращённое ионное уравнение для реакции: ${target.equation}`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `Полное ионное: ${target.ionic.full ?? '—'}. Сокращённое: ${correctNet}.${target.ionic.notes ? ' ' + target.ionic.notes : ''}`,
      competencyMap: { reactions_exchange: 'P' },
    };
  },

  identify_spectator_ions(_templates, _solubility, _activitySeries, _applicabilityRules, reactions) {
    const withBoth = reactions.filter(r => r.ionic.full && r.ionic.net);
    if (withBoth.length === 0) throw new Error('No reactions with full ionic equations');

    const target = pick(withBoth);
    const full = target.ionic.full!;
    const net = target.ionic.net!;

    // Extract ions from full that don't appear in net (spectators)
    const ionPattern = /[A-Z][a-z]?(?:[\d₀-₉]*)(?:[⁺⁻²³⁴]?[⁺⁻])/g;
    const fullIons = new Set(full.match(ionPattern) ?? []);
    const netIons = new Set(net.match(ionPattern) ?? []);
    const spectators = [...fullIons].filter(ion => !netIons.has(ion));

    if (spectators.length === 0) {
      // Fallback: use a different exercise type
      return generators.match_ionic_equation(_templates, _solubility, _activitySeries, _applicabilityRules, reactions);
    }

    const correctText = spectators.join(', ');

    const nonSpectators = [...netIons];
    const distractors: string[] = [];

    if (nonSpectators.length >= 1 && spectators.length >= 1) {
      distractors.push([nonSpectators[0], spectators[0]].join(', '));
    }
    if (nonSpectators.length >= 2) {
      distractors.push(nonSpectators.slice(0, 2).join(', '));
    }
    distractors.push('Ионов-наблюдателей нет');

    const options = shuffleOptions([
      { id: 'correct', text: correctText },
      ...distractors.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_spectator_ions',
      question: `Ионы-наблюдатели в реакции: ${target.equation}`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `Полное: ${full}. Сокращённое: ${net}. Ионы ${correctText} не изменились — они наблюдатели.`,
      competencyMap: { reactions_exchange: 'P', electrolyte_logic: 'S' },
    };
  },

  predict_observation(_templates, _solubility, _activitySeries, _applicabilityRules, reactions) {
    function describeObservation(r: Reaction): string {
      const parts: string[] = [];
      if (r.observations.precipitate?.length) {
        parts.push(`Выпадает осадок: ${r.observations.precipitate.join(', ')}`);
      }
      if (r.observations.gas?.length) {
        parts.push(`Выделяется газ: ${r.observations.gas.join(', ')}`);
      }
      if (r.observations.smell) {
        parts.push(r.observations.smell);
      }
      if (r.observations.color_change) {
        parts.push(r.observations.color_change);
      }
      if (parts.length === 0 && r.observations.heat) {
        parts.push(r.observations.heat);
      }
      if (parts.length === 0 && r.observations.other?.length) {
        parts.push(r.observations.other[0]);
      }
      return parts.join('; ') || 'Видимых признаков нет';
    }

    const target = pick(reactions);
    const correctObs = describeObservation(target);

    const others = reactions
      .filter(r => r.reaction_id !== target.reaction_id)
      .map(r => describeObservation(r))
      .filter(obs => obs !== correctObs && obs !== 'Видимых признаков нет');

    const uniqueOthers = [...new Set(others)].sort(() => Math.random() - 0.5);
    const distractors = uniqueOthers.slice(0, 2);
    distractors.push('Видимых признаков нет');

    const reactantNames = target.molecular.reactants
      .map(r => r.name ?? r.formula)
      .join(' и ');

    const options = shuffleOptions([
      { id: 'correct', text: correctObs },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'predict_observation',
      question: `Что наблюдается при смешивании ${reactantNames}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${target.equation}. ${correctObs}.`,
      competencyMap: { gas_precipitate_logic: 'P', qualitative_analysis_logic: 'S' },
    };
  },
};

const EXERCISE_TYPES = Object.keys(generators);

export function generateExercise(
  templates: ReactionTemplate[],
  solubility: SolubilityEntry[],
  activitySeries: ActivitySeriesEntry[],
  applicabilityRules: ApplicabilityRule[],
  reactions: Reaction[],
  type?: string,
): Exercise {
  // New generators require reactions; if none loaded, pick only from legacy types
  const availableTypes = reactions.length > 0
    ? EXERCISE_TYPES
    : EXERCISE_TYPES.filter(t => !['match_ionic_equation', 'identify_spectator_ions', 'predict_observation'].includes(t));
  const t = type ?? pick(availableTypes);
  const gen = generators[t];
  if (!gen) throw new Error(`Unknown exercise type: ${t}`);
  return gen(templates, solubility, activitySeries, applicabilityRules, reactions);
}
