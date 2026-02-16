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

interface OxExample {
  formula: string;
  element: string;
  state: number;
}

const OX_EXAMPLES: OxExample[] = [
  { formula: 'KMnO4', element: 'Mn', state: 7 },
  { formula: 'H2SO4', element: 'S', state: 6 },
  { formula: 'HNO3', element: 'N', state: 5 },
  { formula: 'Fe2O3', element: 'Fe', state: 3 },
  { formula: 'CuSO4', element: 'Cu', state: 2 },
  { formula: 'CuSO4', element: 'S', state: 6 },
  { formula: 'NaH', element: 'H', state: -1 },
  { formula: 'H2O2', element: 'O', state: -1 },
  { formula: 'NH3', element: 'N', state: -3 },
  { formula: 'CO2', element: 'C', state: 4 },
  { formula: 'Na2O', element: 'Na', state: 1 },
  { formula: 'CaCl2', element: 'Ca', state: 2 },
  { formula: 'CaCl2', element: 'Cl', state: -1 },
  { formula: 'Al2O3', element: 'Al', state: 3 },
  { formula: 'P2O5', element: 'P', state: 5 },
  { formula: 'SO3', element: 'S', state: 6 },
  { formula: 'Cr2O3', element: 'Cr', state: 3 },
  { formula: 'K2Cr2O7', element: 'Cr', state: 6 },
  { formula: 'MnO2', element: 'Mn', state: 4 },
  { formula: 'FeCl3', element: 'Fe', state: 3 },
  { formula: 'CuO', element: 'Cu', state: 2 },
  { formula: 'N2O5', element: 'N', state: 5 },
];

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

/** Electron config exception elements (провал электрона). */
const EXCEPTION_Z = new Set([24, 29, 41, 42, 44, 45, 46, 47, 78, 79]);

function formatState(state: number): string {
  if (state > 0) return `+${state}`;
  if (state < 0) return `\u2212${Math.abs(state)}`;
  return '0';
}

type GeneratorFn = (elements: Element[]) => Exercise;

const generators: Record<string, GeneratorFn> = {
  determine_ox_state() {
    const example = pick(OX_EXAMPLES);
    const correctText = formatState(example.state);

    // Generate 3 distinct distractors
    const distractorSet = new Set<number>();
    while (distractorSet.size < 3) {
      const offset = pick([-3, -2, -1, 1, 2, 3]);
      const val = example.state + offset;
      if (val !== example.state && Math.abs(val) <= 8) {
        distractorSet.add(val);
      }
    }
    const distractors = [...distractorSet].map(v => formatState(v));

    const options = shuffleOptions([
      { id: 'correct', text: correctText },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    return {
      type: 'determine_ox_state',
      question: `Определите СО ${example.element} в ${example.formula}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `В ${example.formula} степень окисления ${example.element} равна ${correctText}.`,
      competencyMap: { oxidation_states: 'P' },
    };
  },

  select_compound_by_ox_state() {
    const example = pick(OX_EXAMPLES);
    const stateText = formatState(example.state);

    // Find distractors: formulas where this element has a different state
    const sameElement = OX_EXAMPLES.filter(
      e => e.element === example.element && e.state !== example.state,
    );

    // Fill remaining distractors with other formulas
    const otherFormulas = OX_EXAMPLES.filter(
      e => e.formula !== example.formula && e.element !== example.element,
    );

    const distractorPool = [...sameElement, ...otherFormulas];
    const distractors = pickN(distractorPool, 3);

    const options = shuffleOptions([
      { id: 'correct', text: example.formula },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d.formula })),
    ]);

    return {
      type: 'select_compound_by_ox_state',
      question: `В каком соединении ${example.element} имеет СО = ${stateText}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `В ${example.formula} степень окисления ${example.element} равна ${stateText}.`,
      competencyMap: { oxidation_states: 'P' },
    };
  },

  max_min_ox_state(elements) {
    // Pick a non-noble-gas element with multiple typical oxidation states
    const candidates = elements.filter(
      el => el.typical_oxidation_states.length >= 2 && el.element_group !== 'noble_gas',
    );
    if (candidates.length === 0) {
      return generators.determine_ox_state(elements);
    }

    const el = pick(candidates);
    const states = el.typical_oxidation_states;
    const isMax = Math.random() > 0.5;
    const correctState = isMax ? Math.max(...states) : Math.min(...states);
    const label = isMax ? 'максимальная' : 'минимальная';
    const correctText = formatState(correctState);

    // Distractors: other states from this element + random nearby
    const distractorSet = new Set<number>();
    for (const s of states) {
      if (s !== correctState) distractorSet.add(s);
    }
    while (distractorSet.size < 3) {
      const offset = pick([-2, -1, 1, 2]);
      const val = correctState + offset;
      if (val !== correctState && Math.abs(val) <= 8 && !distractorSet.has(val)) {
        distractorSet.add(val);
      }
    }
    const distractors = [...distractorSet].slice(0, 3).map(v => formatState(v));

    const options = shuffleOptions([
      { id: 'correct', text: correctText },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);

    let explanation = `${label.charAt(0).toUpperCase() + label.slice(1)} степень окисления ${el.symbol} равна ${correctText}.`;
    if (EXCEPTION_Z.has(el.Z)) {
      explanation += ` Обратите внимание: ${el.symbol} — элемент с провалом электрона, что влияет на его электронную конфигурацию.`;
    }

    return {
      type: 'max_min_ox_state',
      question: `Какова ${label} СО ${el.symbol} (${el.name_ru})?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation,
      competencyMap: { oxidation_states: 'P' },
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
