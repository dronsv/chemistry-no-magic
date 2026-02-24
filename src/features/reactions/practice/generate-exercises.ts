import * as m from '../../../paraglide/messages.js';
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

function typeLabel(type: string): string {
  const labels: Record<string, () => string> = {
    exchange: m.rxn_ex_type_exchange,
    substitution: m.rxn_ex_type_substitution,
    combination: m.rxn_ex_type_combination,
    decomposition: m.rxn_ex_type_decomposition,
  };
  return labels[type]?.() ?? type;
}

function solubilityLabel(key: string): string {
  const labels: Record<string, () => string> = {
    soluble: m.rxn_ex_sol_soluble,
    insoluble: m.rxn_ex_sol_insoluble,
    slightly_soluble: m.rxn_ex_sol_slightly,
    decomposes: m.rxn_ex_sol_decomposes,
  };
  return labels[key]?.() ?? key;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleOptions(options: ExerciseOption[]): ExerciseOption[] {
  return [...options].sort(() => Math.random() - 0.5);
}

type GeneratorFn = (ctx: GeneratorContext) => Exercise;

/** Map ion IDs (used in solubility data) to Unicode display formulas. */
const ION_FORMULA: Record<string, string> = {
  Na_plus: 'Na⁺', K_plus: 'K⁺', H_plus: 'H⁺', NH4_plus: 'NH₄⁺',
  Ba_2plus: 'Ba²⁺', Ca_2plus: 'Ca²⁺', Mg_2plus: 'Mg²⁺',
  Al_3plus: 'Al³⁺', Fe_2plus: 'Fe²⁺', Fe_3plus: 'Fe³⁺',
  Cu_2plus: 'Cu²⁺', Zn_2plus: 'Zn²⁺', Ag_plus: 'Ag⁺', Pb_2plus: 'Pb²⁺',
  Cl_minus: 'Cl⁻', SO4_2minus: 'SO₄²⁻', NO3_minus: 'NO₃⁻',
  CO3_2minus: 'CO₃²⁻', PO4_3minus: 'PO₄³⁻', S_2minus: 'S²⁻',
  OH_minus: 'OH⁻', SiO3_2minus: 'SiO₃²⁻',
  Br_minus: 'Br⁻', I_minus: 'I⁻', F_minus: 'F⁻',
};

function ionFormula(id: string): string {
  return ION_FORMULA[id] ?? id;
}

/* ---- Distractor helpers for predict_exchange_products ---- */

function parseCoeff(s: string): [number, string] {
  const match = s.match(/^(\d+)(\D.*)$/);
  return match ? [parseInt(match[1], 10), match[2]] : [1, s];
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
    const correctLabel = typeLabel(t.type);
    const allTypes = ['exchange', 'substitution', 'combination', 'decomposition'];
    const distractors = allTypes.filter(type => type !== t.type);

    const options = shuffleOptions([
      { id: 'correct', text: m.rxn_ex_reaction_label({ label: correctLabel }) },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: m.rxn_ex_reaction_label({ label: typeLabel(d) }) })),
    ]);

    return {
      type: 'classify_reaction_type',
      question: m.rxn_ex_q_type({ desc: t.description_ru }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_type({ label: correctLabel, pattern: t.pattern }),
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
    distractors.push(m.rxn_ex_no_reaction());

    const options = shuffleOptions([
      { id: 'correct', text: correctProducts },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'predict_exchange_products',
      question: m.rxn_ex_q_products({ reactants: example.reactants.join(' + ') }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_products({ reactants: example.reactants.join(' + '), products: correctProducts, desc: t.description_ru }),
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
      correctForce = m.rxn_ex_force_precipitate();
      explanation = m.rxn_ex_a_force_precipitate();
    } else if (productsStr.includes('↑') || productsStr.includes('CO₂') || productsStr.includes('H₂S') || productsStr.includes('SO₂') || productsStr.includes('NH₃')) {
      correctForce = m.rxn_ex_force_gas();
      explanation = m.rxn_ex_a_force_gas();
    } else if (productsStr.includes('H₂O') || productsStr.includes('вод')) {
      correctForce = m.rxn_ex_force_water();
      explanation = m.rxn_ex_a_force_water();
    } else {
      correctForce = m.rxn_ex_force_water();
      explanation = m.rxn_ex_a_force_weak_electrolyte();
    }

    const allForces = [m.rxn_ex_force_precipitate(), m.rxn_ex_force_gas(), m.rxn_ex_force_water(), m.rxn_ex_no_reaction()];
    const distractors = allForces.filter(f => f !== correctForce);

    const options = shuffleOptions([
      { id: 'correct', text: correctForce },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_driving_force',
      question: m.rxn_ex_q_driving_force({ equation }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation,
      competencyMap: { gas_precipitate_logic: 'P' },
    };
  },

  solubility_lookup(ctx) {
    const mainAnions = new Set([
      'Cl_minus', 'SO4_2minus', 'NO3_minus', 'CO3_2minus',
      'PO4_3minus', 'S_2minus', 'OH_minus', 'SiO3_2minus',
    ]);
    const solubilityEntries = Array.isArray(ctx.solubility) ? ctx.solubility : ((ctx.solubility as any).pairs ?? []);
    const mainEntries = solubilityEntries.filter((e: SolubilityEntry) => mainAnions.has(e.anion));
    const entry = pick(mainEntries);
    const correctLabel = solubilityLabel(entry.solubility);

    const cationDisplay = ionFormula(entry.cation);
    const anionDisplay = ionFormula(entry.anion);

    const allSolKeys = ['soluble', 'insoluble', 'slightly_soluble', 'decomposes'];
    const allSolLabels = allSolKeys.map(k => solubilityLabel(k));
    const distractors = allSolLabels.filter(l => l !== correctLabel);

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'solubility_lookup',
      question: m.rxn_ex_q_solubility({ cation: cationDisplay, anion: anionDisplay }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_solubility({ cation: cationDisplay, anion: anionDisplay, label: correctLabel.toLowerCase() }),
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
      correctAnswer = m.rxn_ex_occur_precipitate();
      explanation = m.rxn_ex_a_occur_precipitate();
    } else if (productsStr.includes('↑') || productsStr.includes('CO₂')) {
      correctAnswer = m.rxn_ex_occur_gas();
      explanation = m.rxn_ex_a_occur_gas();
    } else if (productsStr.includes('H₂O')) {
      correctAnswer = m.rxn_ex_occur_water();
      explanation = m.rxn_ex_a_occur_water();
    } else {
      correctAnswer = m.rxn_ex_occur_water();
      explanation = m.rxn_ex_a_occur_weak();
    }

    const allAnswers = [
      m.rxn_ex_occur_precipitate(),
      m.rxn_ex_occur_gas(),
      m.rxn_ex_occur_water(),
      m.rxn_ex_occur_no(),
    ];
    const distractors = allAnswers.filter(a => a !== correctAnswer);

    const options = shuffleOptions([
      { id: 'correct', text: correctAnswer },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'will_reaction_occur',
      question: m.rxn_ex_q_will_occur({ reactants: example.reactants.join(' + ') }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${example.reactants.join(' + ')} → ${example.products.join(' + ')}. ${explanation}`,
      competencyMap: { gas_precipitate_logic: 'P', reactions_exchange: 'S' },
    };
  },

  activity_series_compare(ctx) {
    const metals = ctx.activitySeries.filter(entry => entry.symbol !== 'H');
    const metal1 = pick(metals);
    const remaining = metals.filter(entry => entry.symbol !== metal1.symbol);
    const metal2 = pick(remaining);

    const canDisplace = metal1.position < metal2.position;
    const correctAnswer = canDisplace ? m.rxn_ex_yes() : m.rxn_ex_no();
    const explanation = canDisplace
      ? m.rxn_ex_a_activity_yes({ metal1: metal1.name_ru, pos1: String(metal1.position), metal2: metal2.name_ru, pos2: String(metal2.position) })
      : m.rxn_ex_a_activity_no({ metal1: metal1.name_ru, pos1: String(metal1.position), metal2: metal2.name_ru, pos2: String(metal2.position) });

    const options = shuffleOptions([
      { id: 'correct', text: correctAnswer },
      { id: 'd0', text: canDisplace ? m.rxn_ex_no() : m.rxn_ex_yes() },
    ]);

    options.push(
      { id: 'd1', text: m.rxn_ex_only_heating() },
      { id: 'd2', text: m.rxn_ex_only_catalyst() },
    );

    return {
      type: 'activity_series_compare',
      question: m.rxn_ex_q_activity({ metal1: metal1.name_ru, sym1: metal1.symbol, metal2: metal2.name_ru, sym2: metal2.symbol }),
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
    distractorNets.push(m.rxn_ex_no_ionic());

    const options = shuffleOptions([
      { id: 'correct', text: correctNet },
      ...distractorNets.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'match_ionic_equation',
      question: m.rxn_ex_q_ionic({ equation: target.equation }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_ionic({ full: target.ionic.full ?? '—', net: correctNet, notes: target.ionic.notes ? ' ' + target.ionic.notes : '' }),
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
    distractors.push(m.rxn_ex_no_spectators());

    const options = shuffleOptions([
      { id: 'correct', text: correctText },
      ...distractors.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_spectator_ions',
      question: m.rxn_ex_q_spectators({ equation: target.equation }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_spectators({ full, net, ions: correctText }),
      competencyMap: { reactions_exchange: 'P', electrolyte_logic: 'S' },
    };
  },

  predict_observation(ctx) {
    function describeObservation(r: Reaction): string {
      const parts: string[] = [];
      if (r.observations.precipitate?.length) {
        parts.push(m.rxn_ex_obs_precipitate({ list: r.observations.precipitate.join(', ') }));
      }
      if (r.observations.gas?.length) {
        parts.push(m.rxn_ex_obs_gas({ list: r.observations.gas.join(', ') }));
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
      return parts.join('; ') || m.rxn_ex_obs_none();
    }

    const target = pick(ctx.reactions);
    const correctObs = describeObservation(target);

    const others = ctx.reactions
      .filter(r => r.reaction_id !== target.reaction_id)
      .map(r => describeObservation(r))
      .filter(obs => obs !== correctObs && obs !== m.rxn_ex_obs_none());

    const uniqueOthers = [...new Set(others)].sort(() => Math.random() - 0.5);
    const distractors = uniqueOthers.slice(0, 2);
    distractors.push(m.rxn_ex_obs_none());

    const reactantNames = target.molecular.reactants
      .map(r => r.name ?? r.formula)
      .join(m.rxn_ex_and());

    const options = shuffleOptions([
      { id: 'correct', text: correctObs },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'predict_observation',
      question: m.rxn_ex_q_observation({ reactants: reactantNames }),
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

    const askOxidizer = Math.random() < 0.5;
    const role = askOxidizer ? m.rxn_ex_role_oxidizer() : m.rxn_ex_role_reducer();
    const correct = askOxidizer ? redox.oxidizer.formula : redox.reducer.formula;
    const wrong = askOxidizer ? redox.reducer.formula : redox.oxidizer.formula;

    const allFormulas = [
      ...target.molecular.reactants.map(r => r.formula),
      ...target.molecular.products.map(r => r.formula),
    ];
    const otherFormulas = [...new Set(allFormulas)].filter(f => f !== correct && f !== wrong);
    const distractors = [wrong, ...otherFormulas.slice(0, 1), m.rxn_ex_not_redox()];

    const options = shuffleOptions([
      { id: 'correct', text: correct },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_oxidizer_reducer',
      question: m.rxn_ex_q_oxidizer_reducer({ equation: target.equation, role }),
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

    const otherRxns = redoxRxns.filter(r => r.reaction_id !== target.reaction_id);
    const distractors: string[] = [];

    if (otherRxns.length > 0) {
      const other = pick(otherRxns);
      distractors.push(
        other.molecular.products.map(p => `${p.coeff > 1 ? p.coeff : ''}${p.formula}`).join(' + '),
      );
    }

    const reversed = [...target.molecular.products].reverse()
      .map(p => `${p.coeff > 1 ? p.coeff : ''}${p.formula}`)
      .join(' + ');
    if (reversed !== correctProducts) distractors.push(reversed);

    distractors.push(m.rxn_ex_no_reaction());

    const reactantStr = target.molecular.reactants
      .map(r => `${r.coeff > 1 ? r.coeff : ''}${r.formula}`)
      .join(' + ');

    const options = shuffleOptions([
      { id: 'correct', text: correctProducts },
      ...distractors.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'predict_substitution_products',
      question: m.rxn_ex_q_substitution_products({ reactants: reactantStr }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${target.equation}`,
      competencyMap: { reactions_redox: 'P' },
    };
  },

  will_metal_react(ctx) {
    const metals = ctx.activitySeries.filter(entry => entry.symbol !== 'H');
    if (metals.length < 2) throw new Error('Not enough metals in activity series');

    const metal1 = pick(metals);
    const remaining = metals.filter(entry => entry.symbol !== metal1.symbol);
    const metal2 = pick(remaining);

    const canReact = metal1.position < metal2.position;
    const correctAnswer = canReact
      ? m.rxn_ex_metal_yes({ sym1: metal1.symbol, sym2: metal2.symbol })
      : m.rxn_ex_metal_no({ sym1: metal1.symbol, sym2: metal2.symbol });

    const wrongAnswer = canReact
      ? m.rxn_ex_metal_no({ sym1: metal1.symbol, sym2: metal2.symbol })
      : m.rxn_ex_metal_yes({ sym1: metal1.symbol, sym2: metal2.symbol });

    const comparison = canReact ? m.rxn_ex_left_of() : m.rxn_ex_right_of();
    const result = canReact ? m.rxn_ex_possible() : m.rxn_ex_not_possible();

    const options = shuffleOptions([
      { id: 'correct', text: correctAnswer },
      { id: 'd0', text: wrongAnswer },
      { id: 'd1', text: m.rxn_ex_metal_heating() },
      { id: 'd2', text: m.rxn_ex_metal_equal() },
    ]);

    return {
      type: 'will_metal_react',
      question: m.rxn_ex_q_will_metal_react({ metal1: metal1.name_ru, sym1: metal1.symbol, metal2: metal2.name_ru, sym2: metal2.symbol }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_metal_react({ metal1: metal1.name_ru, pos1: String(metal1.position), comparison, metal2: metal2.name_ru, pos2: String(metal2.position), result }),
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
    distractors.push(m.rxn_ex_universal_indicator());

    const options = shuffleOptions([
      { id: 'correct', text: correctReagent },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_reagent_for_ion',
      question: m.rxn_ex_q_reagent_for_ion({ target: target.target_name_ru }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_reagent_for_ion({ target: target.target_name_ru, reagent: target.reagent_name_ru, observation: target.observation_ru }),
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
      question: m.rxn_ex_q_ion_by_observation({ reagent: target.reagent_name_ru, observation: target.observation_ru }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_ion_by_observation({ observation: target.observation_ru, target: target.target_name_ru }),
      competencyMap: { qualitative_analysis_logic: 'P' },
    };
  },

  /* ---- Genetic chain generators ---- */

  complete_chain_step(ctx) {
    const chains = ctx.geneticChains;
    if (chains.length === 0) throw new Error('No genetic chains');

    const chain = pick(chains);
    const steps = chain.steps;
    const allSubstances = [steps[0].substance, ...steps.map(s => s.next)];
    const hideIdx = 1 + Math.floor(Math.random() * (allSubstances.length - 2));
    const hidden = allSubstances[hideIdx];

    const displayed = allSubstances.map((s, i) => i === hideIdx ? '___' : s).join(' → ');

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
      question: m.rxn_ex_q_chain_step({ title: chain.title_ru, chain: displayed }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_chain_step({ chain: allSubstances.join(' → ') }),
      competencyMap: { genetic_chain_logic: 'P', classification: 'S' },
    };
  },

  choose_reagent_for_step(ctx) {
    const chains = ctx.geneticChains;
    if (chains.length === 0) throw new Error('No genetic chains');

    const chain = pick(chains);
    const step = pick(chain.steps);

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
      question: m.rxn_ex_q_chain_reagent({ from: step.substance, to: step.next }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_chain_reagent({ from: step.substance, reagent: step.reagent, to: step.next, type: typeLabel(step.type) }),
      competencyMap: { genetic_chain_logic: 'P', reactions_exchange: 'S' },
    };
  },

  /* ---- Energy & catalyst generators ---- */

  factors_affecting_rate(ctx) {
    const theory = ctx.energyCatalystTheory!;
    const rxnsWithTips = ctx.reactions.filter(r => r.rate_tips.how_to_speed_up.length > 0);
    const target = pick(rxnsWithTips.length > 0 ? rxnsWithTips : ctx.reactions);

    const correctTip = pick(target.rate_tips.how_to_speed_up);

    const slowdowns = target.rate_tips.what_slows_down ?? [];
    const wrongAnswers = [
      ...slowdowns.map(s => s),
      m.rxn_ex_add_inhibitor(),
      m.rxn_ex_lower_temp(),
      m.rxn_ex_lower_conc(),
      m.rxn_ex_increase_particle_size(),
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
      question: m.rxn_ex_q_rate_factor({ equation: target.equation }),
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_rate_factor({ tip: correctTip, factors: theory.rate_factors.map(f => f.name_ru.toLowerCase()).join(', ') }),
      competencyMap: { reaction_energy_profile: 'P' as const },
    };
  },

  exo_endo_classify(ctx) {
    const theory = ctx.energyCatalystTheory!;

    const classified = ctx.reactions.filter(r => r.heat_effect === 'exo' || r.heat_effect === 'endo');
    if (classified.length === 0) throw new Error('No reactions with exo/endo heat effect');

    const target = pick(classified);
    const correctLabel = target.heat_effect === 'exo' ? m.rxn_ex_heat_exo() : m.rxn_ex_heat_endo();

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      { id: 'd0', text: target.heat_effect === 'exo' ? m.rxn_ex_heat_endo() : m.rxn_ex_heat_exo() },
      { id: 'd1', text: m.rxn_ex_heat_neutral() },
      { id: 'd2', text: m.rxn_ex_heat_unknown() },
    ]);

    return {
      type: 'exo_endo_classify',
      question: m.rxn_ex_q_exo_endo({ equation: target.equation }),
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: `${correctLabel}. ${theory.heat_classification.exothermic_ru}. ${theory.heat_classification.endothermic_ru}.`,
      competencyMap: { reaction_energy_profile: 'P' as const, catalyst_role_understanding: 'S' as const },
    };
  },

  equilibrium_shift(ctx) {
    const theory = ctx.energyCatalystTheory!;
    const shifts = theory.equilibrium_shifts;
    const target = pick(shifts);

    const FACTOR_LABELS: Record<string, () => string> = {
      temperature_increase: m.rxn_ex_factor_temp_up,
      temperature_decrease: m.rxn_ex_factor_temp_down,
      pressure_increase: m.rxn_ex_factor_press_up,
      pressure_decrease: m.rxn_ex_factor_press_down,
      concentration_reactant_increase: m.rxn_ex_factor_conc_react_up,
      concentration_product_increase: m.rxn_ex_factor_conc_prod_up,
      catalyst_added: m.rxn_ex_factor_catalyst,
    };

    const factorLabel = FACTOR_LABELS[target.factor]?.() ?? target.factor;
    const correctAnswer = target.shift_ru;

    const allShifts = [
      m.rxn_ex_shift_products(),
      m.rxn_ex_shift_reactants(),
      m.rxn_ex_shift_none(),
      m.rxn_ex_shift_depends(),
    ];
    const distractors = allShifts.filter(s => s !== correctAnswer).slice(0, 3);

    const options = shuffleOptions([
      { id: 'correct', text: correctAnswer },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'equilibrium_shift',
      question: m.rxn_ex_q_equilibrium({ factor: factorLabel }),
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_equilibrium({ explanation: target.explanation_ru }),
      competencyMap: { reaction_energy_profile: 'P' as const },
    };
  },

  catalyst_properties(ctx) {
    const theory = ctx.energyCatalystTheory!;
    const askChanges = Math.random() < 0.5;
    const questionText = askChanges
      ? m.rxn_ex_q_catalyst_prop()
      : m.rxn_ex_q_catalyst_not_prop();

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
      explanation: m.rxn_ex_a_catalyst_prop({ changes: theory.catalyst_properties.changes_ru.join('; '), doesNot: theory.catalyst_properties.does_not_change_ru.join('; ') }),
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
    distractors.push(m.rxn_ex_no_catalyst());

    const options = shuffleOptions([
      { id: 'correct', text: target.catalyst },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_catalyst',
      question: m.rxn_ex_q_identify_catalyst({ reaction: target.reaction_ru }),
      format: 'multiple_choice' as const,
      options,
      correctId: 'correct',
      explanation: m.rxn_ex_a_identify_catalyst({ catalyst: target.catalyst, name: target.name_ru }),
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
