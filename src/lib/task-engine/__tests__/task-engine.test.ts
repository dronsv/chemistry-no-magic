import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createTaskEngine } from '../task-engine';
import type { OntologyData, PropertyDef, TaskTemplate, PromptTemplateMap, GeneratedTask } from '../types';
import type { Element } from '../../../types/element';
import type { Ion } from '../../../types/ion';
import type { OxidationExample } from '../../../types/oxidation';
import type { BondExamplesData } from '../../../types/bond';
import type { ClassificationRule, NamingRule, SubstanceIndexEntry } from '../../../types/classification';
import type { Reaction } from '../../../types/reaction';
import type { ActivitySeriesEntry } from '../../../types/rules';
import type { QualitativeTest } from '../../../types/qualitative';
import type { GeneticChain } from '../../../types/genetic-chain';
import type { EnergyCatalystTheory } from '../../../types/energy-catalyst';
import type { CalculationsData } from '../../../types/calculations';

// ── Mock data (3 elements, 2 templates) ──────────────────────────

const MOCK_ELEMENTS: Element[] = [
  {
    Z: 11, symbol: 'Na', name_ru: '\u041D\u0430\u0442\u0440\u0438\u0439', name_en: 'Sodium', name_latin: 'Natrium',
    group: 1, period: 3, metal_type: 'metal', element_group: 'alkali_metal',
    atomic_mass: 22.99, typical_oxidation_states: [1], electronegativity: 0.93,
  },
  {
    Z: 12, symbol: 'Mg', name_ru: '\u041C\u0430\u0433\u043D\u0438\u0439', name_en: 'Magnesium', name_latin: 'Magnesium',
    group: 2, period: 3, metal_type: 'metal', element_group: 'alkaline_earth',
    atomic_mass: 24.305, typical_oxidation_states: [2], electronegativity: 1.31,
  },
  {
    Z: 17, symbol: 'Cl', name_ru: '\u0425\u043B\u043E\u0440', name_en: 'Chlorine', name_latin: 'Chlorum',
    group: 17, period: 3, metal_type: 'nonmetal', element_group: 'halogen',
    atomic_mass: 35.45, typical_oxidation_states: [-1, 1, 3, 5, 7], electronegativity: 3.16,
  },
  {
    Z: 13, symbol: 'Al', name_ru: '\u0410\u043B\u044E\u043C\u0438\u043D\u0438\u0439', name_en: 'Aluminium', name_latin: 'Aluminium',
    group: 13, period: 3, metal_type: 'metal', element_group: 'post_transition',
    atomic_mass: 26.98, typical_oxidation_states: [3], electronegativity: 1.61,
    amphoteric: true,
  } as Element,
  {
    Z: 30, symbol: 'Zn', name_ru: '\u0426\u0438\u043D\u043A', name_en: 'Zinc', name_latin: 'Zincum',
    group: 12, period: 4, metal_type: 'metal', element_group: 'transition_metal',
    atomic_mass: 65.38, typical_oxidation_states: [2], electronegativity: 1.65,
    amphoteric: true,
  } as Element,
  {
    Z: 1, symbol: 'H', name_ru: '\u0412\u043E\u0434\u043E\u0440\u043E\u0434', name_en: 'Hydrogen', name_latin: 'Hydrogenium',
    group: 1, period: 1, metal_type: 'nonmetal', element_group: 'nonmetal',
    atomic_mass: 1.008, typical_oxidation_states: [1, -1], electronegativity: 2.2,
  },
  {
    Z: 8, symbol: 'O', name_ru: '\u041A\u0438\u0441\u043B\u043E\u0440\u043E\u0434', name_en: 'Oxygen', name_latin: 'Oxygenium',
    group: 16, period: 2, metal_type: 'nonmetal', element_group: 'nonmetal',
    atomic_mass: 15.999, typical_oxidation_states: [-2], electronegativity: 3.44,
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

const MOCK_IONS_WITH_NAMING: Ion[] = [
  { id: 'Cl_minus', formula: 'Cl\u207b', charge: -1, type: 'anion', name_ru: '\u0425\u043b\u043e\u0440\u0438\u0434-\u0438\u043e\u043d', tags: ['chloride'], naming: { root_ru: '\u0445\u043b\u043e\u0440', suffix_ru: '-\u0438\u0434', oxidation_state: -1 } },
  { id: 'SO4_2minus', formula: 'SO\u2084\u00b2\u207b', charge: -2, type: 'anion', name_ru: '\u0421\u0443\u043b\u044c\u0444\u0430\u0442-\u0438\u043e\u043d', tags: ['sulfate'], naming: { root_ru: '\u0441\u0443\u043b\u044c\u0444', suffix_ru: '-\u0430\u0442', oxidation_state: 6 } },
  { id: 'Na_plus', formula: 'Na\u207a', charge: 1, type: 'cation', name_ru: '\u0418\u043e\u043d \u043d\u0430\u0442\u0440\u0438\u044f', tags: ['alkali'] },
];

const MOCK_ION_NOMENCLATURE = {
  suffix_rules: [
    { id: 'binary_anion', condition: '\u0431\u0435\u0441\u043a\u0438\u0441\u043b\u043e\u0440\u043e\u0434\u043d\u0430\u044f \u043a\u0438\u0441\u043b\u043e\u0442\u0430', suffix_ru: '-\u0438\u0434', suffix_en: '-ide', description_ru: '\u0414\u043b\u044f \u0431\u0435\u0441\u043a\u0438\u0441\u043b\u043e\u0440\u043e\u0434\u043d\u044b\u0445 \u0430\u043d\u0438\u043e\u043d\u043e\u0432', examples: ['Cl\u207b \u2014 \u0445\u043b\u043e\u0440\u0438\u0434'] },
    { id: 'oxy_max', condition: '\u043c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u0441\u0442\u0435\u043f\u0435\u043d\u044c \u043e\u043a\u0438\u0441\u043b\u0435\u043d\u0438\u044f', suffix_ru: '-\u0430\u0442', suffix_en: '-ate', description_ru: '\u0414\u043b\u044f \u043a\u0438\u0441\u043b\u043e\u0440\u043e\u0434\u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0449\u0438\u0445 \u0430\u043d\u0438\u043e\u043d\u043e\u0432 (\u043c\u0430\u043a\u0441. \u0441.\u043e.)', examples: ['SO\u2084\u00b2\u207b \u2014 \u0441\u0443\u043b\u044c\u0444\u0430\u0442'] },
  ],
  multilingual_comparison: { description_ru: '\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435', columns: ['ru', 'en'], binary: ['\u0445\u043b\u043e\u0440\u0438\u0434', 'chloride'], oxy_max: ['\u0441\u0443\u043b\u044c\u0444\u0430\u0442', 'sulfate'], oxy_lower: ['\u0441\u0443\u043b\u044c\u0444\u0438\u0442', 'sulfite'] },
  mnemonic_ru: '\u0410\u0442 \u2014 \u0431\u043e\u043b\u044c\u0448\u0435 \u043a\u0438\u0441\u043b\u043e\u0440\u043e\u0434\u0430, \u0438\u0442 \u2014 \u043c\u0435\u043d\u044c\u0448\u0435',
  acid_to_anion_pairs: [
    { acid: 'HCl', anion_id: 'Cl_minus', acid_name_ru: '\u0441\u043e\u043b\u044f\u043d\u0430\u044f \u043a\u0438\u0441\u043b\u043e\u0442\u0430' },
    { acid: 'H2SO4', anion_id: 'SO4_2minus', acid_name_ru: '\u0441\u0435\u0440\u043d\u0430\u044f \u043a\u0438\u0441\u043b\u043e\u0442\u0430' },
  ],
};

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
  core: { elements: MOCK_ELEMENTS, ions: MOCK_IONS, properties: MOCK_PROPERTIES },
  rules: { solubilityPairs: [], oxidationExamples: MOCK_OXIDATION_EXAMPLES },
  data: {},
  i18n: { morphology: null, promptTemplates: MOCK_PROMPTS },
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

// ── Phase 2 integration tests ─────────────────────────────────────

const PHASE2_PROMPTS: PromptTemplateMap = {
  ...MOCK_PROMPTS,
  'prompt.compare_property': {
    question: 'Which element has higher {property}: {elementA} or {elementB}?',
    slots: { property: 'lookup:properties.{property}.i18n.en.nom' },
  },
  'prompt.order_by_property': {
    question: 'Arrange {elements} in {order} order of {property}.',
    slots: {
      order: { ascending: 'ascending', descending: 'descending' },
      property: 'lookup:properties.{property}.i18n.en.nom',
    },
  },
  'prompt.determine_oxidation_state': {
    question: 'Determine the oxidation state of {element} in {formula}.',
    slots: {},
  },
  'prompt.compose_salt': {
    question: 'What is the formula of the salt from {cation} and {anion}?',
    slots: {},
  },
  'prompt.solubility_of_salt': {
    question: 'Is {salt_formula} soluble?',
    slots: {},
  },
  'prompt.identify_bond_type': {
    question: 'Identify the bond type in {formula}.',
    slots: {},
  },
  'prompt.identify_crystal_type': {
    question: 'Identify the crystal structure of {formula}.',
    slots: {},
  },
  'prompt.compare_melting_points': {
    question: 'Which has higher melting point: {formulaA} or {formulaB}?',
    slots: {},
  },
  'prompt.classify_substance': {
    question: 'Classify the substance {formula}.',
    slots: {},
  },
  'prompt.identify_reaction_type': {
    question: 'Identify the reaction type: {equation}',
    slots: {},
  },
  'prompt.select_by_bond_type': {
    question: 'Which substance has a {bond_type} bond?',
    slots: {
      bond_type: {
        ionic: 'ionic', covalent_polar: 'covalent polar',
        covalent_nonpolar: 'covalent nonpolar', metallic: 'metallic',
      },
    },
  },
  'prompt.select_by_class': {
    question: 'Which substance is an {substance_class}?',
    slots: {
      substance_class: { oxide: 'oxide', acid: 'acid', base: 'base', salt: 'salt' },
    },
  },
  'prompt.max_oxidation_state': {
    question: 'What is the max oxidation state of {element}?',
    slots: {},
  },
  'prompt.find_period': {
    question: 'In which period is {element}?',
    slots: {},
  },
  'prompt.find_group': {
    question: 'In which group is {element}?',
    slots: {},
  },
  'prompt.select_electron_config': {
    question: 'What is the electron configuration of {element}?',
    slots: {},
  },
  'prompt.count_valence': {
    question: 'How many valence electrons does {element} have?',
    slots: {},
  },
  'prompt.element_from_config': {
    question: 'Which element has the electron configuration {config}?',
    slots: {},
  },
  'prompt.fill_orbital': {
    question: 'Fill the orbital diagram for {element}.',
    slots: {},
  },
  'prompt.predict_crystal_property': {
    question: 'Which physical properties are characteristic of substances with a {crystal_type} crystal structure?',
    slots: {
      crystal_type: {
        ionic: 'ionic', molecular: 'molecular',
        atomic: 'atomic', metallic: 'metallic',
      },
    },
  },
  'prompt.bond_from_delta_chi': {
    question: 'Determine the bond type in the compound formed by {elementA} and {elementB} based on electronegativity difference.',
    slots: {},
  },
  'prompt.select_compound_by_state': {
    question: 'In which compound does {element} have an oxidation state of {expected_state}?',
    slots: {},
  },
  'prompt.min_oxidation_state': {
    question: 'What is the minimum typical oxidation state of {element}?',
    slots: {},
  },
  'prompt.classify_subclass': {
    question: 'Classify the subclass of the substance {formula}.',
    slots: {},
  },
  'prompt.identify_class_by_desc': {
    question: 'Which class of inorganic substances matches this description: {description}?',
    slots: {},
  },
  'prompt.formula_to_name': {
    question: 'What is the name of the substance {formula}?',
    slots: {},
  },
  'prompt.name_to_formula': {
    question: 'Write the formula of the substance "{name}".',
    slots: {},
  },
  'prompt.identify_amphoteric': {
    question: 'Which substance is amphoteric?',
    slots: {},
  },
  'prompt.amphoteric_reaction_partner': {
    question: 'The substance {formula} is amphoteric. With which types of substances can it react?',
    slots: {},
  },
  'prompt.naming_rule_template': {
    question: 'Which naming rule applies to the substance {formula}?',
    slots: {},
  },
  'prompt.predict_exchange_products': {
    question: 'Predict the products of the exchange reaction: {equation}',
    slots: {},
  },
  'prompt.identify_driving_force': {
    question: 'What is the driving force of the reaction: {equation}?',
    slots: {},
  },
  'prompt.will_reaction_occur': {
    question: 'Will this reaction occur? {equation}',
    slots: {},
  },
  'prompt.activity_series_compare': {
    question: 'Can {metalA} displace {metalB} from a salt solution?',
    slots: {},
  },
  'prompt.will_metal_react': {
    question: 'Will {metalA} react with dilute acid (release H\u2082)?',
    slots: {},
  },
  'prompt.match_ionic_equation': {
    question: 'Match the molecular equation to its net ionic form.',
    slots: {},
  },
  'prompt.identify_spectator_ions': {
    question: 'Identify the spectator ions in the reaction: {equation}',
    slots: {},
  },
  'prompt.identify_reagent_for_ion': {
    question: 'What reagent is used to detect the ion {target_name}?',
    slots: {},
  },
  'prompt.identify_ion_by_obs': {
    question: 'Which ion is detected by the observation: {observation}?',
    slots: {},
  },
  'prompt.complete_chain_step': {
    question: 'Complete the missing substance in the chain: {chain_substances}',
    slots: {},
  },
  'prompt.choose_reagent_for_step': {
    question: 'What reagent is needed for the step: {substance} \u2192 ?',
    slots: {},
  },
  'prompt.identify_oxidizer_reducer': {
    question: 'Identify the oxidizing agent in the reaction: {equation}',
    slots: {},
  },
  'prompt.predict_substitution': {
    question: 'Predict the products of the substitution reaction: {equation}',
    slots: {},
  },
  'prompt.factors_affecting_rate': {
    question: 'Which factor affects the reaction rate?',
    slots: {},
  },
  'prompt.exo_endo_classify': {
    question: 'Is the reaction exothermic or endothermic: {equation}?',
    slots: {},
  },
  'prompt.equilibrium_shift': {
    question: 'How will the equilibrium shift if {eq_factor} changes?',
    slots: {},
  },
  'prompt.catalyst_properties': {
    question: 'What catalyst is used for the reaction: {catalyst_reaction}?',
    slots: {},
  },
  'prompt.identify_catalyst': {
    question: 'Identify the catalyst for the given reaction.',
    slots: {},
  },
  'prompt.calc_molar_mass': {
    question: 'Calculate the molar mass of {formula}.',
    slots: {},
  },
  'prompt.calc_mass_fraction': {
    question: 'Calculate the mass fraction of {element} in {formula}.',
    slots: {},
  },
  'prompt.calc_amount': {
    question: 'Calculate the amount of substance (mol) for {mass} g of {formula}.',
    slots: {},
  },
  'prompt.calc_mass_from_moles': {
    question: 'Calculate the mass of {amount} mol of {formula}.',
    slots: {},
  },
  'prompt.calc_concentration': {
    question: 'Calculate the mass fraction if {m_solute} g of solute is dissolved in {m_solution} g of solution.',
    slots: {},
  },
  'prompt.calc_solute_mass': {
    question: 'Calculate the mass of solute needed for {m_solution} g of {omega}% solution.',
    slots: {},
  },
  'prompt.calc_dilution': {
    question: 'How much solution is needed to dilute {m_solution} g of {omega}% solution to {omega_target}%?',
    slots: {},
  },
  'prompt.calc_by_equation': {
    question: 'Calculate the mass of {find_formula} from {given_mass} g of {given_formula}. Equation: {equation}',
    slots: {},
  },
  'prompt.calc_yield': {
    question: 'Calculate the practical yield of {find_formula} from {given_mass} g of {given_formula} at {yield_percent}% yield.',
    slots: {},
  },
  'prompt.ion_formula_to_name': {
    question: 'What is the name of the ion {ionA_formula}?',
    slots: {},
  },
  'prompt.ion_name_to_formula': {
    question: 'Write the formula of the ion {ionA_name}.',
    slots: {},
  },
  'prompt.ion_suffix_rule': {
    question: 'What suffix does the ion {ionA_formula} use in nomenclature?',
    slots: {},
  },
  'prompt.acid_to_anion': {
    question: 'What anion does {acid_name} ({acid_formula}) form?',
    slots: {},
  },
  'prompt.anion_to_acid': {
    question: 'Which acid produces the anion {anion_formula}?',
    slots: {},
  },
  'prompt.ate_ite_pair': {
    question: 'What is the suffix of the ion {ionB_formula}?',
    slots: {},
  },
  'prompt.ox_state_to_suffix': {
    question: 'Which suffix corresponds to the condition: {condition}?',
    slots: {},
  },
  'prompt.classify_suffix_type': {
    question: 'What is the naming condition for the suffix "{suffix_ru}"?',
    slots: {},
  },
};

const PHASE2_BOND_EXAMPLES: BondExamplesData = {
  examples: [
    { formula: 'NaCl', bond_type: 'ionic', crystal_type: 'ionic' },
    { formula: 'H2O', bond_type: 'covalent_polar', crystal_type: 'molecular' },
    { formula: 'H2', bond_type: 'covalent_nonpolar', crystal_type: 'molecular' },
    { formula: 'Fe', bond_type: 'metallic', crystal_type: 'metallic' },
    { formula: 'SiO2', bond_type: 'covalent_polar', crystal_type: 'atomic' },
  ],
  crystal_melting_rank: { molecular: 1, metallic: 2, ionic: 3, atomic: 4 },
};

const PHASE2_SUBSTANCE_INDEX: SubstanceIndexEntry[] = [
  { id: 'nacl', formula: 'NaCl', name_ru: '\u0425\u043B\u043E\u0440\u0438\u0434 \u043D\u0430\u0442\u0440\u0438\u044F', class: 'salt', subclass: 'medium_salt' },
  { id: 'hcl', formula: 'HCl', name_ru: '\u0425\u043B\u043E\u0440\u043E\u0432\u043E\u0434\u043E\u0440\u043E\u0434\u043D\u0430\u044F \u043A\u0438\u0441\u043B\u043E\u0442\u0430', class: 'acid', subclass: 'non_oxygenated' },
  { id: 'naoh', formula: 'NaOH', name_ru: '\u0413\u0438\u0434\u0440\u043E\u043A\u0441\u0438\u0434 \u043D\u0430\u0442\u0440\u0438\u044F', class: 'base', subclass: 'soluble_base' },
  { id: 'na2o', formula: 'Na\u2082O', name_ru: '\u041E\u043A\u0441\u0438\u0434 \u043D\u0430\u0442\u0440\u0438\u044F', class: 'oxide', subclass: 'basic_oxide' },
  { id: 'h2so4', formula: 'H\u2082SO\u2084', name_ru: '\u0421\u0435\u0440\u043D\u0430\u044F \u043A\u0438\u0441\u043B\u043E\u0442\u0430', class: 'acid', subclass: 'oxygenated' },
  { id: 'cao', formula: 'CaO', name_ru: '\u041E\u043A\u0441\u0438\u0434 \u043A\u0430\u043B\u044C\u0446\u0438\u044F', class: 'oxide', subclass: 'basic_oxide' },
  { id: 'al2o3', formula: 'Al\u2082O\u2083', name_ru: '\u041E\u043A\u0441\u0438\u0434 \u0430\u043B\u044E\u043C\u0438\u043D\u0438\u044F', class: 'oxide', subclass: 'amphoteric_oxide' },
  { id: 'zno', formula: 'ZnO', name_ru: '\u041E\u043A\u0441\u0438\u0434 \u0446\u0438\u043D\u043A\u0430', class: 'oxide', subclass: 'amphoteric_oxide' },
];

const PHASE2_REACTIONS: Reaction[] = [
  {
    reaction_id: 'rx1', title: 'Neutralization', equation: 'HCl + NaOH \u2192 NaCl + H\u2082O',
    type_tags: ['exchange', 'neutralization'], driving_forces: ['water_formation'],
    phase: { medium: 'aq' }, molecular: { reactants: [], products: [] },
    ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] },
    heat_effect: 'exo',
  },
  {
    reaction_id: 'rx2', title: 'Decomposition', equation: 'CaCO\u2083 \u2192 CaO + CO\u2082',
    type_tags: ['decomposition'], driving_forces: ['gas_evolution'],
    phase: { medium: 's' }, molecular: { reactants: [], products: [] },
    ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] },
    heat_effect: 'endo',
  },
  {
    reaction_id: 'rx3', title: 'Substitution', equation: 'Fe + CuSO\u2084 \u2192 FeSO\u2084 + Cu',
    type_tags: ['substitution'], driving_forces: ['activity_series'],
    phase: { medium: 'aq' }, molecular: { reactants: [], products: [] },
    ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] },
    heat_effect: 'exo',
  },
  {
    reaction_id: 'rx4', title: 'Redox', equation: '2H\u2082 + O\u2082 \u2192 2H\u2082O',
    type_tags: ['redox'], driving_forces: ['energy_release'],
    phase: { medium: 'g' }, molecular: { reactants: [], products: [] },
    ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] },
    heat_effect: 'exo',
  },
] as Reaction[];

