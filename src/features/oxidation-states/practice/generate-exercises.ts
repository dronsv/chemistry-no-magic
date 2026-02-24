import * as m from '../../../paraglide/messages.js';
import type { Element } from '../../../types/element';
import type { OxidationExample } from '../../../types/oxidation';

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
  elements: Element[];
  oxidationExamples: OxidationExample[];
}

interface OxExample {
  formula: string;
  element: string;
  state: number;
}

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

/** Map data-file format to internal generator format. */
function toOxExamples(examples: OxidationExample[]): OxExample[] {
  return examples.map(e => ({
    formula: e.formula,
    element: e.target_element,
    state: e.oxidation_state,
  }));
}

type GeneratorFn = (elements: Element[], oxExamples: OxExample[]) => Exercise;

const generators: Record<string, GeneratorFn> = {
  determine_ox_state(_elements, oxExamples) {
    const example = pick(oxExamples);
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
      question: m.ox_ex_q_determine({ element: example.element, formula: example.formula }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.ox_ex_a_state({ formula: example.formula, element: example.element, state: correctText }),
      competencyMap: { oxidation_states: 'P' },
    };
  },

  select_compound_by_ox_state(_elements, oxExamples) {
    const example = pick(oxExamples);
    const stateText = formatState(example.state);

    // Find distractors: formulas where this element has a different state
    const sameElement = oxExamples.filter(
      e => e.element === example.element && e.state !== example.state,
    );

    // Fill remaining distractors with other formulas
    const otherFormulas = oxExamples.filter(
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
      question: m.ox_ex_q_compound_by_state({ element: example.element, state: stateText }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.ox_ex_a_state({ formula: example.formula, element: example.element, state: stateText }),
      competencyMap: { oxidation_states: 'P' },
    };
  },

  max_min_ox_state(elements, oxExamples) {
    // Pick a non-noble-gas element with multiple typical oxidation states
    const candidates = elements.filter(
      el => el.typical_oxidation_states.length >= 2 && el.element_group !== 'noble_gas',
    );
    if (candidates.length === 0) {
      return generators.determine_ox_state(elements, oxExamples);
    }

    const el = pick(candidates);
    const states = el.typical_oxidation_states;
    const isMax = Math.random() > 0.5;
    const correctState = isMax ? Math.max(...states) : Math.min(...states);
    const label = isMax ? m.ox_ex_maximum() : m.ox_ex_minimum();
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

    let explanation = m.ox_ex_a_max_min({ Label: label.charAt(0).toUpperCase() + label.slice(1), symbol: el.symbol, state: correctText });
    if (EXCEPTION_Z.has(el.Z)) {
      explanation += ` ${m.ox_ex_a_exception_note({ symbol: el.symbol })}`;
    }

    return {
      type: 'max_min_ox_state',
      question: m.ox_ex_q_max_min({ label, symbol: el.symbol, name: el.name_ru }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation,
      competencyMap: { oxidation_states: 'P' },
    };
  },
};

const EXERCISE_TYPES = Object.keys(generators);

export function generateExercise(ctx: GeneratorContext, type?: string): Exercise {
  const t = type ?? pick(EXERCISE_TYPES);
  const gen = generators[t];
  if (!gen) throw new Error(`Unknown exercise type: ${t}`);
  const oxExamples = toOxExamples(ctx.oxidationExamples);
  return gen(ctx.elements, oxExamples);
}
