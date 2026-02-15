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
    const correct = `${el.period} период, ${el.group} группа`;
    const distractors = [
      `${el.period + 1} период, ${el.group} группа`,
      `${el.period} период, ${Math.max(1, el.group - 1)} группа`,
      `${Math.max(1, el.period - 1)} период, ${Math.min(18, el.group + 1)} группа`,
    ];
    const options = shuffleOptions([
      { id: 'correct', text: correct },
      ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
    ]);
    return {
      type: 'find_period_group',
      question: `Элемент с порядковым номером ${el.Z} (${el.symbol}) расположен в:`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${el.symbol} (${el.name_ru}): Z=${el.Z}, ${el.period} период, ${el.group} группа.`,
      competencyMap: { periodic_table: 'P' },
    };
  },

  select_electron_config(elements) {
    const el = pick(mainElements(elements));
    const correctFormula = getShorthandFormula(el.Z);
    // Generate distractors by tweaking nearby elements
    const nearby = mainElements(elements).filter(e => Math.abs(e.Z - el.Z) > 0 && Math.abs(e.Z - el.Z) <= 3);
    const distElements = pickN(nearby.length >= 3 ? nearby : mainElements(elements).filter(e => e.Z !== el.Z), 3);
    const options = shuffleOptions([
      { id: 'correct', text: correctFormula },
      ...distElements.map((d, i) => ({ id: `d${i}`, text: getShorthandFormula(d.Z) })),
    ]);
    return {
      type: 'select_electron_config',
      question: `Выберите правильную электронную конфигурацию элемента ${el.symbol} (Z=${el.Z}):`,
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
    return {
      type: 'count_valence',
      question: `Сколько валентных электронов у элемента ${el.symbol} (Z=${el.Z})?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${el.symbol}: конфигурация ${getShorthandFormula(el.Z)}, валентных электронов: ${count}.`,
      competencyMap: { electron_config: 'P', periodic_table: 'S' },
    };
  },

  identify_exception(elements) {
    const exceptions = mainElements(elements).filter(e => isException(e.Z));
    const normals = mainElements(elements).filter(e => !isException(e.Z));
    const excEl = pick(exceptions);
    const normalEls = pickN(normals, 3);
    const options = shuffleOptions([
      { id: 'correct', text: `${excEl.symbol} (${excEl.name_ru})` },
      ...normalEls.map((n, i) => ({ id: `d${i}`, text: `${n.symbol} (${n.name_ru})` })),
    ]);
    return {
      type: 'identify_exception',
      question: 'Какой элемент имеет аномальную электронную конфигурацию (провал электрона)?',
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `${excEl.symbol} — исключение. Реальная конфигурация: ${getShorthandFormula(excEl.Z)}.`,
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
      question: `Какому элементу соответствует электронная конфигурация ${config}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `Считаем электроны в ${config} → Z=${el.Z}, это ${el.symbol} (${el.name_ru}).`,
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
      { id: 'd1', text: 'Одинаковая' },
      { id: 'd2', text: 'Невозможно определить' },
    ]);
    return {
      type: 'compare_electronegativity',
      question: `Какой элемент имеет большую электроотрицательность: ${a.symbol} или ${b.symbol}?`,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: `Электроотрицательность: ${higher.symbol} (${higher.electronegativity}) > ${lower.symbol} (${lower.electronegativity}).`,
      competencyMap: { periodic_table: 'P' },
    };
  },

  fill_orbital_boxes(elements) {
    const el = pick(lightElements(elements));
    return {
      type: 'fill_orbital_boxes',
      question: `Заполните орбитальную диаграмму для элемента ${el.symbol} (Z=${el.Z}):`,
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