const PHASE2_CLASSIFICATION_RULES: ClassificationRule[] = [
  { id: 'rule_oxide', class: 'oxide', subclass: 'basic_oxide', pattern: 'Me_xO_y', description_ru: '\u041E\u043A\u0441\u0438\u0434\u044B \u2014 \u0441\u043B\u043E\u0436\u043D\u044B\u0435 \u0432\u0435\u0449\u0435\u0441\u0442\u0432\u0430 \u0438\u0437 \u0434\u0432\u0443\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432, \u043E\u0434\u0438\u043D \u0438\u0437 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043A\u0438\u0441\u043B\u043E\u0440\u043E\u0434', examples: ['Na\u2082O', 'CaO'] },
  { id: 'rule_acid', class: 'acid', subclass: 'oxygenated', pattern: 'H_xAcid', description_ru: '\u041A\u0438\u0441\u043B\u043E\u0442\u044B \u2014 \u0441\u043B\u043E\u0436\u043D\u044B\u0435 \u0432\u0435\u0449\u0435\u0441\u0442\u0432\u0430, \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0449\u0438\u0435 \u0438\u043E\u043D\u044B \u0432\u043E\u0434\u043E\u0440\u043E\u0434\u0430', examples: ['HCl', 'H\u2082SO\u2084'] },
  { id: 'rule_base', class: 'base', subclass: 'soluble_base', pattern: 'Me(OH)_x', description_ru: '\u041E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F \u2014 \u0441\u043B\u043E\u0436\u043D\u044B\u0435 \u0432\u0435\u0449\u0435\u0441\u0442\u0432\u0430, \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0449\u0438\u0435 \u0433\u0438\u0434\u0440\u043E\u043A\u0441\u0438\u0434-\u0438\u043E\u043D\u044B', examples: ['NaOH', 'Ca(OH)\u2082'] },
  { id: 'rule_salt', class: 'salt', subclass: 'medium_salt', pattern: 'Me_xAcid_y', description_ru: '\u0421\u043E\u043B\u0438 \u2014 \u0441\u043B\u043E\u0436\u043D\u044B\u0435 \u0432\u0435\u0449\u0435\u0441\u0442\u0432\u0430, \u0441\u043E\u0441\u0442\u043E\u044F\u0449\u0438\u0435 \u0438\u0437 \u043A\u0430\u0442\u0438\u043E\u043D\u043E\u0432 \u043C\u0435\u0442\u0430\u043B\u043B\u0430 \u0438 \u0430\u043D\u0438\u043E\u043D\u043E\u0432 \u043A\u0438\u0441\u043B\u043E\u0442\u043D\u043E\u0433\u043E \u043E\u0441\u0442\u0430\u0442\u043A\u0430', examples: ['NaCl', 'CaSO\u2084'] },
];

