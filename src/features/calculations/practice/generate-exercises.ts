import type { CalculationsData, CalcSubstance, CalcReaction } from '../../../types/calculations';

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
  data: CalculationsData;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleOptions(options: ExerciseOption[]): ExerciseOption[] {
  return [...options].sort(() => Math.random() - 0.5);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Generate numeric distractors near the correct value. */
function numericDistractors(correct: number, count: number): number[] {
  const results = new Set<number>();
  const offsets = [0.8, 0.9, 1.1, 1.2, 0.5, 1.5, 0.75, 1.25, 2, 0.67];
  for (const mult of offsets) {
    if (results.size >= count) break;
    const d = round2(correct * mult);
    if (d > 0 && d !== correct) results.add(d);
  }
  // Fallback if not enough
  let i = 1;
  while (results.size < count) {
    const d = round2(correct + i * (correct > 10 ? 5 : 1));
    if (d > 0 && d !== correct) results.add(d);
    i++;
  }
  return [...results].slice(0, count);
}

type GeneratorFn = (ctx: GeneratorContext) => Exercise;

// ─── calculations_basic generators ───

function calcMolarMass(ctx: GeneratorContext): Exercise {
  const sub = pick(ctx.data.calc_substances);
  const correct = sub.M;
  const distractors = numericDistractors(correct, 3);

  const options = shuffleOptions([
    { id: 'correct', text: `${correct} г/моль` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${d} г/моль` })),
  ]);

  const steps = sub.composition.map(c => `${c.Ar}×${c.count}`).join(' + ');

  return {
    type: 'calc_molar_mass',
    question: `Вычислите молярную массу ${sub.formula}.`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `M(${sub.formula}) = ${steps} = ${correct} г/моль`,
    competencyMap: { calculations_basic: 'P' },
  };
}

function calcMassFraction(ctx: GeneratorContext): Exercise {
  // Pick a substance with at least 2 elements
  const candidates = ctx.data.calc_substances.filter(s => s.composition.length >= 2);
  const sub = pick(candidates);
  const elem = pick(sub.composition);

  const numerator = elem.Ar * elem.count;
  const fraction = round1((numerator / sub.M) * 100);
  const distractors = numericDistractors(fraction, 3);

  const options = shuffleOptions([
    { id: 'correct', text: `${fraction}%` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${round1(d)}%` })),
  ]);

  return {
    type: 'calc_mass_fraction',
    question: `Какова массовая доля ${elem.element} в ${sub.formula}?`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `ω(${elem.element}) = ${elem.Ar}×${elem.count} / ${sub.M} × 100% = ${fraction}%`,
    competencyMap: { calculations_basic: 'P' },
  };
}

function calcAmountOfSubstance(ctx: GeneratorContext): Exercise {
  const sub = pick(ctx.data.calc_substances);
  // Generate a "nice" mass that gives clean moles
  const niceMultipliers = [0.5, 1, 1.5, 2, 3, 5, 0.25, 0.1];
  const nMol = pick(niceMultipliers);
  const mass = round2(nMol * sub.M);
  const correct = nMol;

  const distractors = numericDistractors(correct, 3);

  const options = shuffleOptions([
    { id: 'correct', text: `${correct} моль` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${round2(d)} моль` })),
  ]);

  return {
    type: 'calc_amount_of_substance',
    question: `Какое количество вещества содержится в ${mass} г ${sub.formula}?`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `n = m/M = ${mass}/${sub.M} = ${correct} моль`,
    competencyMap: { calculations_basic: 'P' },
  };
}

function calcMassFromMoles(ctx: GeneratorContext): Exercise {
  const sub = pick(ctx.data.calc_substances);
  const niceMultipliers = [0.5, 1, 1.5, 2, 3, 5, 0.1, 0.25];
  const nMol = pick(niceMultipliers);
  const correct = round2(nMol * sub.M);
  const distractors = numericDistractors(correct, 3);

  const options = shuffleOptions([
    { id: 'correct', text: `${correct} г` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${round2(d)} г` })),
  ]);

  return {
    type: 'calc_mass_from_moles',
    question: `Какова масса ${nMol} моль ${sub.formula}?`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `m = n × M = ${nMol} × ${sub.M} = ${correct} г`,
    competencyMap: { calculations_basic: 'P' },
  };
}

// ─── calculations_solutions generators ───

function calcSolutionConcentration(ctx: GeneratorContext): Exercise {
  void ctx;
  // Random solute mass and solution mass
  const soluteMasses = [5, 10, 15, 20, 25, 30, 40, 50];
  const solutionMasses = [100, 150, 200, 250, 300, 400, 500];
  const mSolute = pick(soluteMasses);
  const mSolution = pick(solutionMasses.filter(m => m > mSolute * 2));

  const correct = round1((mSolute / mSolution) * 100);
  const distractors = numericDistractors(correct, 3);

  const options = shuffleOptions([
    { id: 'correct', text: `${correct}%` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${round1(d)}%` })),
  ]);

  return {
    type: 'calc_solution_concentration',
    question: `В ${mSolution} г раствора содержится ${mSolute} г соли. Какова массовая доля соли?`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `ω = m(в-ва)/m(р-ра) × 100% = ${mSolute}/${mSolution} × 100% = ${correct}%`,
    competencyMap: { calculations_solutions: 'P', calculations_basic: 'S' },
  };
}

function calcSoluteMass(ctx: GeneratorContext): Exercise {
  void ctx;
  const concentrations = [5, 10, 15, 20, 25];
  const solutionMasses = [100, 200, 250, 300, 400, 500];
  const omega = pick(concentrations);
  const mSolution = pick(solutionMasses);
  const correct = round1((omega * mSolution) / 100);
  const distractors = numericDistractors(correct, 3);

  const options = shuffleOptions([
    { id: 'correct', text: `${correct} г` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${round1(d)} г` })),
  ]);

  return {
    type: 'calc_solute_mass',
    question: `Сколько граммов соли нужно для приготовления ${mSolution} г ${omega}%-ного раствора?`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `m(в-ва) = ω × m(р-ра) / 100 = ${omega} × ${mSolution} / 100 = ${correct} г`,
    competencyMap: { calculations_solutions: 'P', calculations_basic: 'S' },
  };
}

