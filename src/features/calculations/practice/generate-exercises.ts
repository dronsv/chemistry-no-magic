import * as m from '../../../paraglide/messages.js';
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
    { id: 'correct', text: m.calc_ex_unit_g_mol({ value: String(correct) }) },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: m.calc_ex_unit_g_mol({ value: String(d) }) })),
  ]);

  const steps = sub.composition.map(c => `${c.Ar}×${c.count}`).join(' + ');

  return {
    type: 'calc_molar_mass',
    question: m.calc_ex_q_molar_mass({ formula: sub.formula }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: m.calc_ex_a_molar_mass({ formula: sub.formula, steps, value: String(correct) }),
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
    question: m.calc_ex_q_mass_fraction({ element: elem.element, formula: sub.formula }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: m.calc_ex_a_mass_fraction({ element: elem.element, ar: String(elem.Ar), count: String(elem.count), M: String(sub.M), value: String(fraction) }),
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
    { id: 'correct', text: m.calc_ex_unit_mol({ value: String(correct) }) },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: m.calc_ex_unit_mol({ value: String(round2(d)) }) })),
  ]);

  return {
    type: 'calc_amount_of_substance',
    question: m.calc_ex_q_amount({ mass: String(mass), formula: sub.formula }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: m.calc_ex_a_amount({ mass: String(mass), M: String(sub.M), value: String(correct) }),
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
    { id: 'correct', text: m.calc_ex_unit_g({ value: String(correct) }) },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: m.calc_ex_unit_g({ value: String(round2(d)) }) })),
  ]);

  return {
    type: 'calc_mass_from_moles',
    question: m.calc_ex_q_mass_from_moles({ n: String(nMol), formula: sub.formula }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: m.calc_ex_a_mass_from_moles({ n: String(nMol), M: String(sub.M), value: String(correct) }),
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
    question: m.calc_ex_q_solution_conc({ mSolution: String(mSolution), mSolute: String(mSolute) }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: m.calc_ex_a_solution_conc({ mSolute: String(mSolute), mSolution: String(mSolution), value: String(correct) }),
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
    { id: 'correct', text: m.calc_ex_unit_g({ value: String(correct) }) },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: m.calc_ex_unit_g({ value: String(round1(d)) }) })),
  ]);

  return {
    type: 'calc_solute_mass',
    question: m.calc_ex_q_solute_mass({ mSolution: String(mSolution), omega: String(omega) }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: m.calc_ex_a_solute_mass({ omega: String(omega), mSolution: String(mSolution), value: String(correct) }),
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
  const soluteMass = round1(initialConc * initialMass / 100);
  const distractors = numericDistractors(correct, 3);

  const options = shuffleOptions([
    { id: 'correct', text: `${correct}%` },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: `${round1(d)}%` })),
  ]);

  return {
    type: 'calc_dilution',
    question: m.calc_ex_q_dilution({ initialMass: String(initialMass), initialConc: String(initialConc), addedWater: String(addedWater) }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: m.calc_ex_a_dilution({ initialConc: String(initialConc), initialMass: String(initialMass), soluteMass: String(soluteMass), finalMass: String(finalMass), value: String(correct) }),
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
    { id: 'correct', text: m.calc_ex_unit_g({ value: String(correct) }) },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: m.calc_ex_unit_g({ value: String(round2(d)) }) })),
  ]);

  return {
    type: 'calc_by_equation',
    question: m.calc_ex_q_by_equation({ equation: rxn.equation_ru, findFormula: rxn.find.formula, givenMass: String(givenMass), givenFormula: rxn.given.formula }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: m.calc_ex_a_by_equation({ givenFormula: rxn.given.formula, givenMass: String(givenMass), givenM: String(rxn.given.M), givenMoles: String(round2(givenMoles)), findFormula: rxn.find.formula, findMoles: String(round2(findMoles)), findM: String(rxn.find.M), value: String(correct) }),
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
    question: m.calc_ex_q_yield({ equation: rxn.equation_ru, givenMass: String(givenMass), givenFormula: rxn.given.formula, practicalMass: String(practicalMass), findFormula: rxn.find.formula }),
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: m.calc_ex_a_yield({ theoreticalMass: String(theoreticalMass), practicalMass: String(practicalMass), value: String(yieldPct) }),
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