const PHASE2_NAMING_RULES: NamingRule[] = [
  { id: 'naming_oxide', class: 'oxide', pattern: 'Me_xO_y', template_ru: '\u041E\u043A\u0441\u0438\u0434 + \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430 (\u0441.\u043E.)', examples: [{ formula: 'Na\u2082O', name_ru: '\u041E\u043A\u0441\u0438\u0434 \u043D\u0430\u0442\u0440\u0438\u044F' }] },
  { id: 'naming_acid_non_oxy', class: 'acid', pattern: 'H_xHal', template_ru: '\u0411\u0435\u0441\u043A\u0438\u0441\u043B\u043E\u0440\u043E\u0434\u043D\u044B\u0435: \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 + \u0432\u043E\u0434\u043E\u0440\u043E\u0434\u043D\u0430\u044F', examples: [{ formula: 'HCl', name_ru: '\u0425\u043B\u043E\u0440\u043E\u0432\u043E\u0434\u043E\u0440\u043E\u0434\u043D\u0430\u044F \u043A\u0438\u0441\u043B\u043E\u0442\u0430' }] },
  { id: 'naming_base', class: 'base', pattern: 'Me(OH)_x', template_ru: '\u0413\u0438\u0434\u0440\u043E\u043A\u0441\u0438\u0434 + \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0435\u0442\u0430\u043B\u043B\u0430', examples: [{ formula: 'NaOH', name_ru: '\u0413\u0438\u0434\u0440\u043E\u043A\u0441\u0438\u0434 \u043D\u0430\u0442\u0440\u0438\u044F' }] },
];

// ── Mock data for reactions batch ────────────────────────────────

