import { describe, it, expect } from 'vitest';
import { createTaskEngine } from '../task-engine';
import type { OntologyData, PropertyDef, TaskTemplate, PromptTemplateMap } from '../types';
import type { Element } from '../../../types/element';
import type { Ion } from '../../../types/ion';
import type { OxidationExample } from '../../../types/oxidation';

// ── Mock data (3 elements, 2 templates) ──────────────────────────

const MOCK_ELEMENTS: Element[] = [
  {
    Z: 11, symbol: 'Na', name_ru: 'Натрий', name_en: 'Sodium', name_latin: 'Natrium',
    group: 1, period: 3, metal_type: 'metal', element_group: 'alkali_metal',
    atomic_mass: 22.99, typical_oxidation_states: [1], electronegativity: 0.93,
  },
  {
    Z: 12, symbol: 'Mg', name_ru: 'Магний', name_en: 'Magnesium', name_latin: 'Magnesium',
    group: 2, period: 3, metal_type: 'metal', element_group: 'alkaline_earth',
    atomic_mass: 24.305, typical_oxidation_states: [2], electronegativity: 1.31,
  },
  {
    Z: 17, symbol: 'Cl', name_ru: 'Хлор', name_en: 'Chlorine', name_latin: 'Chlorum',
    group: 17, period: 3, metal_type: 'nonmetal', element_group: 'halogen',
    atomic_mass: 35.45, typical_oxidation_states: [-1, 1, 3, 5, 7], electronegativity: 3.16,
  },
];

const MOCK_PROPERTIES: PropertyDef[] = [
  {
    id: 'electronegativity', value_field: 'electronegativity', object: 'element',
    unit: null, trend_hint: { period: 'increases', group: 'decreases' },
    filter: null,
    i18n: { en: { nom: 'electronegativity', gen: 'electronegativity' } },
  },
];

const MOCK_IONS: Ion[] = [
  { id: 'Na_plus', formula: 'Na\u207a', charge: 1, type: 'cation', name_ru: 'Ион натрия', tags: ['alkali'] },
  { id: 'Cl_minus', formula: 'Cl\u207b', charge: -1, type: 'anion', name_ru: 'Хлорид-ион', tags: ['chloride'] },
];

const MOCK_OXIDATION_EXAMPLES: OxidationExample[] = [
  { formula: 'H\u2082SO\u2084', target_element: 'S', oxidation_state: 6, difficulty: 'medium' },
  { formula: 'NaCl', target_element: 'Na', oxidation_state: 1, difficulty: 'easy' },
];

const MOCK_PROMPTS: PromptTemplateMap = {
  'compare_property_prompt': {
    question: 'Which element has higher {property_name}: {elementA} or {elementB}?',
    slots: {
      property_name: 'lookup:properties.{property}.i18n.en.nom',
    },
  },
  'oxidation_prompt': {
    question: 'What is the oxidation state of {element} in {formula}?',
    slots: {},
  },
};

const MOCK_DATA: OntologyData = {
  elements: MOCK_ELEMENTS,
  ions: MOCK_IONS,
  properties: MOCK_PROPERTIES,
  solubilityPairs: [],
  oxidationExamples: MOCK_OXIDATION_EXAMPLES,
  morphology: null,
  promptTemplates: MOCK_PROMPTS,
};

// ── Mock templates ───────────────────────────────────────────────

const COMPARE_TEMPLATE: TaskTemplate = {
  template_id: 'compare_property',
  meta: {
    interaction: 'choice_single',
    objects: ['element'],
    reasoning: ['property_lookup'],
    evaluation: { mode: 'exact' },
  },
  pipeline: {
    generator: {
      id: 'gen.pick_element_pair',
      params: { require_field: 'electronegativity' },
    },
    solvers: [
      { id: 'solver.compare_property', params: {} },
    ],
    renderers: [],
  },
  prompt_template_id: 'compare_property_prompt',
  explanation_template_id: '',
  evidence_rules: ['periodic_trends'],
  difficulty_model: {
    features: { needs_trend: true },
    target_band: [0.3, 0.6],
  },
  exam_tags: ['oge_2'],
  competency_hint: { periodic_trends: 'P', oxidation_states: 'S' },
};

const OXIDATION_TEMPLATE: TaskTemplate = {
  template_id: 'determine_state',
  meta: {
    interaction: 'numeric_input',
    objects: ['element'],
    reasoning: ['constraint_satisfaction'],
    evaluation: { mode: 'exact' },
  },
  pipeline: {
    generator: {
      id: 'gen.pick_oxidation_example',
      params: {},
    },
    solvers: [
      { id: 'solver.oxidation_states', params: {} },
    ],
    renderers: [],
  },
  prompt_template_id: 'oxidation_prompt',
  explanation_template_id: '',
  evidence_rules: ['oxidation_rules'],
  difficulty_model: {
    features: { needs_rules: true },
    target_band: [0.4, 0.7],
  },
  exam_tags: ['oge_4'],
  competency_hint: { oxidation_states: 'P' },
};

