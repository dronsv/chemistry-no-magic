import * as m from '../../../paraglide/messages.js';
import type { Element } from '../../../types/element';
import type { BondType, CrystalStructure } from '../../../lib/bond-calculator';

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

function getBondTypeLabel(type: BondType): string {
  switch (type) {
    case 'ionic': return m.bond_ionic();
    case 'covalent_polar': return m.bond_covalent_polar();
    case 'covalent_nonpolar': return m.bond_covalent_nonpolar();
    case 'metallic': return m.bond_metallic();
  }
}

function getCrystalLabel(type: CrystalStructure): string {
  switch (type) {
    case 'ionic': return m.crystal_ionic();
    case 'molecular': return m.crystal_molecular();
    case 'atomic': return m.crystal_atomic();
    case 'metallic': return m.crystal_metallic();
  }
}

function getCrystalProperty(type: CrystalStructure, prop: 'melting' | 'conductivity'): string {
  const key = `crystal_${type}_${prop}` as const;
  const lookup: Record<string, () => string> = {
    crystal_ionic_melting: m.crystal_ionic_melting,
    crystal_ionic_conductivity: m.crystal_ionic_conductivity,
    crystal_molecular_melting: m.crystal_molecular_melting,
    crystal_molecular_conductivity: m.crystal_molecular_conductivity,
    crystal_atomic_melting: m.crystal_atomic_melting,
    crystal_atomic_conductivity: m.crystal_atomic_conductivity,
    crystal_metallic_melting: m.crystal_metallic_melting,
    crystal_metallic_conductivity: m.crystal_metallic_conductivity,
  };
  return lookup[key]();
}

interface BondExample {
  formula: string;
  bondType: BondType;
  crystal: CrystalStructure;
}

const BOND_EXAMPLES: BondExample[] = [
  { formula: 'NaCl', bondType: 'ionic', crystal: 'ionic' },
  { formula: 'KBr', bondType: 'ionic', crystal: 'ionic' },
  { formula: 'CaO', bondType: 'ionic', crystal: 'ionic' },
  { formula: 'MgF2', bondType: 'ionic', crystal: 'ionic' },
  { formula: 'H2O', bondType: 'covalent_polar', crystal: 'molecular' },
  { formula: 'HCl', bondType: 'covalent_polar', crystal: 'molecular' },
  { formula: 'NH3', bondType: 'covalent_polar', crystal: 'molecular' },
  { formula: 'CO2', bondType: 'covalent_polar', crystal: 'molecular' },
  { formula: 'H2', bondType: 'covalent_nonpolar', crystal: 'molecular' },
  { formula: 'O2', bondType: 'covalent_nonpolar', crystal: 'molecular' },
  { formula: 'N2', bondType: 'covalent_nonpolar', crystal: 'molecular' },
  { formula: 'Cl2', bondType: 'covalent_nonpolar', crystal: 'molecular' },
  { formula: 'Fe', bondType: 'metallic', crystal: 'metallic' },
  { formula: 'Cu', bondType: 'metallic', crystal: 'metallic' },
  { formula: 'Na', bondType: 'metallic', crystal: 'metallic' },
  { formula: 'Al', bondType: 'metallic', crystal: 'metallic' },
  { formula: 'SiO2', bondType: 'covalent_polar', crystal: 'atomic' },
];

/** Crystal melting-point order for comparison questions. */
const CRYSTAL_MELTING_RANK: Record<CrystalStructure, number> = {
  molecular: 1,
  metallic: 2,
  ionic: 3,
  atomic: 4,
};

const ALL_BOND_TYPES: BondType[] = ['ionic', 'covalent_polar', 'covalent_nonpolar', 'metallic'];
const ALL_CRYSTAL_TYPES: CrystalStructure[] = ['ionic', 'molecular', 'atomic', 'metallic'];

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

function examplesOfType(bondType: BondType): BondExample[] {
  return BOND_EXAMPLES.filter(e => e.bondType === bondType);
}

function examplesOfCrystal(crystal: CrystalStructure): BondExample[] {
  return BOND_EXAMPLES.filter(e => e.crystal === crystal);
}

/** Electronegativity map from elements array. */
function chiMap(elements: Element[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const el of elements) {
    if (el.electronegativity !== null) {
      map.set(el.symbol, el.electronegativity);
    }
  }
  return map;
}

type GeneratorFn = (elements: Element[]) => Exercise;