const MOCK_ACTIVITY_SERIES: ActivitySeriesEntry[] = [
  { symbol: 'Li', name_ru: 'Литий', position: 1, reduces_H: true },
  { symbol: 'Na', name_ru: 'Натрий', position: 3, reduces_H: true },
  { symbol: 'Mg', name_ru: 'Магний', position: 4, reduces_H: true },
  { symbol: 'Zn', name_ru: 'Цинк', position: 8, reduces_H: true },
  { symbol: 'Fe', name_ru: 'Железо', position: 9, reduces_H: true },
  { symbol: 'Cu', name_ru: 'Медь', position: 14, reduces_H: false },
  { symbol: 'Ag', name_ru: 'Серебро', position: 16, reduces_H: false },
  { symbol: 'Au', name_ru: 'Золото', position: 18, reduces_H: false },
];

const MOCK_QUALITATIVE_TESTS: QualitativeTest[] = [
  { target_id: 'Cl_minus', target_name_ru: 'Хлорид-ион', reagent_formula: 'AgNO₃', reagent_name_ru: 'Нитрат серебра', observation_ru: 'Белый творожистый осадок AgCl' },
  { target_id: 'SO4_2minus', target_name_ru: 'Сульфат-ион', reagent_formula: 'BaCl₂', reagent_name_ru: 'Хлорид бария', observation_ru: 'Белый осадок BaSO₄, нерастворимый в кислотах' },
  { target_id: 'CO3_2minus', target_name_ru: 'Карбонат-ион', reagent_formula: 'HCl', reagent_name_ru: 'Соляная кислота', observation_ru: 'Выделение газа CO₂ (помутнение известковой воды)' },
];

const MOCK_GENETIC_CHAINS: GeneticChain[] = [
  {
    chain_id: 'chain_Ca',
    title_ru: 'Цепочка превращений кальция',
    class_sequence: ['element', 'oxide', 'hydroxide', 'salt'],
    steps: [
      { substance: 'Ca', reagent: 'O₂', next: 'CaO', type: 'oxidation' },
      { substance: 'CaO', reagent: 'H₂O', next: 'Ca(OH)₂', type: 'hydration' },
      { substance: 'Ca(OH)₂', reagent: 'HCl', next: 'CaCl₂', type: 'neutralization' },
    ],
  },
  {
    chain_id: 'chain_S',
    title_ru: 'Цепочка превращений серы',
    class_sequence: ['element', 'oxide', 'acid'],
    steps: [
      { substance: 'S', reagent: 'O₂', next: 'SO₂', type: 'oxidation' },
      { substance: 'SO₂', reagent: 'H₂O', next: 'H₂SO₃', type: 'hydration' },
    ],
  },
];

const MOCK_ENERGY_CATALYST: EnergyCatalystTheory = {
  rate_factors: [
    { factor_id: 'temperature', name_ru: 'Температура', effect_ru: 'Повышение температуры увеличивает скорость реакции', detail_ru: 'Правило Вант-Гоффа', applies_to: 'all' },
    { factor_id: 'concentration', name_ru: 'Концентрация', effect_ru: 'Увеличение концентрации ускоряет реакцию', detail_ru: 'Закон действующих масс', applies_to: 'homogeneous' },
    { factor_id: 'surface_area', name_ru: 'Площадь поверхности', effect_ru: 'Измельчение твёрдого вещества увеличивает скорость', detail_ru: 'Гетерогенные реакции', applies_to: 'heterogeneous' },
  ],
  catalyst_properties: {
    changes_ru: ['Скорость реакции'],
    does_not_change_ru: ['Положение равновесия', 'Тепловой эффект'],
  },
  common_catalysts: [
    { catalyst: 'MnO₂', name_ru: 'Диоксид марганца', reaction_ru: 'Разложение H₂O₂' },
    { catalyst: 'V₂O₅', name_ru: 'Оксид ванадия(V)', reaction_ru: 'Контактный метод получения H₂SO₄' },
    { catalyst: 'Pt', name_ru: 'Платина', reaction_ru: 'Окисление аммиака' },
  ],
  equilibrium_shifts: [
    { factor: 'увеличение температуры', shift_ru: 'в сторону эндотермической реакции', explanation_ru: 'Принцип Ле Шателье' },
    { factor: 'увеличение давления', shift_ru: 'в сторону меньшего объёма газов', explanation_ru: 'Принцип Ле Шателье' },
    { factor: 'увеличение концентрации реагентов', shift_ru: 'в сторону продуктов', explanation_ru: 'Принцип Ле Шателье' },
  ],
  heat_classification: {
    exothermic_ru: 'Экзотермическая реакция',
    endothermic_ru: 'Эндотермическая реакция',
    examples_exo_ru: ['Горение', 'Нейтрализация'],
    examples_endo_ru: ['Разложение', 'Электролиз'],
  },
};

// Extend reactions with redox info for testing
const PHASE2_REACTIONS_EXTENDED: Reaction[] = [
  {
    reaction_id: 'rx1', title: 'Neutralization', equation: 'HCl + NaOH → NaCl + H₂O',
    type_tags: ['exchange', 'neutralization'], driving_forces: ['water_formation'],
    phase: { medium: 'aq' }, molecular: { reactants: [], products: [] },
    ionic: { net: 'H⁺ + OH⁻ → H₂O', notes: 'Na⁺, Cl⁻' },
    observations: {}, rate_tips: { how_to_speed_up: [] },
    heat_effect: 'exo', safety_notes: [], competencies: {},
  },
  {
    reaction_id: 'rx2', title: 'Decomposition', equation: 'CaCO₃ → CaO + CO₂',
    type_tags: ['decomposition'], driving_forces: ['gas_evolution'],
    phase: { medium: 's' }, molecular: { reactants: [], products: [] },
    ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] },
    heat_effect: 'endo', safety_notes: [], competencies: {},
  },
  {
    reaction_id: 'rx3', title: 'Substitution', equation: 'Fe + CuSO₄ → FeSO₄ + Cu',
    type_tags: ['substitution'], driving_forces: ['activity_series'],
    phase: { medium: 'aq' }, molecular: { reactants: [], products: [] },
    ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] },
    heat_effect: 'exo', safety_notes: [], competencies: {},
  },
  {
    reaction_id: 'rx4', title: 'Combustion of hydrogen', equation: '2H₂ + O₂ → 2H₂O',
    type_tags: ['redox'], driving_forces: ['energy_release'],
    phase: { medium: 'g' }, molecular: { reactants: [], products: [] },
    ionic: {}, observations: {}, rate_tips: { how_to_speed_up: [] },
    heat_effect: 'exo', safety_notes: [], competencies: {},
    redox: {
      oxidizer: { formula: 'O₂', element: 'O', from: 0, to: -2 },
      reducer: { formula: 'H₂', element: 'H', from: 0, to: 1 },
      electron_transfer: '2e⁻ per O atom',
    },
  },
  {
    reaction_id: 'rx5', title: 'Precipitation', equation: 'NaCl + AgNO₃ → AgCl↓ + NaNO₃',
    type_tags: ['exchange'], driving_forces: ['precipitate'],
    phase: { medium: 'aq' }, molecular: { reactants: [], products: [] },
    ionic: { net: 'Ag⁺ + Cl⁻ → AgCl↓', notes: 'Na⁺, NO₃⁻' },
    observations: {}, rate_tips: { how_to_speed_up: [] },
    heat_effect: 'exo', safety_notes: [], competencies: {},
  },
] as Reaction[];

const MOCK_CALCULATIONS: CalculationsData = {
  calc_substances: [
    {
      formula: 'H₂O',
      name_ru: 'Вода',
      M: 18.015,
      composition: [
        { element: 'H', Ar: 1.008, count: 2 },
        { element: 'O', Ar: 15.999, count: 1 },
      ],
    },
    {
      formula: 'NaCl',
      name_ru: 'Хлорид натрия',
      M: 58.44,
      composition: [
        { element: 'Na', Ar: 22.99, count: 1 },
        { element: 'Cl', Ar: 35.45, count: 1 },
      ],
    },
  ],
  calc_reactions: [
    {
      equation_ru: '2H₂ + O₂ → 2H₂O',
      given: { formula: 'H₂', coeff: 2, M: 2.016 },
      find: { formula: 'H₂O', coeff: 2, M: 18.015 },
    },
  ],
};

function loadAllTemplates(): TaskTemplate[] {
  const raw = readFileSync(
    resolve(__dirname, '../../../../data-src/engine/task_templates.json'),
    'utf-8',
  );
  return JSON.parse(raw) as TaskTemplate[];
}

function buildPhase2Ontology(): OntologyData {
  return {
    ...MOCK_DATA,
    core: {
      ...MOCK_DATA.core,
      ions: MOCK_IONS_WITH_NAMING,
    },
    rules: {
      ...MOCK_DATA.rules,
      bondExamples: PHASE2_BOND_EXAMPLES,
      classificationRules: PHASE2_CLASSIFICATION_RULES,
      namingRules: PHASE2_NAMING_RULES,
      activitySeries: MOCK_ACTIVITY_SERIES,
      qualitativeTests: MOCK_QUALITATIVE_TESTS,
      energyCatalyst: MOCK_ENERGY_CATALYST,
      ionNomenclature: MOCK_ION_NOMENCLATURE,
    },
    data: {
      substances: PHASE2_SUBSTANCE_INDEX,
      reactions: PHASE2_REACTIONS_EXTENDED,
      geneticChains: MOCK_GENETIC_CHAINS,
      calculations: MOCK_CALCULATIONS,
    },
    i18n: { ...MOCK_DATA.i18n, promptTemplates: PHASE2_PROMPTS },
  };
}