function calcDilution(ctx: GeneratorContext): Exercise {
  void ctx;
  const initialConc = pick([10, 15, 20, 25, 30, 40]);
  const initialMass = pick([100, 150, 200, 250]);
  const addedWater = pick([100, 200, 300, 400, 500]);
  const finalMass = initialMass + addedWater;
  const correct = round1((initialConc * initialMass) / (finalMass * 100) * 100);
  const distractors = numericDistractors(correct, 3);

  const options = shuffleOptions([
    { id: 'correct', text: `${correct}%` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${round1(d)}%` })),
  ]);

  return {
    type: 'calc_dilution',
    question: `К ${initialMass} г ${initialConc}%-ного раствора добавили ${addedWater} г воды. Какова массовая доля вещества в новом растворе?`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `m(в-ва) = ${initialConc}% × ${initialMass}/100 = ${round1(initialConc * initialMass / 100)} г. ω₂ = ${round1(initialConc * initialMass / 100)}/${finalMass} × 100% = ${correct}%`,
    competencyMap: { calculations_solutions: 'P', calculations_basic: 'S' },
  };
}

// ─── reaction_yield_logic generators ───

function calcByEquation(ctx: GeneratorContext): Exercise {
  const rxn = pick(ctx.data.calc_reactions);
  // Pick a "nice" mass of the given substance
  const niceMultipliers = [1, 2, 3, 5, 0.5];
  const mult = pick(niceMultipliers);
  const givenMass = round2(mult * rxn.given.coeff * rxn.given.M);
  const givenMoles = givenMass / rxn.given.M;
  const findMoles = (givenMoles / rxn.given.coeff) * rxn.find.coeff;
  const correct = round2(findMoles * rxn.find.M);
  const distractors = numericDistractors(correct, 3);

  const options = shuffleOptions([
    { id: 'correct', text: `${correct} г` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${round2(d)} г` })),
  ]);

  return {
    type: 'calc_by_equation',
    question: `По уравнению ${rxn.equation_ru}: сколько граммов ${rxn.find.formula} образуется из ${givenMass} г ${rxn.given.formula}?`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `n(${rxn.given.formula}) = ${givenMass}/${rxn.given.M} = ${round2(givenMoles)} моль → n(${rxn.find.formula}) = ${round2(findMoles)} моль → m = ${round2(findMoles)} × ${rxn.find.M} = ${correct} г`,
    competencyMap: { reaction_yield_logic: 'P', calculations_basic: 'S' },
  };
}

function calcYield(ctx: GeneratorContext): Exercise {
  const rxn = pick(ctx.data.calc_reactions);
  const mult = pick([1, 2, 3, 5]);
  const givenMass = round2(mult * rxn.given.coeff * rxn.given.M);
  const givenMoles = givenMass / rxn.given.M;
  const findMoles = (givenMoles / rxn.given.coeff) * rxn.find.coeff;
  const theoreticalMass = round2(findMoles * rxn.find.M);

  const yieldPercents = [60, 70, 75, 80, 85, 90, 95];
  const yieldPct = pick(yieldPercents);
  const practicalMass = round2((theoreticalMass * yieldPct) / 100);

  const distractors = numericDistractors(yieldPct, 3).map(d => Math.round(d));

  const options = shuffleOptions([
    { id: 'correct', text: `${yieldPct}%` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${d}%` })),
  ]);

  return {
    type: 'calc_yield',
    question: `По уравнению ${rxn.equation_ru}: из ${givenMass} г ${rxn.given.formula} получено ${practicalMass} г ${rxn.find.formula}. Каков выход продукта?`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `Теоретическая масса: ${theoreticalMass} г. η = ${practicalMass}/${theoreticalMass} × 100% = ${yieldPct}%`,
    competencyMap: { reaction_yield_logic: 'P', calculations_solutions: 'S' },
  };
}

const generators: Record<string, GeneratorFn> = {
  calc_molar_mass: calcMolarMass,
  calc_mass_fraction: calcMassFraction,
  calc_amount_of_substance: calcAmountOfSubstance,
  calc_mass_from_moles: calcMassFromMoles,
  calc_solution_concentration: calcSolutionConcentration,
  calc_solute_mass: calcSoluteMass,
  calc_dilution: calcDilution,
  calc_by_equation: calcByEquation,
  calc_yield: calcYield,
};

const generatorKeys = Object.keys(generators);

export function generateExercise(ctx: GeneratorContext): Exercise {
  const key = pick(generatorKeys);
  return generators[key](ctx);
}
