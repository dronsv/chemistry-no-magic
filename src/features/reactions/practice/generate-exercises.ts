import type { ReactionTemplate } from '../../../types/templates';
import type { SolubilityEntry, ActivitySeriesEntry, ApplicabilityRule } from '../../../types/rules';
import type { Reaction } from '../../../types/reaction';
import type { QualitativeTest } from '../../../types/qualitative';
import type { GeneticChain } from '../../../types/genetic-chain';
import type { EnergyCatalystTheory } from '../../../types/energy-catalyst';

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
  templates: ReactionTemplate[];
  solubility: SolubilityEntry[];
  activitySeries: ActivitySeriesEntry[];
  applicabilityRules: ApplicabilityRule[];
  reactions: Reaction[];
  qualitativeTests: QualitativeTest[];
  geneticChains: GeneticChain[];
  energyCatalystTheory: EnergyCatalystTheory | null;
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

type GeneratorFn = (ctx: GeneratorContext) => Exercise;

/* ---- Distractor helpers for predict_exchange_products ---- */

function parseCoeff(s: string): [number, string] {
  const m = s.match(/^(\d+)(\D.*)$/);
  return m ? [parseInt(m[1], 10), m[2]] : [1, s];
}

function withCoeff(n: number, formula: string): string {
  return n === 1 ? formula : `${n}${formula}`;
}

function extractElements(s: string): Set<string> {
  return new Set(s.match(/[A-Z][a-z]?/g) ?? []);
}

function collectElements(formulas: string[]): Set<string> {
  const all = new Set<string>();
  for (const f of formulas) for (const el of extractElements(f)) all.add(el);
  return all;
}

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