describe('TaskEngine — Phase 2 integration', () => {
  const allTemplates = loadAllTemplates();
  const ontology = buildPhase2Ontology();

  it('loads all 65 task templates from JSON', () => {
    expect(allTemplates.length).toBe(65);
  });

  describe('bond templates', () => {
    it('identify_type returns a bond type', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.bond.identify_type.v1');

      expect(task.template_id).toBe('tmpl.bond.identify_type.v1');
      expect(task.interaction).toBe('choice_single');
      expect(['ionic', 'covalent_polar', 'covalent_nonpolar', 'metallic']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ bond_type: 'P' });
    });

    it('identify_crystal returns a crystal type', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.bond.identify_crystal.v1');

      expect(task.template_id).toBe('tmpl.bond.identify_crystal.v1');
      expect(['ionic', 'molecular', 'atomic', 'metallic']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ crystal_structure_type: 'P' });
    });

    it('compare_melting returns a formula', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.bond.compare_melting.v1');

      expect(task.template_id).toBe('tmpl.bond.compare_melting.v1');
      expect(typeof task.correct_answer).toBe('string');
      const allFormulas = PHASE2_BOND_EXAMPLES.examples.map(e => e.formula);
      expect(allFormulas).toContain(task.correct_answer);
    });

    it('select_by_type returns a formula', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.bond.select_by_type.v1');

      expect(task.template_id).toBe('tmpl.bond.select_by_type.v1');
      expect(typeof task.correct_answer).toBe('string');
      const allFormulas = PHASE2_BOND_EXAMPLES.examples.map(e => e.formula);
      expect(allFormulas).toContain(task.correct_answer);
    });

    it('predict_property returns a crystal type', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.bond.predict_property.v1');

      expect(task.template_id).toBe('tmpl.bond.predict_property.v1');
      expect(task.interaction).toBe('choice_single');
      expect(['ionic', 'molecular', 'atomic', 'metallic']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ crystal_structure_type: 'P', bond_type: 'S' });
    });

    it('delta_chi returns a bond type from electronegativity difference', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.bond.delta_chi.v1');

      expect(task.template_id).toBe('tmpl.bond.delta_chi.v1');
      expect(task.interaction).toBe('choice_single');
      expect(['ionic', 'covalent_polar', 'covalent_nonpolar', 'metallic']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ bond_type: 'P', periodic_trends: 'S' });
    });
  });

  describe('classification templates', () => {
    it('classify returns a substance class', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.class.classify.v1');

      expect(task.template_id).toBe('tmpl.class.classify.v1');
      expect(['oxide', 'acid', 'base', 'salt']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ classification: 'P' });
    });

    it('select_by_class returns a formula', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.class.select_by_class.v1');

      expect(task.template_id).toBe('tmpl.class.select_by_class.v1');
      expect(typeof task.correct_answer).toBe('string');
      const allFormulas = PHASE2_SUBSTANCE_INDEX.map(s => s.formula);
      expect(allFormulas).toContain(task.correct_answer);
    });
  });

  describe('reaction template', () => {
    it('identify_type returns a reaction type', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.rxn.identify_type.v1');

      expect(task.template_id).toBe('tmpl.rxn.identify_type.v1');
      expect(['exchange', 'substitution', 'decomposition', 'redox']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ reactions_exchange: 'P' });
    });
  });

  describe('position templates', () => {
    it('find_period returns a period number (1-6)', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.pt.find_period.v1');

      expect(task.template_id).toBe('tmpl.pt.find_period.v1');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThanOrEqual(1);
      expect(task.correct_answer).toBeLessThanOrEqual(6);
      expect(task.competency_map).toEqual({ periodic_table: 'P' });
    });

    it('find_group returns a group number (1-18)', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.pt.find_group.v1');

      expect(task.template_id).toBe('tmpl.pt.find_group.v1');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThanOrEqual(1);
      expect(task.correct_answer).toBeLessThanOrEqual(18);
    });

    it('max_state returns a number', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.ox.max_state.v1');

      expect(task.template_id).toBe('tmpl.ox.max_state.v1');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.competency_map).toEqual({ oxidation_states: 'P' });
    });
  });

  describe('oxidation state templates', () => {
    it('select_by_state returns a formula from oxidation examples', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.ox.select_by_state.v1');

      expect(task.template_id).toBe('tmpl.ox.select_by_state.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allFormulas = MOCK_OXIDATION_EXAMPLES.map(e => e.formula);
      expect(allFormulas).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ oxidation_states: 'P' });
      // Question should contain the element and expected_state slots
      expect(task.slots.element).toBeDefined();
      expect(task.slots.expected_state).toBeDefined();
    });

    it('min_state returns a number (minimum oxidation state)', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.ox.min_state.v1');

      expect(task.template_id).toBe('tmpl.ox.min_state.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('number');
      // For our mock elements: Na=1, Mg=2, Cl=-1, Al=3, Zn=2, O=-2
      expect([1, 2, -1, -2, 3]).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ oxidation_states: 'P' });
    });
  });

  describe('electron config templates', () => {
    it('select_electron_config returns a config string', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.pt.select_electron_config.v1');

      expect(task.template_id).toBe('tmpl.pt.select_electron_config.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      // Config string should start with "1s"
      expect(String(task.correct_answer)).toMatch(/^1s/);
      expect(task.competency_map).toEqual({ electron_config: 'P', periodic_table: 'S' });
      expect(task.question).toContain('electron configuration');
    });

    it('count_valence returns a number between 1 and 18', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.pt.count_valence.v1');

      expect(task.template_id).toBe('tmpl.pt.count_valence.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThanOrEqual(1);
      expect(task.correct_answer).toBeLessThanOrEqual(18);
      expect(task.competency_map).toEqual({ electron_config: 'P', periodic_table: 'S' });
    });

    it('element_from_config returns an element symbol', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.pt.element_from_config.v1');

      expect(task.template_id).toBe('tmpl.pt.element_from_config.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      // Answer must be an element symbol from our mock data
      const allSymbols = MOCK_ELEMENTS.map(e => e.symbol);
      expect(allSymbols).toContain(task.correct_answer);
      // Question should contain a config string (from generator's config slot)
      expect(task.slots.config).toBeDefined();
      expect(String(task.slots.config)).toMatch(/^1s/);
      expect(task.competency_map).toEqual({ electron_config: 'P', periodic_table: 'S' });
    });

    it('fill_orbital returns a config string and has interactive_orbital interaction', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.pt.fill_orbital.v1');

      expect(task.template_id).toBe('tmpl.pt.fill_orbital.v1');
      expect(task.interaction).toBe('interactive_orbital');
      expect(typeof task.correct_answer).toBe('string');
      expect(String(task.correct_answer)).toMatch(/^1s/);
      expect(task.slots.Z).toBeDefined();
      expect(typeof task.slots.Z).toBe('number');
      expect(task.competency_map).toEqual({ electron_config: 'P' });

      // toExercise should produce interactive_orbital format
      const exercise = engine.toExercise(task);
      expect(exercise.format).toBe('interactive_orbital');
      expect(exercise.targetZ).toBe(task.slots.Z);
    });
  });

  describe('competency routing', () => {
    it('generateForCompetency returns bond template for bond_type', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('bond_type');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('bond_type');
      }
    });

    it('generateForCompetency returns classification template for classification', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('classification');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('classification');
      }
    });

    it('generateForCompetency returns reaction template for reactions_exchange', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('reactions_exchange');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('reactions_exchange');
      }
    });
  });

  describe('substance classification templates', () => {
    it('classify_subclass returns a subclass string', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.class.classify_subclass.v1');

      expect(task.template_id).toBe('tmpl.class.classify_subclass.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(task.competency_map).toEqual({ classification: 'P' });
      // All substances in mock have subclass set
      const allSubclasses = PHASE2_SUBSTANCE_INDEX.map(s => s.subclass).filter(Boolean);
      expect(allSubclasses).toContain(task.correct_answer);
    });

    it('identify_by_description returns a class label from classification rules', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.class.identify_by_description.v1');

      expect(task.template_id).toBe('tmpl.class.identify_by_description.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(['oxide', 'acid', 'base', 'salt']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ classification: 'P' });
      // Question should contain a description
      expect(task.slots.description).toBeDefined();
    });
  });

  describe('substance naming templates', () => {
    it('formula_to_name returns a substance name', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.sub.formula_to_name.v1');

      expect(task.template_id).toBe('tmpl.sub.formula_to_name.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(task.competency_map).toEqual({ naming: 'P', classification: 'S' });
      // Answer should be one of the known substance names
      const allNames = PHASE2_SUBSTANCE_INDEX.map(s => s.name_ru).filter(Boolean);
      expect(allNames).toContain(task.correct_answer);
      // Question should contain a formula
      expect(task.slots.formula).toBeDefined();
    });

    it('name_to_formula returns a substance formula', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.sub.name_to_formula.v1');

      expect(task.template_id).toBe('tmpl.sub.name_to_formula.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(task.competency_map).toEqual({ naming: 'P', classification: 'S' });
      const allFormulas = PHASE2_SUBSTANCE_INDEX.map(s => s.formula);
      expect(allFormulas).toContain(task.correct_answer);
      // Question should contain a name
      expect(task.slots.name).toBeDefined();
    });

    it('naming_rule returns a naming template string', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.sub.naming_rule.v1');

      expect(task.template_id).toBe('tmpl.sub.naming_rule.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(task.competency_map).toEqual({ naming: 'P' });
      // Answer should be one of the naming rule templates
      const allTemplateStrs = PHASE2_NAMING_RULES.map(r => r.template_ru);
      expect(allTemplateStrs).toContain(task.correct_answer);
    });
  });

  describe('amphoteric templates', () => {
    it('identify_amphoteric returns a formula of an amphoteric substance', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.sub.identify_amphoteric.v1');

      expect(task.template_id).toBe('tmpl.sub.identify_amphoteric.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(task.competency_map).toEqual({ amphoterism_logic: 'P', classification: 'S' });
      // Must be one of the amphoteric substances (Al\u2082O\u2083 or ZnO)
      expect(['Al\u2082O\u2083', 'ZnO']).toContain(task.correct_answer);
    });

    it('amphoteric_partner returns reaction partners (acid and base)', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.sub.amphoteric_partner.v1');

      expect(task.template_id).toBe('tmpl.sub.amphoteric_partner.v1');
      expect(task.interaction).toBe('choice_multi');
      expect(Array.isArray(task.correct_answer)).toBe(true);
      expect(task.correct_answer).toEqual(['acid', 'base']);
      expect(task.competency_map).toEqual({ amphoterism_logic: 'P' });
      // Slots should include reaction_partners
      expect(task.slots.reaction_partners).toEqual(['acid', 'base']);
    });
  });
});