const ALL_TEMPLATES = [COMPARE_TEMPLATE, OXIDATION_TEMPLATE];

// ── Tests ────────────────────────────────────────────────────────

describe('TaskEngine', () => {
  describe('generate(templateId)', () => {
    it('returns a valid GeneratedTask for compare_property', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      const task = engine.generate('compare_property');

      expect(task.template_id).toBe('compare_property');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.question).toBe('string');
      expect(task.question.length).toBeGreaterThan(0);
      expect(task.correct_answer).toBeDefined();
      expect(task.competency_map).toEqual({ periodic_trends: 'P', oxidation_states: 'S' });
      expect(task.exam_tags).toEqual(['oge_2']);
      expect(task.distractors.length).toBeGreaterThan(0);
      expect(task.distractors).not.toContain(task.correct_answer);
    });

    it('returns a valid GeneratedTask for determine_state (numeric)', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      const task = engine.generate('determine_state');

      expect(task.template_id).toBe('determine_state');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.question).toBe('string');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.competency_map).toEqual({ oxidation_states: 'P' });
    });

    it('throws on unknown template ID', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      expect(() => engine.generate('nonexistent')).toThrow('Unknown template');
    });

    it('includes filled slots in the result', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      const task = engine.generate('compare_property');

      expect(task.slots).toBeDefined();
      expect(task.slots.elementA).toBeDefined();
      expect(task.slots.elementB).toBeDefined();
      expect(task.slots.property).toBe('electronegativity');
    });

    it('computes difficulty as midpoint of target band', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);

      const compare = engine.generate('compare_property');
      expect(compare.difficulty).toBeCloseTo(0.45);

      const oxidation = engine.generate('determine_state');
      expect(oxidation.difficulty).toBeCloseTo(0.55);
    });
  });

  describe('generateRandom()', () => {
    it('returns a GeneratedTask from any template', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      const task = engine.generateRandom();

      expect(['compare_property', 'determine_state']).toContain(task.template_id);
      expect(typeof task.question).toBe('string');
      expect(task.question.length).toBeGreaterThan(0);
    });

    it('throws when no templates are registered', () => {
      const engine = createTaskEngine([], MOCK_DATA);
      expect(() => engine.generateRandom()).toThrow('No templates registered');
    });
  });

  describe('generateForCompetency()', () => {
    it('picks a template matching the competency', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      const task = engine.generateForCompetency('oxidation_states');

      expect(task).not.toBeNull();
      expect(task!.competency_map).toHaveProperty('oxidation_states');
    });

    it('returns only compare_property for periodic_trends', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      // Only compare_property has periodic_trends in its competency_hint
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('periodic_trends');
        expect(task).not.toBeNull();
        expect(task!.template_id).toBe('compare_property');
      }
    });

    it('returns null for nonexistent competency', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      const task = engine.generateForCompetency('nonexistent');
      expect(task).toBeNull();
    });
  });

  describe('toExercise()', () => {
    it('converts GeneratedTask to Exercise with shuffled options', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      const task = engine.generate('compare_property');
      const exercise = engine.toExercise(task);

      expect(exercise.type).toBe('compare_property');
      expect(exercise.format).toBe('multiple_choice');
      expect(exercise.correctId).toBe('correct');
      expect(typeof exercise.question).toBe('string');
      expect(exercise.competencyMap).toEqual(task.competency_map);

      // Options must include the correct answer
      const correctOption = exercise.options.find(o => o.id === 'correct');
      expect(correctOption).toBeDefined();
      expect(correctOption!.text).toBe(String(task.correct_answer));

      // Must have distractors + correct = total options
      expect(exercise.options.length).toBe(task.distractors.length + 1);
    });

    it('all option IDs are unique', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      const task = engine.generate('compare_property');
      const exercise = engine.toExercise(task);

      const ids = exercise.options.map(o => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('works for numeric tasks too', () => {
      const engine = createTaskEngine(ALL_TEMPLATES, MOCK_DATA);
      const task = engine.generate('determine_state');
      const exercise = engine.toExercise(task);

      expect(exercise.format).toBe('multiple_choice');
      const correctOption = exercise.options.find(o => o.id === 'correct');
      expect(correctOption).toBeDefined();
      expect(correctOption!.text).toBe(String(task.correct_answer));
    });
  });
});
