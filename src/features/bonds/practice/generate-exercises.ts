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

const BOND_TYPE_LABELS: Record<BondType, string> = {
  ionic: 'Ионная',
  covalent_polar: 'Ковалентная полярная',
  covalent_nonpolar: 'Ковалентная неполярная',
  metallic: 'Металлическая',
};

const CRYSTAL_LABELS: Record<CrystalStructure, string> = {
  ionic: 'Ионная решётка',
  molecular: 'Молекулярная решётка',
  atomic: 'Атомная решётка',
  metallic: 'Металлическая решётка',
};

const CRYSTAL_PROPERTIES: Record<CrystalStructure, { melting: string; conductivity: string }> = {
  ionic: { melting: 'Высокая (800\u20133000 \u00B0C)', conductivity: 'В расплаве и растворе' },
  molecular: { melting: 'Низкая (< 300 \u00B0C)', conductivity: 'Не проводят' },
  atomic: { melting: 'Очень высокая (> 1500 \u00B0C)', conductivity: 'Не проводят (кроме графита)' },
  metallic: { melting: 'Разная (\u221239 \u00B0C Hg \u2026 3422 \u00B0C W)', conductivity: 'Высокая' },
};

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
    const correctLabel = BOND_TYPE_LABELS[example.bondType];
    const distractors = ALL_BOND_TYPES
      .filter(t => t !== example.bondType)
      .map(t => BOND_TYPE_LABELS[t]);

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_bond_type',
      question: `Какой тип связи в ${example.formula}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `В ${example.formula} \u2014 ${correctLabel.toLowerCase()} связь.`,
      competencyMap: { bond_type: 'P' },
    };
  },

  identify_crystal_structure() {
    const example = pick(BOND_EXAMPLES);
    const correctLabel = CRYSTAL_LABELS[example.crystal];
    const distractors = ALL_CRYSTAL_TYPES
      .filter(t => t !== example.crystal)
      .map(t => CRYSTAL_LABELS[t]);

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'identify_crystal_structure',
      question: `Какая кристаллическая решётка у ${example.formula}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${example.formula} имеет ${correctLabel.toLowerCase().replace('\u0440\u0435\u0448\u0451\u0442\u043A\u0430', '\u0440\u0435\u0448\u0451\u0442\u043A\u0443')}.`,
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

    return {
      type: 'select_substance_by_bond',
      question: `В каком веществе ${BOND_TYPE_LABELS[targetType].toLowerCase()} связь?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${correct.formula} \u2014 ${BOND_TYPE_LABELS[targetType].toLowerCase()} связь.`,
      competencyMap: { bond_type: 'P' },
    };
  },

  predict_property_by_structure() {
    const example = pick(BOND_EXAMPLES);
    const crystal = example.crystal;
    const propertyKey = pick(['melting', 'conductivity'] as const);
    const correctValue = CRYSTAL_PROPERTIES[crystal][propertyKey];

    const distractorValues = ALL_CRYSTAL_TYPES
      .filter(t => t !== crystal)
      .map(t => CRYSTAL_PROPERTIES[t][propertyKey]);

    const questionLabel = propertyKey === 'melting'
      ? 'температура плавления'
      : 'электропроводность';

    const options = shuffleOptions([
      { id: 'correct', text: correctValue },
      ...distractorValues.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'predict_property_by_structure',
      question: `Какова ${questionLabel} у ${example.formula} (${CRYSTAL_LABELS[crystal].toLowerCase()})?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${example.formula} имеет ${CRYSTAL_LABELS[crystal].toLowerCase()}, поэтому ${questionLabel}: ${correctValue.toLowerCase()}.`,
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
    const correctId = 'a';

    return {
      type: 'compare_melting_points',
      question: `У какого вещества выше температура плавления: ${a.formula} или ${b.formula}?`,
      format: 'multiple_choice',
      options: options.map(o => ({ id: o.id === 'a' ? 'correct' : 'd0', text: o.text })),
      correctId: 'correct',
      explanation: `${higherFormula} имеет ${CRYSTAL_LABELS[higherCrystal].toLowerCase()}, которая обычно обеспечивает более высокую температуру плавления.`,
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

    const correctLabel = BOND_TYPE_LABELS[correctType];
    const distractors = ALL_BOND_TYPES
      .filter(t => t !== correctType)
      .map(t => BOND_TYPE_LABELS[t]);

    const options = shuffleOptions([
      { id: 'correct', text: correctLabel },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'bond_from_delta_chi',
      question: `\u03C7(${symA}) = ${chiA.toFixed(2)}, \u03C7(${symB}) = ${chiB.toFixed(2)}. Какой тип связи?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `\u0394\u03C7 = ${delta.toFixed(2)}. ${correctLabel} связь.`,
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