// ── Reactions batch integration tests ──────────────────────────────

describe('TaskEngine — Reactions batch integration', () => {
  const allTemplates = loadAllTemplates();
  const ontology = buildPhase2Ontology();
  const engine = createTaskEngine(allTemplates, ontology);

  describe('exchange reaction templates', () => {
    it('predict_exchange returns an equation for exchange reactions', () => {
      const task = engine.generate('tmpl.rxn.predict_exchange.v1');

      expect(task.template_id).toBe('tmpl.rxn.predict_exchange.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(String(task.correct_answer)).toContain('\u2192');
      expect(task.competency_map).toEqual({ reactions_exchange: 'P' });
    });

    it('driving_force returns a driving force label', () => {
      const task = engine.generate('tmpl.rxn.driving_force.v1');

      expect(task.template_id).toBe('tmpl.rxn.driving_force.v1');
      expect(task.interaction).toBe('choice_single');
      // Driving forces for exchange reactions: water, precipitate, gas, weak_electrolyte, none
      expect(['water', 'precipitate', 'gas', 'weak_electrolyte', 'none']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ reactions_exchange: 'P', gas_precipitate_logic: 'S' });
    });

    it('will_occur returns yes or no', () => {
      const task = engine.generate('tmpl.rxn.will_occur.v1');

      expect(task.template_id).toBe('tmpl.rxn.will_occur.v1');
      expect(task.interaction).toBe('choice_single');
      expect(['yes', 'no']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ reactions_exchange: 'P', gas_precipitate_logic: 'S' });
    });
  });

  describe('activity series templates', () => {
    it('activity_compare returns yes or no', () => {
      const task = engine.generate('tmpl.rxn.activity_compare.v1');

      expect(task.template_id).toBe('tmpl.rxn.activity_compare.v1');
      expect(task.interaction).toBe('choice_single');
      expect(['yes', 'no']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ activity_series_logic: 'P' });
      // Slots should have metalA and metalB
      expect(task.slots.metalA).toBeDefined();
      expect(task.slots.metalB).toBeDefined();
    });

    it('will_metal_react returns 0 or 1', () => {
      const task = engine.generate('tmpl.rxn.will_metal_react.v1');

      expect(task.template_id).toBe('tmpl.rxn.will_metal_react.v1');
      expect(task.interaction).toBe('choice_single');
      expect([0, 1]).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ activity_series_logic: 'P' });
    });
  });

  describe('ionic equation templates', () => {
    it('match_ionic template exists and loads correctly', () => {
      const tmpl = allTemplates.find(t => t.template_id === 'tmpl.rxn.match_ionic.v1');
      expect(tmpl).toBeDefined();
      expect(tmpl!.meta.interaction).toBe('match_pairs');
      expect(tmpl!.competency_hint).toEqual({ ionic_spectators_logic: 'P' });
    });

    it('spectator_ions template exists and loads correctly', () => {
      const tmpl = allTemplates.find(t => t.template_id === 'tmpl.rxn.spectator_ions.v1');
      expect(tmpl).toBeDefined();
      expect(tmpl!.meta.interaction).toBe('choice_single');
      expect(tmpl!.competency_hint).toEqual({ ionic_spectators_logic: 'P' });
    });

    it('spectator_ions works with a reaction that has ionic.notes', () => {
      // rx1 and rx5 have ionic.notes set, but random pick may choose one without
      let found = false;
      for (let i = 0; i < 30; i++) {
        try {
          const t = engine.generate('tmpl.rxn.spectator_ions.v1');
          if (t.correct_answer) {
            found = true;
            expect(typeof t.correct_answer).toBe('string');
            break;
          }
        } catch {
          // Some reactions don't have spectator_ions, which is expected
        }
      }
      // At least some reactions should have ionic data (rx1, rx5)
      expect(found).toBe(true);
    });
  });

  describe('qualitative analysis templates', () => {
    it('identify_reagent returns a reagent formula', () => {
      const task = engine.generate('tmpl.qual.identify_reagent.v1');

      expect(task.template_id).toBe('tmpl.qual.identify_reagent.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allReagents = MOCK_QUALITATIVE_TESTS.map(t => t.reagent_formula);
      expect(allReagents).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ qualitative_reactions: 'P' });
      expect(task.slots.target_name).toBeDefined();
    });

    it('identify_ion returns an ion name', () => {
      const task = engine.generate('tmpl.qual.identify_ion.v1');

      expect(task.template_id).toBe('tmpl.qual.identify_ion.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allTargets = MOCK_QUALITATIVE_TESTS.map(t => t.target_name_ru);
      expect(allTargets).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ qualitative_reactions: 'P' });
      expect(task.slots.observation).toBeDefined();
    });
  });

  describe('genetic chain templates', () => {
    it('complete_step returns the next substance in the chain', () => {
      const task = engine.generate('tmpl.chain.complete_step.v1');

      expect(task.template_id).toBe('tmpl.chain.complete_step.v1');
      expect(task.interaction).toBe('guided_selection');
      expect(typeof task.correct_answer).toBe('string');
      // The answer should be one of the substances in any chain
      const allNext = MOCK_GENETIC_CHAINS.flatMap(c => c.steps.map(s => s.next));
      expect(allNext).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ genetic_chains_logic: 'P' });
      expect(task.slots.chain_substances).toBeDefined();
      expect(Array.isArray(task.slots.chain_substances)).toBe(true);
    });

    it('choose_reagent returns a reagent string', () => {
      const task = engine.generate('tmpl.chain.choose_reagent.v1');

      expect(task.template_id).toBe('tmpl.chain.choose_reagent.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allReagents = MOCK_GENETIC_CHAINS.flatMap(c => c.steps.map(s => s.reagent));
      expect(allReagents).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ genetic_chains_logic: 'P' });
      expect(task.slots.substance).toBeDefined();
    });
  });

  describe('redox templates', () => {
    it('identify_oxidizer template exists with correct competency', () => {
      const tmpl = allTemplates.find(t => t.template_id === 'tmpl.rxn.identify_oxidizer.v1');
      expect(tmpl).toBeDefined();
      expect(tmpl!.meta.interaction).toBe('choice_single');
      expect(tmpl!.competency_hint).toEqual({ reactions_redox: 'P' });
      expect(tmpl!.pipeline.generator.params.type_tag).toBe('redox');
    });

    it('identify_oxidizer returns the oxidizer formula for redox reactions', () => {
      const task = engine.generate('tmpl.rxn.identify_oxidizer.v1');

      expect(task.template_id).toBe('tmpl.rxn.identify_oxidizer.v1');
      expect(task.interaction).toBe('choice_single');
      // rx4 is the only redox reaction, its oxidizer is O₂
      expect(task.correct_answer).toBe('O\u2082');
      expect(task.competency_map).toEqual({ reactions_redox: 'P' });
    });

    it('predict_substitution returns an equation', () => {
      const task = engine.generate('tmpl.rxn.predict_substitution.v1');

      expect(task.template_id).toBe('tmpl.rxn.predict_substitution.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(String(task.correct_answer)).toContain('\u2192');
      expect(task.competency_map).toEqual({ activity_series_logic: 'P', reactions_exchange: 'S' });
    });
  });

  describe('energy & catalysis templates', () => {
    it('factors_rate returns a factor name', () => {
      const task = engine.generate('tmpl.rxn.factors_rate.v1');

      expect(task.template_id).toBe('tmpl.rxn.factors_rate.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allFactors = MOCK_ENERGY_CATALYST.rate_factors.map(f => f.name_ru);
      expect(allFactors).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ reaction_rate_factors: 'P' });
    });

    it('exo_endo returns heat_effect (exo or endo)', () => {
      const task = engine.generate('tmpl.rxn.exo_endo.v1');

      expect(task.template_id).toBe('tmpl.rxn.exo_endo.v1');
      expect(task.interaction).toBe('choice_single');
      expect(['exo', 'endo', 'negligible', 'unknown']).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ reaction_rate_factors: 'P' });
    });

    it('equilibrium_shift returns a shift description', () => {
      const task = engine.generate('tmpl.rxn.equilibrium_shift.v1');

      expect(task.template_id).toBe('tmpl.rxn.equilibrium_shift.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allShifts = MOCK_ENERGY_CATALYST.equilibrium_shifts.map(s => s.shift_ru);
      expect(allShifts).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ equilibrium_shift: 'P' });
      expect(task.slots.eq_factor).toBeDefined();
    });

    it('catalyst_props returns a catalyst name', () => {
      const task = engine.generate('tmpl.rxn.catalyst_props.v1');

      expect(task.template_id).toBe('tmpl.rxn.catalyst_props.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allNames = MOCK_ENERGY_CATALYST.common_catalysts.map(c => c.name_ru);
      expect(allNames).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ catalysis_concept: 'P' });
      expect(task.slots.catalyst_reaction).toBeDefined();
    });

    it('identify_catalyst returns a catalyst formula', () => {
      const task = engine.generate('tmpl.rxn.identify_catalyst.v1');

      expect(task.template_id).toBe('tmpl.rxn.identify_catalyst.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allCatalysts = MOCK_ENERGY_CATALYST.common_catalysts.map(c => c.catalyst);
      expect(allCatalysts).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ catalysis_concept: 'P' });
    });
  });

  describe('gen.pick_reaction extended slots', () => {
    it('includes driving force booleans and heat_effect', () => {
      const task = engine.generate('tmpl.rxn.will_occur.v1');

      // All reactions in our mock have driving forces, so will_occur should be "yes"
      expect(task.slots.has_precipitate).toBeDefined();
      expect(task.slots.has_gas).toBeDefined();
      expect(task.slots.has_water).toBeDefined();
      expect(task.slots.has_weak_electrolyte).toBeDefined();
      expect(task.slots.will_occur).toBeDefined();
      expect(task.slots.heat_effect).toBeDefined();
      expect(task.slots.reactants).toBeDefined();
    });

    it('extracts reactants from equation', () => {
      const task = engine.generate('tmpl.rxn.exo_endo.v1');
      const reactants = String(task.slots.reactants);
      // Reactants should not contain →
      expect(reactants).not.toContain('\u2192');
    });
  });

  describe('competency routing for new templates', () => {
    it('generateForCompetency returns activity_series_logic templates', () => {
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('activity_series_logic');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('activity_series_logic');
      }
    });

    it('generateForCompetency returns qualitative_reactions templates', () => {
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('qualitative_reactions');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('qualitative_reactions');
      }
    });

    it('generateForCompetency returns genetic_chains_logic templates', () => {
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('genetic_chains_logic');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('genetic_chains_logic');
      }
    });

    it('generateForCompetency returns catalysis_concept templates', () => {
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('catalysis_concept');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('catalysis_concept');
      }
    });

    it('generateForCompetency returns equilibrium_shift templates', () => {
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('equilibrium_shift');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('equilibrium_shift');
      }
    });
  });

  describe('calculation templates — substance-based', () => {
    it('molar_mass returns a numeric answer', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.calc.molar_mass.v1');

      expect(task.template_id).toBe('tmpl.calc.molar_mass.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThan(0);
      expect(task.competency_map).toEqual({ calculations_basic: 'P' });
      // Should have formula slot
      expect(task.slots.formula).toBeDefined();
    });

    it('mass_fraction returns a percentage (0-100)', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.calc.mass_fraction.v1');

      expect(task.template_id).toBe('tmpl.calc.mass_fraction.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThan(0);
      expect(task.correct_answer).toBeLessThanOrEqual(100);
      expect(task.competency_map).toEqual({ calculations_basic: 'P' });
      // Should have element and formula slots
      expect(task.slots.element).toBeDefined();
      expect(task.slots.formula).toBeDefined();
    });

    it('amount returns a positive number (n = m/M)', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.calc.amount.v1');

      expect(task.template_id).toBe('tmpl.calc.amount.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThan(0);
      expect(task.competency_map).toEqual({ calculations_basic: 'P' });
      expect(task.slots.mass).toBeDefined();
      expect(task.slots.M).toBeDefined();
    });

    it('mass_from_moles returns a positive number (m = n*M)', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.calc.mass_from_moles.v1');

      expect(task.template_id).toBe('tmpl.calc.mass_from_moles.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThan(0);
      expect(task.competency_map).toEqual({ calculations_basic: 'P' });
      expect(task.slots.amount).toBeDefined();
      expect(task.slots.M).toBeDefined();
    });
  });

  describe('calculation templates — solution-based', () => {
    it('concentration returns a percentage', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.calc.concentration.v1');

      expect(task.template_id).toBe('tmpl.calc.concentration.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThan(0);
      expect(task.correct_answer).toBeLessThan(100);
      expect(task.competency_map).toEqual({ calculations_solutions: 'P' });
      expect(task.slots.m_solute).toBeDefined();
      expect(task.slots.m_solution).toBeDefined();
    });

    it('solute_mass returns a positive mass', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.calc.solute_mass.v1');

      expect(task.template_id).toBe('tmpl.calc.solute_mass.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThan(0);
      expect(task.competency_map).toEqual({ calculations_solutions: 'P' });
      expect(task.slots.omega).toBeDefined();
      expect(task.slots.m_solution).toBeDefined();
    });

    it('dilution returns a positive solution mass', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.calc.dilution.v1');

      expect(task.template_id).toBe('tmpl.calc.dilution.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThan(0);
      expect(task.competency_map).toEqual({ calculations_solutions: 'P' });
      expect(task.slots.omega_target).toBeDefined();
      // Result should be larger than original solution mass (dilution adds volume)
      expect(task.correct_answer).toBeGreaterThan(Number(task.slots.m_solution));
    });
  });

  describe('calculation templates — reaction-based', () => {
    it('by_equation returns a positive product mass', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.calc.by_equation.v1');

      expect(task.template_id).toBe('tmpl.calc.by_equation.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThan(0);
      expect(task.competency_map).toEqual({ reaction_yield_logic: 'P' });
      expect(task.slots.equation).toBeDefined();
      expect(task.slots.given_formula).toBeDefined();
      expect(task.slots.find_formula).toBeDefined();
      expect(task.slots.given_mass).toBeDefined();
    });

    it('yield returns a positive mass less than theoretical', () => {
      const engine = createTaskEngine(allTemplates, ontology);
      const task = engine.generate('tmpl.calc.yield.v1');

      expect(task.template_id).toBe('tmpl.calc.yield.v1');
      expect(task.interaction).toBe('numeric_input');
      expect(typeof task.correct_answer).toBe('number');
      expect(task.correct_answer).toBeGreaterThan(0);
      expect(task.competency_map).toEqual({ reaction_yield_logic: 'P' });
      expect(task.slots.yield_percent).toBeDefined();
      expect(Number(task.slots.yield_percent)).toBeGreaterThanOrEqual(60);
      expect(Number(task.slots.yield_percent)).toBeLessThanOrEqual(95);
      // Practical yield should be less than find_mass (theoretical)
      expect(task.correct_answer).toBeLessThan(Number(task.slots.find_mass));
    });
  });

  describe('competency routing for calculation templates', () => {
    it('generateForCompetency returns calculations_basic templates', () => {
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('calculations_basic');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('calculations_basic');
      }
    });

    it('generateForCompetency returns calculations_solutions templates', () => {
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('calculations_solutions');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('calculations_solutions');
      }
    });

    it('generateForCompetency returns reaction_yield_logic templates', () => {
      for (let i = 0; i < 10; i++) {
        const task = engine.generateForCompetency('reaction_yield_logic');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('reaction_yield_logic');
      }
    });
  });
});