function dropOneProduct(products: string[]): string[] {
  if (products.length < 2) return [];
  return products.map((_, i) =>
    products.filter((__, j) => j !== i).join(' + '),
  );
}

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
  classify_reaction_type(ctx) {
    const t = pick(ctx.templates);
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

  predict_exchange_products(ctx) {
    const t = pick(ctx.templates);
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

  identify_driving_force(ctx) {
    const exchangeTemplates = ctx.templates.filter(t => t.type === 'exchange');
    const t = pick(exchangeTemplates.length > 0 ? exchangeTemplates : ctx.templates);
    const example = pick(t.examples);
    const equation = `${example.reactants.join(' + ')} → ${example.products.join(' + ')}`;

    const productsStr = example.products.join(' ');
    let correctForce: string;
    let explanation: string;
    if (productsStr.includes('↓')) {
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

  solubility_lookup(ctx) {
    const mainAnions = new Set(['Cl⁻', 'SO₄²⁻', 'NO₃⁻', 'CO₃²⁻', 'PO₄³⁻', 'S²⁻', 'OH⁻', 'SiO₃²⁻']);
    const mainEntries = ctx.solubility.filter(e => mainAnions.has(e.anion));
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

  will_reaction_occur(ctx) {
    const exchangeTemplates = ctx.templates.filter(t => t.type === 'exchange');
    const t = pick(exchangeTemplates.length > 0 ? exchangeTemplates : ctx.templates);
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

  activity_series_compare(ctx) {
    const metals = ctx.activitySeries.filter(m => m.symbol !== 'H');
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
      competencyMap: { reactions_redox: 'P' },
    };
  },

  match_ionic_equation(ctx) {
    const withIonic = ctx.reactions.filter(r => r.ionic.net);
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

  identify_spectator_ions(ctx) {
    const withBoth = ctx.reactions.filter(r => r.ionic.full && r.ionic.net);
    if (withBoth.length === 0) throw new Error('No reactions with full ionic equations');

    const target = pick(withBoth);
    const full = target.ionic.full!;
    const net = target.ionic.net!;

    const ionPattern = /[A-Z][a-z]?(?:[\d₀-₉]*)(?:[⁺⁻²³⁴]?[⁺⁻])/g;
    const fullIons = new Set(full.match(ionPattern) ?? []);
    const netIons = new Set(net.match(ionPattern) ?? []);
    const spectators = [...fullIons].filter(ion => !netIons.has(ion));

    if (spectators.length === 0) {
      return generators.match_ionic_equation(ctx);
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

  predict_observation(ctx) {
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

    const target = pick(ctx.reactions);
    const correctObs = describeObservation(target);

    const others = ctx.reactions
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
      competencyMap: { qualitative_analysis_logic: 'P', gas_precipitate_logic: 'S' },
    };
  },

  /* ---- Redox generators ---- */

  identify_oxidizer_reducer(ctx) {
    const redoxRxns = ctx.reactions.filter(r => r.redox);
    if (redoxRxns.length === 0) throw new Error('No redox reactions');

    const target = pick(redoxRxns);
    const redox = target.redox!;

    // Ask about either oxidizer or reducer randomly
    const askOxidizer = Math.random() < 0.5;
    const role = askOxidizer ? 'окислителем' : 'восстановителем';
    const correct = askOxidizer ? redox.oxidizer.formula : redox.reducer.formula;
    const wrong = askOxidizer ? redox.reducer.formula : redox.oxidizer.formula;

    // Collect all unique formulas from reactants and products for distractors
    const allFormulas = [
      ...target.molecular.reactants.map(r => r.formula),
      ...target.molecular.products.map(r => r.formula),
    ];
    const otherFormulas = [...new Set(allFormulas)].filter(f => f !== correct && f !== wrong);
    const distractors = [wrong, ...otherFormulas.slice(0, 1), 'Это не ОВР'];

    const options = shuffleOptions([
      { id: 'correct', text: correct },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_oxidizer_reducer',
      question: `В реакции ${target.equation} ${role} является...?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${redox.electron_transfer.replace(/\n/g, '; ')}`,
      competencyMap: { reactions_redox: 'P', oxidation_states: 'S' },
    };
  },

  predict_substitution_products(ctx) {
    const redoxRxns = ctx.reactions.filter(r => r.redox && r.type_tags.includes('substitution'));
    if (redoxRxns.length === 0) throw new Error('No substitution redox reactions');

    const target = pick(redoxRxns);
    const correctProducts = target.molecular.products
      .map(p => `${p.coeff > 1 ? p.coeff : ''}${p.formula}`)
      .join(' + ');

    // Build distractors: swap products, wrong product, no reaction
    const otherRxns = redoxRxns.filter(r => r.reaction_id !== target.reaction_id);
    const distractors: string[] = [];

    if (otherRxns.length > 0) {
      const other = pick(otherRxns);
      distractors.push(
        other.molecular.products.map(p => `${p.coeff > 1 ? p.coeff : ''}${p.formula}`).join(' + '),
      );
    }

    // Reversed products
    const reversed = [...target.molecular.products].reverse()
      .map(p => `${p.coeff > 1 ? p.coeff : ''}${p.formula}`)
      .join(' + ');
    if (reversed !== correctProducts) distractors.push(reversed);

    distractors.push('Реакция не идёт');

    const reactantStr = target.molecular.reactants
      .map(r => `${r.coeff > 1 ? r.coeff : ''}${r.formula}`)
      .join(' + ');

    const options = shuffleOptions([
      { id: 'correct', text: correctProducts },
      ...distractors.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'predict_substitution_products',
      question: `Что образуется при реакции ${reactantStr}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${target.equation}`,
      competencyMap: { reactions_redox: 'P' },
    };
  },

  will_metal_react(ctx) {
    const metals = ctx.activitySeries.filter(m => m.symbol !== 'H');
    if (metals.length < 2) throw new Error('Not enough metals in activity series');

    // Pick a "less active" metal as the one in solution, and a random metal to test
    const metal1 = pick(metals);
    const remaining = metals.filter(m => m.symbol !== metal1.symbol);
    const metal2 = pick(remaining);

    // metal1 tries to displace metal2 from its salt solution
    const canReact = metal1.position < metal2.position;
    const correctAnswer = canReact
      ? `Да, ${metal1.symbol} активнее ${metal2.symbol}`
      : `Нет, ${metal1.symbol} менее активен, чем ${metal2.symbol}`;

    const wrongAnswer = canReact
      ? `Нет, ${metal1.symbol} менее активен, чем ${metal2.symbol}`
      : `Да, ${metal1.symbol} активнее ${metal2.symbol}`;

    const options = shuffleOptions([
      { id: 'correct', text: correctAnswer },
      { id: 'd0', text: wrongAnswer },
      { id: 'd1', text: 'Реакция идёт только при нагревании' },
      { id: 'd2', text: 'Оба металла одинаково активны' },
    ]);

    return {
      type: 'will_metal_react',
      question: `Будет ли реагировать ${metal1.name_ru} (${metal1.symbol}) с раствором соли ${metal2.name_ru} (${metal2.symbol})?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `В ряду активности ${metal1.name_ru} (позиция ${metal1.position}) ${canReact ? 'стоит левее' : 'стоит правее'} ${metal2.name_ru} (позиция ${metal2.position}), поэтому реакция замещения ${canReact ? 'возможна' : 'не идёт'}.`,
      competencyMap: { reactions_redox: 'P' },
    };
  },

  /* ---- Qualitative analysis generators ---- */

  identify_reagent_for_ion(ctx) {
    const tests = ctx.qualitativeTests;
    if (tests.length < 4) throw new Error('Not enough qualitative tests');

    const target = pick(tests);
    const correctReagent = target.reagent_name_ru;

    const others = tests
      .filter(t => t.target_id !== target.target_id && t.reagent_name_ru !== correctReagent)
      .map(t => t.reagent_name_ru);
    const uniqueOthers = [...new Set(others)].sort(() => Math.random() - 0.5);
    const distractors = uniqueOthers.slice(0, 2);
    distractors.push('Универсальный индикатор');

    const options = shuffleOptions([
      { id: 'correct', text: correctReagent },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_reagent_for_ion',
      question: `Каким реактивом можно обнаружить ${target.target_name_ru}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${target.target_name_ru}: реагент — ${target.reagent_name_ru}. ${target.observation_ru}.`,
      competencyMap: { qualitative_analysis_logic: 'P' },
    };
  },

  identify_ion_by_observation(ctx) {
    const tests = ctx.qualitativeTests;
    if (tests.length < 4) throw new Error('Not enough qualitative tests');

    const target = pick(tests);

    const others = tests
      .filter(t => t.target_id !== target.target_id)
      .map(t => t.target_name_ru);
    const uniqueOthers = [...new Set(others)].sort(() => Math.random() - 0.5);
    const distractors = uniqueOthers.slice(0, 3);

    const options = shuffleOptions([
      { id: 'correct', text: target.target_name_ru },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_ion_by_observation',
      question: `При добавлении ${target.reagent_name_ru} наблюдается: ${target.observation_ru}. Какой ион/газ присутствует?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `Признак «${target.observation_ru}» характерен для ${target.target_name_ru}.`,
      competencyMap: { qualitative_analysis_logic: 'P' },
    };
  },

  /* ---- Genetic chain generators ---- */

  complete_chain_step(ctx) {
    const chains = ctx.geneticChains;
    if (chains.length === 0) throw new Error('No genetic chains');

    const chain = pick(chains);
    const steps = chain.steps;
    // Pick a random middle substance to hide (not first or last)
    const allSubstances = [steps[0].substance, ...steps.map(s => s.next)];
    // Hide index 1..(n-1) — a middle substance
    const hideIdx = 1 + Math.floor(Math.random() * (allSubstances.length - 2));
    const hidden = allSubstances[hideIdx];

    const displayed = allSubstances.map((s, i) => i === hideIdx ? '___' : s).join(' → ');

    // Distractors: other substances from other chains
    const allChainSubstances = ctx.geneticChains.flatMap(c =>
      [c.steps[0].substance, ...c.steps.map(s => s.next)],
    );
    const otherSubstances = [...new Set(allChainSubstances)].filter(s => s !== hidden);
    const shuffledOther = otherSubstances.sort(() => Math.random() - 0.5);
    const distractors = shuffledOther.slice(0, 3);

    const options = shuffleOptions([
      { id: 'correct', text: hidden },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'complete_chain_step',
      question: `${chain.title_ru}: ${displayed}. Что пропущено?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `Полная цепочка: ${allSubstances.join(' → ')}.`,
      competencyMap: { genetic_chain_logic: 'P', classification: 'S' },
    };
  },

  choose_reagent_for_step(ctx) {
    const chains = ctx.geneticChains;
    if (chains.length === 0) throw new Error('No genetic chains');

    const chain = pick(chains);
    const step = pick(chain.steps);

    // Collect reagents from all chains for distractors
    const allReagents = ctx.geneticChains.flatMap(c => c.steps.map(s => s.reagent));
    const otherReagents = [...new Set(allReagents)].filter(r => r !== step.reagent);
    const shuffledOther = otherReagents.sort(() => Math.random() - 0.5);
    const distractors = shuffledOther.slice(0, 3);

    const options = shuffleOptions([
      { id: 'correct', text: step.reagent },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'choose_reagent_for_step',
      question: `Как превратить ${step.substance} в ${step.next}? Какой реагент нужен?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${step.substance} + ${step.reagent} → ${step.next} (${TYPE_LABELS[step.type] ?? step.type}).`,
      competencyMap: { genetic_chain_logic: 'P', reactions_exchange: 'S' },
    };
  },
  /* ---- Energy & catalyst generators ---- */

  factors_affecting_rate(ctx) {
    const theory = ctx.energyCatalystTheory!;
    // Pick a reaction with rate_tips
    const rxnsWithTips = ctx.reactions.filter(r => r.rate_tips.how_to_speed_up.length > 0);
    const target = pick(rxnsWithTips.length > 0 ? rxnsWithTips : ctx.reactions);

    // Pick a correct tip from the reaction's rate tips
    const correctTip = pick(target.rate_tips.how_to_speed_up);

    // Build distractors from what slows down + invented wrong answers
    const slowdowns = target.rate_tips.what_slows_down ?? [];
    const wrongAnswers = [
      ...slowdowns.map(s => s),
      'Добавить ингибитор',
      'Понизить температуру',
      'Уменьшить концентрацию реагентов',
      'Увеличить размер частиц твёрдого вещества',
    ];
    const distractors = [...new Set(wrongAnswers)]
      .filter(d => d !== correctTip)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const options = shuffleOptions([
      { id: 'correct', text: correctTip },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'factors_affecting_rate',
      question: `Какой из факторов увеличит скорость реакции: ${target.equation}?`,
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: `${correctTip}. Основные факторы: ${theory.rate_factors.map(f => f.name_ru.toLowerCase()).join(', ')}.`,
      competencyMap: { reaction_energy_profile: 'P' as const },
    };
  },

  exo_endo_classify(ctx) {
    const theory = ctx.energyCatalystTheory!;
    const HEAT_LABELS: Record<string, string> = {
      exo: 'Экзотермическая (с выделением теплоты)',
      endo: 'Эндотермическая (с поглощением теплоты)',
    };

    // Pick a reaction with known heat effect (exo or endo)
    const classified = ctx.reactions.filter(r => r.heat_effect === 'exo' || r.heat_effect === 'endo');
    if (classified.length === 0) throw new Error('No reactions with exo/endo heat effect');

    const target = pick(classified);
    const correctLabel = HEAT_LABELS[target.heat_effect];

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      { id: 'd0', text: target.heat_effect === 'exo' ? HEAT_LABELS['endo'] : HEAT_LABELS['exo'] },
      { id: 'd1', text: 'Термонейтральная (без теплового эффекта)' },
      { id: 'd2', text: 'Невозможно определить без калориметра' },
    ]);

    return {
      type: 'exo_endo_classify',
      question: `Реакция ${target.equation} является...?`,
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: `${correctLabel}. ${theory.heat_classification.exothermic_ru}. ${theory.heat_classification.endothermic_ru}.`,
      competencyMap: { reaction_energy_profile: 'P' as const, catalyst_role_understanding: 'S' as const },
    };
  },

  equilibrium_shift(ctx) {
    const theory = ctx.energyCatalystTheory!;
    // Pick a random equilibrium shift scenario
    const shifts = theory.equilibrium_shifts;
    const target = pick(shifts);

    const FACTOR_LABELS: Record<string, string> = {
      temperature_increase: 'повышении температуры',
      temperature_decrease: 'понижении температуры',
      pressure_increase: 'увеличении давления',
      pressure_decrease: 'уменьшении давления',
      concentration_reactant_increase: 'увеличении концентрации реагентов',
      concentration_product_increase: 'увеличении концентрации продуктов',
      catalyst_added: 'добавлении катализатора',
    };

    const factorLabel = FACTOR_LABELS[target.factor] ?? target.factor;
    const correctAnswer = target.shift_ru;

    const allShifts = [
      'В сторону продуктов (вправо)',
      'В сторону реагентов (влево)',
      'Не смещает равновесие',
      'Зависит от конкретной реакции',
    ];
    const distractors = allShifts.filter(s => s !== correctAnswer).slice(0, 3);

    const options = shuffleOptions([
      { id: 'correct', text: correctAnswer },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'equilibrium_shift',
      question: `Как сместится химическое равновесие при ${factorLabel}?`,
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: `${target.explanation_ru} (принцип Ле Шателье).`,
      competencyMap: { reaction_energy_profile: 'P' as const },
    };
  },

  catalyst_properties(ctx) {
    const theory = ctx.energyCatalystTheory!;
    // Ask what catalyst DOES or DOES NOT change
    const askChanges = Math.random() < 0.5;
    const questionText = askChanges
      ? 'Что изменяет катализатор?'
      : 'Что НЕ изменяет катализатор?';

    const correctPool = askChanges
      ? theory.catalyst_properties.changes_ru
      : theory.catalyst_properties.does_not_change_ru;
    const wrongPool = askChanges
      ? theory.catalyst_properties.does_not_change_ru
      : theory.catalyst_properties.changes_ru;

    const correct = pick(correctPool);
    const distractors = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);

    const options = shuffleOptions([
      { id: 'correct', text: correct },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'catalyst_properties',
      question: questionText,
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: `Катализатор изменяет: ${theory.catalyst_properties.changes_ru.join('; ')}. Не изменяет: ${theory.catalyst_properties.does_not_change_ru.join('; ')}.`,
      competencyMap: { catalyst_role_understanding: 'P' as const },
    };
  },

  identify_catalyst(ctx) {
    const theory = ctx.energyCatalystTheory!;
    const catalysts = theory.common_catalysts;
    if (catalysts.length < 3) throw new Error('Not enough common catalysts');

    const target = pick(catalysts);
    const others = catalysts.filter(c => c.catalyst !== target.catalyst);
    const distractors = others
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map(c => c.catalyst);
    distractors.push('Катализатор не используется');

    const options = shuffleOptions([
      { id: 'correct', text: target.catalyst },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_catalyst',
      question: `Какой катализатор используется в реакции: ${target.reaction_ru}?`,
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: `${target.catalyst} (${target.name_ru}) — катализатор этой реакции.`,
      competencyMap: { catalyst_role_understanding: 'P' as const, reaction_energy_profile: 'S' as const },
    };
  },
};

const EXERCISE_TYPES = Object.keys(generators);

const NEEDS_REACTIONS = new Set([
  'match_ionic_equation', 'identify_spectator_ions', 'predict_observation',
  'identify_oxidizer_reducer', 'predict_substitution_products', 'will_metal_react',
]);
const NEEDS_QUALITATIVE = new Set(['identify_reagent_for_ion', 'identify_ion_by_observation']);
const NEEDS_CHAINS = new Set(['complete_chain_step', 'choose_reagent_for_step']);
const NEEDS_ENERGY_THEORY = new Set([
  'factors_affecting_rate', 'exo_endo_classify', 'equilibrium_shift',
  'catalyst_properties', 'identify_catalyst',
]);

export function generateExercise(ctx: GeneratorContext, type?: string): Exercise {
  const availableTypes = EXERCISE_TYPES.filter(t => {
    if (NEEDS_REACTIONS.has(t) && ctx.reactions.length === 0) return false;
    if (NEEDS_QUALITATIVE.has(t) && ctx.qualitativeTests.length < 4) return false;
    if (NEEDS_CHAINS.has(t) && ctx.geneticChains.length === 0) return false;
    if (NEEDS_ENERGY_THEORY.has(t) && !ctx.energyCatalystTheory) return false;
    return true;
  });
  const t = type ?? pick(availableTypes);
  const gen = generators[t];
  if (!gen) throw new Error(`Unknown exercise type: ${t}`);
  return gen(ctx);
}
