import * as m from '../../../paraglide/messages.js';
import type { Element } from '../../../types/element';
import {
  getElectronFormula,
  getShorthandFormula,
  getValenceElectrons,
  isException,
  getElectronConfig,
} from '../../../lib/electron-config';

export interface ExerciseOption {
  id: string;
  text: string;
}

export interface Exercise {
  type: string;
  question: string;
  format: 'multiple_choice' | 'interactive_orbital';
  options: ExerciseOption[];
  correctId: string;
  explanation: string;
  competencyMap: Record<string, 'P' | 'S'>;
  targetZ?: number;
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

function mainElements(elements: Element[]): Element[] {
  return elements.filter(e => e.Z <= 86);
}

function lightElements(elements: Element[]): Element[] {
  return elements.filter(e => e.Z <= 36);
}

type GeneratorFn = (elements: Element[]) => Exercise;

const generators: Record<string, GeneratorFn> = {
  find_period_group(elements) {
    const el = pick(mainElements(elements));
    const correct = m.pt_ex_period_group({ period: String(el.period), group: String(el.group) });
    const distractors = [
      m.pt_ex_period_group({ period: String(el.period + 1), group: String(el.group) }),
      m.pt_ex_period_group({ period: String(el.period), group: String(Math.max(1, el.group - 1)) }),
      m.pt_ex_period_group({ period: String(Math.max(1, el.period - 1)), group: String(Math.min(18, el.group + 1)) }),
    ];
    const options = shuffleOptions([
      { id: 'correct', text: correct },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'find_period_group',
      question: m.pt_ex_q_position({ Z: String(el.Z), symbol: el.symbol }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.pt_ex_a_position({ symbol: el.symbol, name: el.name_ru, Z: String(el.Z), period: String(el.period), group: String(el.group) }),
      competencyMap: { periodic_table: 'P' },
    };
  },

  select_electron_config(elements) {
    const el = pick(mainElements(elements));
    const correctFormula = getShorthandFormula(el.Z);
    const nearby = mainElements(elements).filter(e => Math.abs(e.Z - el.Z) > 0 && Math.abs(e.Z - el.Z) <= 3);
    const distElements = pickN(nearby.length >= 3 ? nearby : mainElements(elements).filter(e => e.Z !== el.Z), 3);
    const options = shuffleOptions([
      { id: 'correct', text: correctFormula },
      ...distElements.map((d, i) => ({ id: `d${i}`, text: getShorthandFormula(d.Z) })),
    ]);
    return {
      type: 'select_electron_config',
      question: m.pt_ex_q_electron_config({ symbol: el.symbol, Z: String(el.Z) }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${el.symbol}: ${correctFormula}`,
      competencyMap: { electron_config: 'P' },
    };
  },

  count_valence(elements) {
    const el = pick(mainElements(elements));
    const valence = getValenceElectrons(el.Z);
    const count = valence.reduce((s, v) => s + v.electrons, 0);
    const distractors = [count + 1, count - 1, count + 2].filter(d => d > 0 && d !== count);
    while (distractors.length < 3) distractors.push(count + distractors.length + 2);
    const options = shuffleOptions([
      { id: 'correct', text: String(count) },
      ...distractors.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: String(d) })),
    ]);
    const details = valence.map(v => `${v.n}${v.l}(${v.electrons})`).join(' + ');
    return {
      type: 'count_valence',
      question: m.pt_ex_q_valence_count({ symbol: el.symbol, Z: String(el.Z) }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.pt_ex_a_valence_count({ symbol: el.symbol, config: getShorthandFormula(el.Z), period: String(el.period), details, count: String(count) }),
      competencyMap: { electron_config: 'P', periodic_table: 'S' },
    };
  },

  identify_exception(elements) {
    const OGE_EXCEPTION_Z = [24, 29];
    const exceptions = elements.filter(e => OGE_EXCEPTION_Z.includes(e.Z));
    const normals = mainElements(elements).filter(e => !isException(e.Z));
    const excEl = pick(exceptions);
    const normalEls = pickN(normals, 3);
    const options = shuffleOptions([
      { id: 'correct', text: `${excEl.symbol} (${excEl.name_ru})` },
      ...normalEls.map((n, i) => ({ id: `d${i}`, text: `${n.symbol} (${n.name_ru})` })),
    ]);
    return {
      type: 'identify_exception',
      question: m.pt_ex_q_exception(),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.pt_ex_a_exception({ symbol: excEl.symbol, config: getShorthandFormula(excEl.Z) }),
      competencyMap: { electron_config: 'P' },
    };
  },

  element_from_config(elements) {
    const el = pick(mainElements(elements));
    const config = getShorthandFormula(el.Z);
    const nearby = mainElements(elements).filter(e => Math.abs(e.Z - el.Z) > 0 && Math.abs(e.Z - el.Z) <= 4);
    const distElements = pickN(nearby.length >= 3 ? nearby : mainElements(elements).filter(e => e.Z !== el.Z), 3);
    const options = shuffleOptions([
      { id: 'correct', text: `${el.symbol} (${el.name_ru})` },
      ...distElements.map((d, i) => ({ id: `d${i}`, text: `${d.symbol} (${d.name_ru})` })),
    ]);
    return {
      type: 'element_from_config',
      question: m.pt_ex_q_element_from_config({ config }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.pt_ex_a_element_from_config({ config, Z: String(el.Z), symbol: el.symbol, name: el.name_ru }),
      competencyMap: { periodic_table: 'P', electron_config: 'S' },
    };
  },

  compare_electronegativity(elements) {
    const candidates = mainElements(elements).filter(e => e.electronegativity !== null);
    const pair = pickN(candidates, 2);
    const [a, b] = pair;
    const higher = a.electronegativity! > b.electronegativity! ? a : b;
    const lower = higher === a ? b : a;
    const options = shuffleOptions([
      { id: 'correct', text: `${higher.symbol} (${higher.electronegativity})` },
      { id: 'd0', text: `${lower.symbol} (${lower.electronegativity})` },
      { id: 'd1', text: m.pt_ex_same_value() },
      { id: 'd2', text: m.pt_ex_cannot_determine() },
    ]);
    return {
      type: 'compare_electronegativity',
      question: m.pt_ex_q_electronegativity({ symA: a.symbol, symB: b.symbol }),
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: m.pt_ex_a_electronegativity({ symHigh: higher.symbol, chiHigh: String(higher.electronegativity), symLow: lower.symbol, chiLow: String(lower.electronegativity) }),
      competencyMap: { periodic_table: 'P' },
    };
  },

  fill_orbital_boxes(elements) {
    const el = pick(lightElements(elements));
    return {
      type: 'fill_orbital_boxes',
      question: m.pt_ex_q_orbital({ symbol: el.symbol, Z: String(el.Z) }),
      format: 'interactive_orbital',
      options: [],
      correctId: '',
      explanation: `${el.symbol}: ${getElectronFormula(el.Z)}`,
      competencyMap: { electron_config: 'P' },
      targetZ: el.Z,
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

export function getExerciseTypes(): string[] {
  return EXERCISE_TYPES;
}