// ── Ions batch integration tests ───────────────────────────────────

describe('TaskEngine — Ions batch integration', () => {
  const allTemplates = loadAllTemplates();
  const ontology = buildPhase2Ontology();
  const engine = createTaskEngine(allTemplates, ontology);

  describe('ion formula/name templates', () => {
    it('formula_to_name returns an ion name', () => {
      const task = engine.generate('tmpl.ion.formula_to_name.v1');

      expect(task.template_id).toBe('tmpl.ion.formula_to_name.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allNames = MOCK_IONS_WITH_NAMING.map(i => i.name_ru);
      expect(allNames).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ naming: 'P' });
      expect(task.slots.ionA_formula).toBeDefined();
    });

    it('name_to_formula returns an ion formula', () => {
      const task = engine.generate('tmpl.ion.name_to_formula.v1');

      expect(task.template_id).toBe('tmpl.ion.name_to_formula.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allFormulas = MOCK_IONS_WITH_NAMING.map(i => i.formula);
      expect(allFormulas).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ naming: 'P' });
      expect(task.slots.ionA_name).toBeDefined();
    });
  });

  describe('ion suffix templates', () => {
    it('suffix_rule returns a suffix string', () => {
      const task = engine.generate('tmpl.ion.suffix_rule.v1');

      expect(task.template_id).toBe('tmpl.ion.suffix_rule.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      // Suffixes from our mock ions with naming
      const allSuffixes = MOCK_IONS_WITH_NAMING.filter(i => i.naming).map(i => i.naming!.suffix_ru);
      expect(allSuffixes).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ naming: 'P' });
      expect(task.slots.ionA_formula).toBeDefined();
    });

    it('ate_ite_pair returns a suffix for the partner ion', () => {
      const task = engine.generate('tmpl.ion.ate_ite_pair.v1');

      expect(task.template_id).toBe('tmpl.ion.ate_ite_pair.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allSuffixes = MOCK_IONS_WITH_NAMING.filter(i => i.naming).map(i => i.naming!.suffix_ru);
      expect(allSuffixes).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ naming: 'P' });
      expect(task.slots.ionB_formula).toBeDefined();
    });
  });

  describe('acid-anion pair templates', () => {
    it('acid_to_anion returns an anion name', () => {
      const task = engine.generate('tmpl.ion.acid_to_anion.v1');

      expect(task.template_id).toBe('tmpl.ion.acid_to_anion.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(task.competency_map).toEqual({ naming: 'P', classification: 'S' });
      expect(task.slots.acid_name).toBeDefined();
      expect(task.slots.acid_formula).toBeDefined();
    });

    it('anion_to_acid returns an acid name', () => {
      const task = engine.generate('tmpl.ion.anion_to_acid.v1');

      expect(task.template_id).toBe('tmpl.ion.anion_to_acid.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      expect(task.competency_map).toEqual({ naming: 'P', classification: 'S' });
      expect(task.slots.anion_formula).toBeDefined();
    });
  });

  describe('suffix rule templates (default mode)', () => {
    it('ox_state_to_suffix returns a suffix string', () => {
      const task = engine.generate('tmpl.ion.ox_state_to_suffix.v1');

      expect(task.template_id).toBe('tmpl.ion.ox_state_to_suffix.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allSuffixes = MOCK_ION_NOMENCLATURE.suffix_rules.map(r => r.suffix_ru);
      expect(allSuffixes).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ naming: 'P' });
      expect(task.slots.condition).toBeDefined();
    });

    it('classify_suffix_type returns a condition string', () => {
      const task = engine.generate('tmpl.ion.classify_suffix_type.v1');

      expect(task.template_id).toBe('tmpl.ion.classify_suffix_type.v1');
      expect(task.interaction).toBe('choice_single');
      expect(typeof task.correct_answer).toBe('string');
      const allConditions = MOCK_ION_NOMENCLATURE.suffix_rules.map(r => r.condition);
      expect(allConditions).toContain(task.correct_answer);
      expect(task.competency_map).toEqual({ naming: 'P' });
      expect(task.slots.suffix_ru).toBeDefined();
    });
  });

  describe('competency routing for ion templates', () => {
    it('generateForCompetency returns naming templates (includes ion templates)', () => {
      const engine2 = createTaskEngine(allTemplates, ontology);
      for (let i = 0; i < 20; i++) {
        const task = engine2.generateForCompetency('naming');
        expect(task).not.toBeNull();
        expect(task!.competency_map).toHaveProperty('naming');
      }
    });
  });
});