const generators: Record<string, GeneratorFn> = {
  identify_bond_type() {
    const example = pick(BOND_EXAMPLES);
    const correctLabel = getBondTypeLabel(example.bondType);
    const distractors = ALL_BOND_TYPES
      .filter(t => t !== example.bondType)
      .map(t => getBondTypeLabel(t));

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_bond_type',
      question: m.bond_ex_q_identify_type({ formula: example.formula }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.bond_ex_a_identify_type({ formula: example.formula, label: correctLabel.toLowerCase() }),
      competencyMap: { bond_type: 'P' },
    };
  },

  identify_crystal_structure() {
    const example = pick(BOND_EXAMPLES);
    const correctLabel = getCrystalLabel(example.crystal);
    const distractors = ALL_CRYSTAL_TYPES
      .filter(t => t !== example.crystal)
      .map(t => getCrystalLabel(t));

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_crystal_structure',
      question: m.bond_ex_q_identify_crystal({ formula: example.formula }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.bond_ex_a_identify_crystal({ formula: example.formula, label: correctLabel.toLowerCase() }),
      competencyMap: { crystal_structure_type: 'P' },
    };
  },

  select_substance_by_bond() {
    const targetType = pick(ALL_BOND_TYPES);
    const correctPool = examplesOfType(targetType);
    const correct = pick(correctPool);

    const distractorPool = BOND_EXAMPLES.filter(e => e.bondType !== targetType);
    const distractors = pickN(distractorPool, 3);

    const options = shuffleOptions([
      { id: 'correct', text: correct.formula },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d.formula })),
    ]);

    const label = getBondTypeLabel(targetType).toLowerCase();
    return {
      type: 'select_substance_by_bond',
      question: m.bond_ex_q_substance_by_bond({ label }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.bond_ex_a_substance_by_bond({ formula: correct.formula, label }),
      competencyMap: { bond_type: 'P' },
    };
  },

  predict_property_by_structure() {
    const example = pick(BOND_EXAMPLES);
    const crystal = example.crystal;
    const propertyKey = pick(['melting', 'conductivity'] as const);
    const correctValue = getCrystalProperty(crystal, propertyKey);

    const distractorValues = ALL_CRYSTAL_TYPES
      .filter(t => t !== crystal)
      .map(t => getCrystalProperty(t, propertyKey));

    const propertyLabel = propertyKey === 'melting'
      ? m.bond_ex_melting_point()
      : m.bond_ex_conductivity();

    const crystalLabel = getCrystalLabel(crystal).toLowerCase();

    const options = shuffleOptions([
      { id: 'correct', text: correctValue },
      ...distractorValues.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'predict_property_by_structure',
      question: m.bond_ex_q_predict_property({ property: propertyLabel, formula: example.formula, crystal: crystalLabel }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.bond_ex_a_predict_property({ formula: example.formula, crystal: crystalLabel, property: propertyLabel, value: correctValue.toLowerCase() }),
      competencyMap: { crystal_structure_type: 'P', bond_type: 'S' },
    };
  },

  compare_melting_points() {
    // Pick two examples with different crystal types
    const shuffled = pickN(BOND_EXAMPLES, BOND_EXAMPLES.length);
    let a: BondExample | null = null;
    let b: BondExample | null = null;

    for (let i = 0; i < shuffled.length && (!a || !b); i++) {
      if (!a) {
        a = shuffled[i];
      } else if (shuffled[i].crystal !== a.crystal) {
        b = shuffled[i];
      }
    }

    if (!a || !b) {
      // Fallback: just pick two different ones
      a = BOND_EXAMPLES[0];
      b = BOND_EXAMPLES[4];
    }

    const rankA = CRYSTAL_MELTING_RANK[a.crystal];
    const rankB = CRYSTAL_MELTING_RANK[b.crystal];
    const higherFormula = rankA >= rankB ? a.formula : b.formula;
    const higherCrystal = rankA >= rankB ? a.crystal : b.crystal;

    const options = shuffleOptions([
      { id: rankA >= rankB ? 'a' : 'b', text: a.formula },
      { id: rankA >= rankB ? 'b' : 'a', text: b.formula },
    ]);

    return {
      type: 'compare_melting_points',
      question: m.bond_ex_q_compare_melting({ formulaA: a.formula, formulaB: b.formula }),
      format: 'multiple_choice',
      options: options.map(o => ({ id: o.id === 'a' ? 'correct' : 'd0', text: o.text })),
      correctId: 'correct',
      explanation: m.bond_ex_a_compare_melting({ formula: higherFormula, crystal: getCrystalLabel(higherCrystal).toLowerCase() }),
      competencyMap: { crystal_structure_type: 'P' },
    };
  },

  bond_from_delta_chi(elements) {
    // Pick two elements that have electronegativity values
    const chi = chiMap(elements);
    const symbolsWithChi = [...chi.keys()];

    if (symbolsWithChi.length < 2) {
      // Fallback to identify_bond_type
      return generators.identify_bond_type(elements);
    }

    const [symA, symB] = pickN(symbolsWithChi, 2);
    const chiA = chi.get(symA)!;
    const chiB = chi.get(symB)!;
    const delta = Math.abs(chiA - chiB);

    let correctType: BondType;
    if (delta >= 1.7) {
      correctType = 'ionic';
    } else if (delta > 0.4) {
      correctType = 'covalent_polar';
    } else {
      correctType = 'covalent_nonpolar';
    }

    const correctLabel = getBondTypeLabel(correctType);
    const distractors = ALL_BOND_TYPES
      .filter(t => t !== correctType)
      .map(t => getBondTypeLabel(t));

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'bond_from_delta_chi',
      question: m.bond_ex_q_delta_chi({ symA, chiA: chiA.toFixed(2), symB, chiB: chiB.toFixed(2) }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.bond_ex_a_delta_chi({ delta: delta.toFixed(2), label: correctLabel }),
      competencyMap: { bond_type: 'P' },
    };
  },
};

const EXERCISE_TYPES = Object.keys(generators);

export function generateExercise(elements: Element[], type?: string): Exercise {
  const t = type ?? pick(EXERCISE_TYPES);
  const gen = generators[t];
  if (!gen) throw new Error(`Unknown exercise type: ${t}`);
  return gen(elements);
}