// ── toExercise format routing tests ──────────────────────────────

describe('toExercise format routing', () => {
  const engine = createTaskEngine([], MOCK_DATA);

  it('choice_multi → multiple_choice_multi with correctIds', () => {
    const multiTask: GeneratedTask = {
      template_id: 'test.multi',
      interaction: 'choice_multi',
      question: 'Select all acids',
      correct_answer: ['HCl', 'H₂SO₄'],
      distractors: ['NaOH', 'NaCl'],
      explanation: '',
      competency_map: {},
      difficulty: 0.5,
      exam_tags: [],
      slots: {},
    };
    const ex = engine.toExercise(multiTask);

    expect(ex.format).toBe('multiple_choice_multi');
    expect(ex.correctIds).toBeDefined();
    expect(ex.correctIds!.length).toBe(2);
    expect(ex.options.length).toBe(4);
    // All correct IDs must be present in options
    for (const cid of ex.correctIds!) {
      expect(ex.options.find(o => o.id === cid)).toBeDefined();
    }
  });

  it('match_pairs → match_pairs with parsed pairs', () => {
    const matchTask: GeneratedTask = {
      template_id: 'test.match',
      interaction: 'match_pairs',
      question: 'Match ions to reagents',
      correct_answer: ['Cl⁻:AgNO₃', 'SO₄²⁻:BaCl₂'],
      distractors: [],
      explanation: '',
      competency_map: {},
      difficulty: 0.5,
      exam_tags: [],
      slots: {},
    };
    const ex = engine.toExercise(matchTask);

    expect(ex.format).toBe('match_pairs');
    expect(ex.pairs).toBeDefined();
    expect(ex.pairs!.length).toBe(2);
    expect(ex.pairs![0]).toEqual({ left: 'Cl⁻', right: 'AgNO₃' });
    expect(ex.pairs![1]).toEqual({ left: 'SO₄²⁻', right: 'BaCl₂' });
    expect(ex.options).toEqual([]);
  });

  it('interactive_orbital → interactive_orbital with targetZ', () => {
    const orbitalTask: GeneratedTask = {
      template_id: 'test.orbital',
      interaction: 'interactive_orbital',
      question: 'Fill orbital for Na',
      correct_answer: '1s² 2s² 2p⁶ 3s¹',
      distractors: [],
      explanation: '',
      competency_map: {},
      difficulty: 0.5,
      exam_tags: [],
      slots: { element: 'Na', Z: 11 },
    };
    const ex = engine.toExercise(orbitalTask);

    expect(ex.format).toBe('interactive_orbital');
    expect(ex.targetZ).toBe(11);
    expect(ex.options).toEqual([]);
  });

  it('guided_selection → guided_selection with context and options', () => {
    const guidedTask: GeneratedTask = {
      template_id: 'test.guided',
      interaction: 'guided_selection',
      question: 'Complete the chain step',
      correct_answer: 'CaO',
      distractors: ['NaCl', 'HCl'],
      explanation: '',
      competency_map: {},
      difficulty: 0.5,
      exam_tags: [],
      slots: { chain_substances: ['CaCO₃', '?', 'Ca(OH)₂'], gap_index: 1 },
    };
    const ex = engine.toExercise(guidedTask);

    expect(ex.format).toBe('guided_selection');
    expect(ex.context).toBeDefined();
    expect(ex.context!.chain).toEqual(['CaCO₃', '?', 'Ca(OH)₂']);
    expect(ex.context!.chain.length).toBe(3);
    expect(ex.context!.gapIndex).toBe(1);
    expect(ex.options.length).toBe(3);
    expect(ex.correctId).toBe('correct');
    // Correct option must exist
    expect(ex.options.find(o => o.id === 'correct')).toBeDefined();
    expect(ex.options.find(o => o.id === 'correct')!.text).toBe('CaO');
  });
});
