# Phase 3: Full Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all 58 traditional exercise generators with engine templates, covering all 21 competencies. Add 4 new interaction types, 11 generators, 13 solvers, 51 templates. Restructure OntologyData into grouped sub-objects. Add GuidedSelectionExercise React component.

**Architecture:** Infrastructure-first: restructure OntologyData → add generators → add solvers → extend interaction types → extend distractors → add templates in feature batches → wire competencies → verify.

**Tech Stack:** TypeScript (strict), Vitest, React (GuidedSelection component), Astro, CSS modules.

---

## Task 1: Restructure OntologyData into grouped sub-objects

**Files:**
- Modify: `src/lib/task-engine/types.ts` (lines 127-140)
- Modify: `src/lib/task-engine/generators.ts` (all `data.elements` → `data.core.elements`, etc.)
- Modify: `src/lib/task-engine/solvers.ts` (all `data.elements` → `data.core.elements`, etc.)
- Modify: `src/lib/task-engine/distractor-engine.ts` (all `data.elements` → `data.core.elements`, etc.)
- Modify: `src/lib/task-engine/task-engine.ts` (lines 112-114)
- Modify: `src/lib/task-engine/prompt-renderer.ts` (line 5, RenderContext)
- Modify: `src/lib/task-engine/index.ts` (re-exports)
- Modify: `src/lib/task-engine/__tests__/task-engine.test.ts` (MOCK_DATA shape)
- Modify: `src/lib/task-engine/__tests__/generators.test.ts` (MOCK_DATA shape)
- Modify: `src/lib/task-engine/__tests__/solvers.test.ts` (MOCK_DATA shape)
- Modify: `src/lib/task-engine/__tests__/distractor-engine.test.ts` (MOCK_DATA shape)
- Modify: `src/lib/task-engine/__tests__/smoke.test.ts` (if uses OntologyData)
- Modify: `src/features/competency/exercise-adapters.ts` (lines 198-201)

### Step 1: Update OntologyData type

In `src/lib/task-engine/types.ts`, replace the flat `OntologyData` interface (lines 128-140) with:

```typescript
// ── Ontology data bundle (passed to generators/solvers) ────────
export interface OntologyCore {
  elements: import('../../types/element').Element[];
  ions: import('../../types/ion').Ion[];
  properties: PropertyDef[];
}

export interface OntologyRules {
  solubilityPairs: Array<{ cation: string; anion: string; solubility: string }>;
  oxidationExamples: import('../../types/oxidation').OxidationExample[];
  bondExamples?: import('../../types/bond').BondExamplesData;
  activitySeries?: import('../../types/rules').ActivitySeriesEntry[];
  classificationRules?: import('../../types/classification').ClassificationRule[];
  namingRules?: import('../../types/classification').NamingRule[];
  qualitativeTests?: import('../../types/qualitative').QualitativeTest[];
  energyCatalyst?: import('../../types/energy-catalyst').EnergyCatalystTheory;
  ionNomenclature?: import('../../types/ion-nomenclature').IonNomenclatureRules;
}

export interface OntologyDataSources {
  substances?: import('../../types/classification').SubstanceIndexEntry[];
  reactions?: import('../../types/reaction').Reaction[];
  geneticChains?: import('../../types/genetic-chain').GeneticChain[];
  calculations?: import('../../types/calculations').CalculationsData;
}

export interface OntologyI18n {
  morphology: MorphologyData | null;
  promptTemplates: PromptTemplateMap;
}

export interface OntologyData {
  core: OntologyCore;
  rules: OntologyRules;
  data: OntologyDataSources;
  i18n: OntologyI18n;
}
```

Also export the sub-interfaces from `index.ts`.

### Step 2: Update generators.ts

Mechanical replacement across all 10 generator functions:
- `data.elements` → `data.core.elements`
- `data.properties` → `data.core.properties`
- `data.ions` → `data.core.ions`
- `data.solubilityPairs` → `data.rules.solubilityPairs`
- `data.oxidationExamples` → `data.rules.oxidationExamples`
- `data.bondExamples` → `data.rules.bondExamples`
- `data.substanceIndex` → `data.data.substances`
- `data.reactions` → `data.data.reactions`

### Step 3: Update solvers.ts

Same mechanical replacement across all 7 solver functions:
- `data.elements` → `data.core.elements`
- `data.properties` → `data.core.properties`
- `data.ions` → `data.core.ions`
- `data.solubilityPairs` → `data.rules.solubilityPairs`
- `data.bondExamples` → `data.rules.bondExamples`

### Step 4: Update distractor-engine.ts

- `data.elements` → `data.core.elements`
- `data.ions` → `data.core.ions`
- `data.bondExamples` → `data.rules.bondExamples`
- `data.substanceIndex` → `data.data.substances`

### Step 5: Update task-engine.ts

In `executeTemplate()`, update `renderCtx` (lines 111-114):
```typescript
const renderCtx: RenderContext = {
  promptTemplates: ontology.i18n.promptTemplates,
  properties: ontology.core.properties,
  morphology: ontology.i18n.morphology,
};
```

### Step 6: Update all test files

Every test file that builds `MOCK_DATA` must switch from flat shape:
```typescript
const MOCK_DATA: OntologyData = {
  elements: [...], ions: [...], properties: [...], solubilityPairs: [],
  oxidationExamples: [], morphology: null, promptTemplates: {},
  bondExamples: MOCK_BOND_EXAMPLES, substanceIndex: [...], reactions: [...]
};
```
to grouped shape:
```typescript
const MOCK_DATA: OntologyData = {
  core: { elements: [...], ions: [...], properties: [...] },
  rules: { solubilityPairs: [], oxidationExamples: [], bondExamples: MOCK_BOND_EXAMPLES },
  data: { substances: [...], reactions: [...] },
  i18n: { morphology: null, promptTemplates: {} },
};
```

Test files to update:
- `__tests__/task-engine.test.ts`
- `__tests__/generators.test.ts`
- `__tests__/solvers.test.ts`
- `__tests__/distractor-engine.test.ts`
- `__tests__/smoke.test.ts` (if applicable)

### Step 7: Update exercise-adapters.ts

In `loadEngineAdapter()`, restructure the ontology object (lines 198-201):
```typescript
const ontology: OntologyData = {
  core: { elements, ions, properties },
  rules: { solubilityPairs, oxidationExamples, bondExamples },
  data: { substances: substanceIndex, reactions },
  i18n: { morphology, promptTemplates },
};
```

### Step 8: Run tests

Run: `npx vitest run`
Expected: All 147 tests pass (pure refactor, no behavior changes).

### Step 9: Commit

```bash
git add src/lib/task-engine/ src/features/competency/exercise-adapters.ts
git commit -m "refactor(task-engine): restructure OntologyData into grouped sub-objects

Migrate from flat 10-field OntologyData to 4 grouped sub-objects:
core (elements, ions, properties), rules (solubility, oxidation, bonds, etc.),
data (substances, reactions, chains, calculations), i18n (morphology, prompts).
Mechanical rename across generators, solvers, distractor-engine, tests."
```

---

## Task 2: Add new interaction types to types.ts

**Files:**
- Modify: `src/lib/task-engine/types.ts`

### Step 1: Extend InteractionType union

In `types.ts` line 2-7, add new types:
```typescript
export type InteractionType =
  | 'choice_single'
  | 'choice_multi'
  | 'order_dragdrop'
  | 'numeric_input'
  | 'match_pairs'
  | 'interactive_orbital'
  | 'guided_selection';
```

### Step 2: Run tests

Run: `npx vitest run`
Expected: All 147 pass (additive change only).

### Step 3: Commit

```bash
git add src/lib/task-engine/types.ts
git commit -m "feat(task-engine): add interactive_orbital and guided_selection interaction types"
```

---

## Task 3: Extend toExercise() for new interaction types

**Files:**
- Modify: `src/lib/task-engine/task-engine.ts` (Exercise interface + toExercise function)
- Modify: `src/lib/task-engine/index.ts` (re-exports)
- Test: `src/lib/task-engine/__tests__/task-engine.test.ts`

### Step 1: Write failing tests

Add to `task-engine.test.ts`:

```typescript
describe('toExercise format routing', () => {
  it('choice_multi returns multiple_choice_multi format with correctIds', () => {
    const task: GeneratedTask = {
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
    const ex = engine.toExercise(task);
    expect(ex.format).toBe('multiple_choice_multi');
    expect(ex.correctIds).toEqual(expect.arrayContaining(['correct_0', 'correct_1']));
    expect(ex.options).toHaveLength(4);
  });

  it('match_pairs returns match_pairs format with pairs', () => {
    const task: GeneratedTask = {
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
    const ex = engine.toExercise(task);
    expect(ex.format).toBe('match_pairs');
    expect(ex.pairs).toHaveLength(2);
    expect(ex.pairs![0]).toEqual({ left: 'Cl⁻', right: 'AgNO₃' });
  });

  it('interactive_orbital returns interactive_orbital format with targetZ', () => {
    const task: GeneratedTask = {
      template_id: 'test.orbital',
      interaction: 'interactive_orbital',
      question: 'Fill orbital diagram for Na',
      correct_answer: '1s² 2s² 2p⁶ 3s¹',
      distractors: [],
      explanation: '',
      competency_map: {},
      difficulty: 0.5,
      exam_tags: [],
      slots: { element: 'Na', Z: 11 },
    };
    const ex = engine.toExercise(task);
    expect(ex.format).toBe('interactive_orbital');
    expect(ex.targetZ).toBe(11);
  });

  it('guided_selection returns guided_selection format with context', () => {
    const task: GeneratedTask = {
      template_id: 'test.guided',
      interaction: 'guided_selection',
      question: 'Complete the chain step',
      correct_answer: 'CaO',
      distractors: ['NaCl', 'HCl'],
      explanation: '',
      competency_map: {},
      difficulty: 0.5,
      exam_tags: [],
      slots: {
        chain_substances: ['CaCO₃', '?', 'Ca(OH)₂'],
        gap_index: 1,
      },
    };
    const ex = engine.toExercise(task);
    expect(ex.format).toBe('guided_selection');
    expect(ex.context).toBeDefined();
    expect(ex.context!.chain).toEqual(['CaCO₃', '?', 'Ca(OH)₂']);
    expect(ex.context!.gapIndex).toBe(1);
  });
});
```

### Step 2: Run tests to verify failure

Run: `npx vitest run src/lib/task-engine/__tests__/task-engine.test.ts`
Expected: 4 new tests FAIL.

### Step 3: Extend Exercise type and toExercise()

In `task-engine.ts`, update the `Exercise` interface:

```typescript
export interface Exercise {
  type: string;
  question: string;
  format: 'multiple_choice' | 'multiple_choice_multi' | 'match_pairs' | 'interactive_orbital' | 'guided_selection';
  options: Array<{ id: string; text: string }>;
  correctId: string;
  correctIds?: string[];
  pairs?: Array<{ left: string; right: string }>;
  targetZ?: number;
  context?: { chain: string[]; gapIndex: number };
  explanation: string;
  competencyMap: Record<string, 'P' | 'S'>;
}
```

Update `toExercise()` to handle new formats:

```typescript
function toExercise(task: GeneratedTask): Exercise {
  const base = {
    type: task.template_id,
    question: task.question,
    explanation: task.explanation,
    competencyMap: task.competency_map,
  };

  // choice_multi: checkboxes, multiple correct answers
  if (task.interaction === 'choice_multi') {
    const answers = Array.isArray(task.correct_answer) ? task.correct_answer : [String(task.correct_answer)];
    const options: Array<{ id: string; text: string }> = [];
    const correctIds: string[] = [];
    for (let i = 0; i < answers.length; i++) {
      const id = `correct_${i}`;
      options.push({ id, text: answers[i] });
      correctIds.push(id);
    }
    for (let i = 0; i < task.distractors.length; i++) {
      options.push({ id: `wrong_${i}`, text: task.distractors[i] });
    }
    // Shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { ...base, format: 'multiple_choice_multi', options, correctId: correctIds[0], correctIds };
  }

  // match_pairs: two-column matching
  if (task.interaction === 'match_pairs') {
    const pairStrings = Array.isArray(task.correct_answer) ? task.correct_answer : [String(task.correct_answer)];
    const pairs = pairStrings.map(s => {
      const [left, right] = String(s).split(':');
      return { left, right };
    });
    return { ...base, format: 'match_pairs', pairs, options: [], correctId: '' };
  }

  // interactive_orbital: orbital box filling
  if (task.interaction === 'interactive_orbital') {
    const targetZ = typeof task.slots.Z === 'number' ? task.slots.Z : Number(task.slots.Z);
    return { ...base, format: 'interactive_orbital', options: [], correctId: 'correct', targetZ };
  }

  // guided_selection: chain with substance selection
  if (task.interaction === 'guided_selection') {
    const chain = Array.isArray(task.slots.chain_substances)
      ? task.slots.chain_substances.map(String)
      : String(task.slots.chain_substances ?? '').split(',');
    const gapIndex = Number(task.slots.gap_index ?? 0);
    const options: Array<{ id: string; text: string }> = [
      { id: 'correct', text: String(task.correct_answer) },
    ];
    for (let i = 0; i < task.distractors.length; i++) {
      options.push({ id: `wrong_${i}`, text: task.distractors[i] });
    }
    return { ...base, format: 'guided_selection', options, correctId: 'correct', context: { chain, gapIndex } };
  }

  // Default: choice_single / numeric_input / order_dragdrop → multiple_choice
  const options: Array<{ id: string; text: string }> = [
    { id: 'correct', text: String(task.correct_answer) },
  ];
  for (let i = 0; i < task.distractors.length; i++) {
    options.push({ id: `wrong_${i}`, text: task.distractors[i] });
  }
  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { ...base, format: 'multiple_choice', options, correctId: 'correct' };
}
```

Also update the `Exercise` type in `exercise-adapters.ts` to match:
```typescript
export interface Exercise {
  type: string;
  question: string;
  format: 'multiple_choice' | 'multiple_choice_multi' | 'match_pairs' | 'interactive_orbital' | 'guided_selection';
  options: ExerciseOption[];
  correctId: string;
  correctIds?: string[];
  pairs?: Array<{ left: string; right: string }>;
  targetZ?: number;
  context?: { chain: string[]; gapIndex: number };
  explanation: string;
  competencyMap: Record<string, 'P' | 'S'>;
}
```

### Step 4: Run tests

Run: `npx vitest run`
Expected: All tests pass including 4 new ones.

### Step 5: Commit

```bash
git add src/lib/task-engine/task-engine.ts src/lib/task-engine/__tests__/task-engine.test.ts src/features/competency/exercise-adapters.ts
git commit -m "feat(task-engine): extend toExercise for choice_multi, match_pairs, interactive_orbital, guided_selection"
```

---

## Task 4: Add 11 new generators

**Files:**
- Modify: `src/lib/task-engine/generators.ts`
- Test: `src/lib/task-engine/__tests__/generators.test.ts`

### Step 1: Write failing tests for all 11 generators

Add to `generators.test.ts`. Each test uses minimal mock data for the new data paths. Example structure for each:

```typescript
// Add to mock data at top of file:
const MOCK_ACTIVITY_SERIES = [
  { symbol: 'Na', position: 1, reduces_H: true },
  { symbol: 'Fe', position: 5, reduces_H: true },
  { symbol: 'Cu', position: 8, reduces_H: false },
  { symbol: 'Au', position: 10, reduces_H: false },
];

const MOCK_QUALITATIVE_TESTS = [
  { target_id: 'Cl_minus', reagent_formula: 'AgNO₃', observation_ru: 'белый осадок AgCl' },
  { target_id: 'SO4_2minus', reagent_formula: 'BaCl₂', observation_ru: 'белый осадок BaSO₄' },
];

const MOCK_GENETIC_CHAINS = [
  { chain_id: 'Ca_chain', steps: [
    { substance: 'CaCO₃', reagent: 'нагревание', next: 'CaO' },
    { substance: 'CaO', reagent: 'H₂O', next: 'Ca(OH)₂' },
  ]},
];

const MOCK_ENERGY_CATALYST = {
  rate_factors: [
    { factor_id: 'temperature', label_ru: 'Температура', effect_ru: 'увеличивает скорость' },
    { factor_id: 'concentration', label_ru: 'Концентрация', effect_ru: 'увеличивает скорость' },
  ],
  catalyst_properties: [],
  common_catalysts: [
    { catalyst_id: 'MnO2', name_ru: 'Диоксид марганца', reactions_ru: ['разложение H₂O₂'] },
  ],
  equilibrium_shifts: [
    { change_ru: 'увеличение температуры', direction: 'endothermic', shift_ru: 'в сторону эндотермической' },
  ],
};

const MOCK_CALC_DATA = {
  calc_substances: [
    { formula: 'H₂O', M: 18, composition: { H: 2, O: 1 } },
    { formula: 'NaCl', M: 58.44, composition: { Na: 1, Cl: 1 } },
  ],
  calc_reactions: [
    { reaction_id: 'r1', equation_ru: '2H₂ + O₂ = 2H₂O', given: { formula: 'H₂', mass: 4, coeff: 2, M: 2 }, find: { formula: 'H₂O', coeff: 2, M: 18 } },
  ],
};

const MOCK_ION_NOMENCLATURE = {
  suffix_rules: [
    { ion_id: 'Cl_minus', suffix_type: 'ide', name_pattern_ru: '{base}-ид' },
    { ion_id: 'SO4_2minus', suffix_type: 'ate', name_pattern_ru: '{base}-ат' },
  ],
  acid_to_anion_pairs: [
    { acid_name_ru: 'Соляная кислота', acid_formula: 'HCl', anion_id: 'Cl_minus', anion_name_ru: 'хлорид' },
  ],
};

// Extend MOCK_DATA for Phase 3:
const MOCK_DATA_P3: OntologyData = {
  core: { elements: MOCK_ELEMENTS, ions: MOCK_IONS, properties: MOCK_PROPERTIES },
  rules: {
    solubilityPairs: [], oxidationExamples: MOCK_OXIDATION_EXAMPLES,
    activitySeries: MOCK_ACTIVITY_SERIES,
    qualitativeTests: MOCK_QUALITATIVE_TESTS,
    energyCatalyst: MOCK_ENERGY_CATALYST,
    ionNomenclature: MOCK_ION_NOMENCLATURE,
  },
  data: {
    geneticChains: MOCK_GENETIC_CHAINS,
    calculations: MOCK_CALC_DATA,
  },
  i18n: { morphology: null, promptTemplates: {} },
};
```

Tests for each generator:

```typescript
describe('Phase 3 generators', () => {
  describe('gen.pick_element_for_config', () => {
    it('picks element with Z ≤ 36', () => {
      const slots = runGenerator('gen.pick_element_for_config', {}, MOCK_DATA_P3);
      expect(slots.element).toBeDefined();
      expect(slots.Z).toBeDefined();
      expect(Number(slots.Z)).toBeLessThanOrEqual(36);
    });
  });

  describe('gen.pick_classification_rule', () => {
    it('picks a classification rule and returns class + description slots', () => {
      const data = { ...MOCK_DATA_P3, rules: { ...MOCK_DATA_P3.rules, classificationRules: [
        { class: 'oxide', subclass: 'basic', description_ru: 'Оксиды металлов', example: 'CaO' },
        { class: 'acid', subclass: 'oxygen', description_ru: 'Кислородсодержащие кислоты', example: 'H₂SO₄' },
      ]}};
      const slots = runGenerator('gen.pick_classification_rule', {}, data);
      expect(slots.class_label).toBeDefined();
      expect(slots.description).toBeDefined();
    });
  });

  describe('gen.pick_naming_rule', () => {
    it('picks a naming rule with template and example', () => {
      const data = { ...MOCK_DATA_P3, rules: { ...MOCK_DATA_P3.rules, namingRules: [
        { class: 'oxide', template_ru: '{металл} оксид', example_formula: 'CaO', example_name_ru: 'оксид кальция' },
      ]}};
      const slots = runGenerator('gen.pick_naming_rule', {}, data);
      expect(slots.template).toBeDefined();
      expect(slots.example_formula).toBeDefined();
    });
  });

  describe('gen.pick_activity_pair', () => {
    it('picks two metals from activity series', () => {
      const slots = runGenerator('gen.pick_activity_pair', {}, MOCK_DATA_P3);
      expect(slots.metalA).toBeDefined();
      expect(slots.metalB).toBeDefined();
      expect(slots.positionA).toBeDefined();
      expect(slots.positionB).toBeDefined();
    });
  });

  describe('gen.pick_qualitative_test', () => {
    it('picks a qualitative test with target, reagent, observation', () => {
      const slots = runGenerator('gen.pick_qualitative_test', {}, MOCK_DATA_P3);
      expect(slots.target_ion).toBeDefined();
      expect(slots.reagent).toBeDefined();
      expect(slots.observation).toBeDefined();
    });
  });

  describe('gen.pick_chain_step', () => {
    it('picks a chain step with substance, reagent, next', () => {
      const slots = runGenerator('gen.pick_chain_step', {}, MOCK_DATA_P3);
      expect(slots.substance).toBeDefined();
      expect(slots.reagent).toBeDefined();
      expect(slots.next).toBeDefined();
      expect(slots.chain_substances).toBeDefined();
      expect(slots.gap_index).toBeDefined();
    });
  });

  describe('gen.pick_energy_catalyst', () => {
    it('rate mode: returns rate factor', () => {
      const slots = runGenerator('gen.pick_energy_catalyst', { mode: 'rate' }, MOCK_DATA_P3);
      expect(slots.factor).toBeDefined();
    });

    it('cat mode: returns catalyst', () => {
      const slots = runGenerator('gen.pick_energy_catalyst', { mode: 'cat' }, MOCK_DATA_P3);
      expect(slots.catalyst).toBeDefined();
    });

    it('eq mode: returns equilibrium shift', () => {
      const slots = runGenerator('gen.pick_energy_catalyst', { mode: 'eq' }, MOCK_DATA_P3);
      expect(slots.change).toBeDefined();
      expect(slots.direction).toBeDefined();
    });
  });

  describe('gen.pick_calc_substance', () => {
    it('picks a substance with formula and M', () => {
      const slots = runGenerator('gen.pick_calc_substance', {}, MOCK_DATA_P3);
      expect(slots.formula).toBeDefined();
      expect(slots.M).toBeDefined();
      expect(slots.composition).toBeDefined();
    });
  });

  describe('gen.pick_calc_reaction', () => {
    it('picks a reaction with given and find data', () => {
      const slots = runGenerator('gen.pick_calc_reaction', {}, MOCK_DATA_P3);
      expect(slots.equation).toBeDefined();
      expect(slots.given_formula).toBeDefined();
      expect(slots.given_mass).toBeDefined();
    });
  });

  describe('gen.pick_solution_params', () => {
    it('generates random solution parameters', () => {
      const slots = runGenerator('gen.pick_solution_params', {}, MOCK_DATA_P3);
      expect(slots.m_solute).toBeDefined();
      expect(slots.m_solution).toBeDefined();
      expect(Number(slots.m_solute)).toBeGreaterThan(0);
      expect(Number(slots.m_solution)).toBeGreaterThan(Number(slots.m_solute));
    });
  });

  describe('gen.pick_ion_nomenclature', () => {
    it('default: picks ion with suffix data', () => {
      const slots = runGenerator('gen.pick_ion_nomenclature', {}, MOCK_DATA_P3);
      expect(slots.ion_id).toBeDefined();
      expect(slots.suffix_type).toBeDefined();
    });

    it('acid_pair mode: picks acid-anion pair', () => {
      const slots = runGenerator('gen.pick_ion_nomenclature', { mode: 'acid_pair' }, MOCK_DATA_P3);
      expect(slots.acid_name).toBeDefined();
      expect(slots.anion_name).toBeDefined();
    });
  });
});
```

### Step 2: Run tests to verify failure

Run: `npx vitest run src/lib/task-engine/__tests__/generators.test.ts`
Expected: All new tests FAIL with "Unknown generator".

### Step 3: Implement all 11 generators

Add to `generators.ts` after the existing generators:

```typescript
// ── Phase 3 generators ────────────────────────────────────────

function genPickElementForConfig(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  const candidates = data.core.elements.filter(el => el.Z <= 36 && el.Z >= 1);
  const el = pickRandom(candidates);
  return {
    element: el.symbol,
    Z: el.Z,
    period: el.period,
    group: el.group,
  };
}

function genPickClassificationRule(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.classificationRules?.length) throw new Error('classificationRules not available');
  const rule = pickRandom(data.rules.classificationRules);
  return {
    class_label: rule.class,
    subclass: rule.subclass ?? '',
    description: rule.description_ru ?? '',
    example: rule.example ?? '',
  };
}

function genPickNamingRule(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.namingRules?.length) throw new Error('namingRules not available');
  const rule = pickRandom(data.rules.namingRules);
  return {
    template: rule.template_ru ?? '',
    example_formula: rule.example_formula ?? '',
    example_name: rule.example_name_ru ?? '',
    substance_class: rule.class ?? '',
  };
}

function genPickActivityPair(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.activitySeries?.length) throw new Error('activitySeries not available');
  const [a, b] = pickK(data.rules.activitySeries, 2);
  return {
    metalA: a.symbol,
    metalB: b.symbol,
    positionA: a.position,
    positionB: b.position,
    reducesH_A: a.reduces_H,
    reducesH_B: b.reduces_H,
  };
}

function genPickQualitativeTest(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.qualitativeTests?.length) throw new Error('qualitativeTests not available');
  const test = pickRandom(data.rules.qualitativeTests);
  return {
    target_ion: test.target_id,
    reagent: test.reagent_formula,
    observation: test.observation_ru,
  };
}

function genPickChainStep(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.data.geneticChains?.length) throw new Error('geneticChains not available');
  const chain = pickRandom(data.data.geneticChains);
  if (chain.steps.length === 0) throw new Error('Empty chain');
  const stepIdx = Math.floor(Math.random() * chain.steps.length);
  const step = chain.steps[stepIdx];

  // Build chain substance list with gap
  const substances: string[] = [];
  for (let i = 0; i <= chain.steps.length; i++) {
    if (i === 0) substances.push(chain.steps[0].substance);
    else substances.push(chain.steps[i - 1].next);
  }
  // The gap is at stepIdx + 1 (the "next" of this step)
  const gapIndex = stepIdx + 1;
  substances[gapIndex] = '?';

  return {
    substance: step.substance,
    reagent: step.reagent,
    next: step.next,
    chain_id: chain.chain_id,
    chain_substances: substances,
    gap_index: gapIndex,
  };
}

function genPickEnergyCatalyst(params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.energyCatalyst) throw new Error('energyCatalyst not available');
  const ec = data.rules.energyCatalyst;

  const rawMode = typeof params.mode === 'string' ? params.mode : undefined;
  const mode = rawMode?.match(/^\{.+\}$/) ? pickRandom(['rate', 'cat', 'eq']) : (rawMode ?? pickRandom(['rate', 'cat', 'eq']));

  if (mode === 'rate' && ec.rate_factors.length > 0) {
    const f = pickRandom(ec.rate_factors);
    return { factor: f.factor_id, factor_label: f.label_ru, effect: f.effect_ru, mode: 'rate' };
  }
  if (mode === 'cat' && ec.common_catalysts.length > 0) {
    const c = pickRandom(ec.common_catalysts);
    return { catalyst: c.catalyst_id, catalyst_name: c.name_ru, mode: 'cat' };
  }
  if (mode === 'eq' && ec.equilibrium_shifts.length > 0) {
    const s = pickRandom(ec.equilibrium_shifts);
    return { change: s.change_ru, direction: s.direction, shift: s.shift_ru, mode: 'eq' };
  }
  throw new Error(`No energy/catalyst data for mode: ${mode}`);
}

function genPickCalcSubstance(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.data.calculations?.calc_substances?.length) throw new Error('calc_substances not available');
  const s = pickRandom(data.data.calculations.calc_substances);
  // Generate random mass for problems (10-100g, round to integer)
  const mass = Math.floor(Math.random() * 91) + 10;
  return {
    formula: s.formula,
    M: s.M,
    composition: JSON.stringify(s.composition),
    mass,
    // Pre-compute amount for convenience
    amount: +(mass / s.M).toFixed(3),
  };
}

function genPickCalcReaction(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.data.calculations?.calc_reactions?.length) throw new Error('calc_reactions not available');
  const r = pickRandom(data.data.calculations.calc_reactions);
  return {
    equation: r.equation_ru,
    given_formula: r.given.formula,
    given_mass: r.given.mass,
    given_coeff: r.given.coeff,
    given_M: r.given.M,
    find_formula: r.find.formula,
    find_coeff: r.find.coeff,
    find_M: r.find.M,
  };
}

function genPickSolutionParams(_params: Record<string, unknown>, _data: OntologyData): SlotValues {
  // Generate realistic random solution parameters
  const m_solute = Math.floor(Math.random() * 46) + 5; // 5-50g
  const m_solution = m_solute + Math.floor(Math.random() * 201) + 50; // 50-250g more
  const omega = +((m_solute / m_solution) * 100).toFixed(1);
  return {
    m_solute,
    m_solution,
    omega,
  };
}

function genPickIonNomenclature(params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.ionNomenclature) throw new Error('ionNomenclature not available');
  const nom = data.rules.ionNomenclature;

  const rawMode = typeof params.mode === 'string' ? params.mode : undefined;
  const mode = rawMode?.match(/^\{.+\}$/) ? pickRandom(['default', 'acid_pair', 'paired']) : (rawMode ?? 'default');

  if (mode === 'acid_pair' && nom.acid_to_anion_pairs.length > 0) {
    const pair = pickRandom(nom.acid_to_anion_pairs);
    return {
      acid_name: pair.acid_name_ru,
      acid_formula: pair.acid_formula,
      anion_id: pair.anion_id,
      anion_name: pair.anion_name_ru,
    };
  }

  // Default and paired: pick from suffix rules
  if (nom.suffix_rules.length === 0) throw new Error('No suffix rules available');
  const rule = pickRandom(nom.suffix_rules);
  const ion = data.core.ions.find(i => i.id === rule.ion_id);

  return {
    ion_id: rule.ion_id,
    formula: ion?.formula ?? rule.ion_id,
    name: ion?.name_ru ?? '',
    suffix_type: rule.suffix_type,
    suffix_label: rule.suffix_type,
    name_pattern: rule.name_pattern_ru,
  };
}
```

Register all in the GENERATORS map:

```typescript
const GENERATORS: Record<string, (params: Record<string, unknown>, data: OntologyData) => SlotValues> = {
  // Phase 1-2
  'gen.pick_element_pair': genPickElementPair,
  'gen.pick_elements_same_period': genPickElementsSamePeriod,
  'gen.pick_oxidation_example': genPickOxidationExample,
  'gen.pick_ion_pair': genPickIonPair,
  'gen.pick_salt_pair': genPickSaltPair,
  'gen.pick_bond_example': genPickBondExample,
  'gen.pick_bond_pair': genPickBondPair,
  'gen.pick_substance_by_class': genPickSubstanceByClass,
  'gen.pick_reaction': genPickReaction,
  'gen.pick_element_position': genPickElementPosition,
  // Phase 3
  'gen.pick_element_for_config': genPickElementForConfig,
  'gen.pick_classification_rule': genPickClassificationRule,
  'gen.pick_naming_rule': genPickNamingRule,
  'gen.pick_activity_pair': genPickActivityPair,
  'gen.pick_qualitative_test': genPickQualitativeTest,
  'gen.pick_chain_step': genPickChainStep,
  'gen.pick_energy_catalyst': genPickEnergyCatalyst,
  'gen.pick_calc_substance': genPickCalcSubstance,
  'gen.pick_calc_reaction': genPickCalcReaction,
  'gen.pick_solution_params': genPickSolutionParams,
  'gen.pick_ion_nomenclature': genPickIonNomenclature,
};
```

### Step 4: Run tests

Run: `npx vitest run src/lib/task-engine/__tests__/generators.test.ts`
Expected: All tests pass.

### Step 5: Commit

```bash
git add src/lib/task-engine/generators.ts src/lib/task-engine/__tests__/generators.test.ts
git commit -m "feat(task-engine): add 11 Phase 3 generators

Generators for: element_for_config, classification_rule, naming_rule,
activity_pair, qualitative_test, chain_step, energy_catalyst,
calc_substance, calc_reaction, solution_params, ion_nomenclature."
```

---

## Task 5: Add 13 new solvers

**Files:**
- Modify: `src/lib/task-engine/solvers.ts`
- Test: `src/lib/task-engine/__tests__/solvers.test.ts`

### Step 1: Write failing tests

Add to `solvers.test.ts` with mock data matching grouped structure:

```typescript
describe('Phase 3 solvers', () => {
  describe('solver.electron_config', () => {
    it('returns correct config for Na (Z=11)', () => {
      const result = runSolver('solver.electron_config', {}, { element: 'Na', Z: 11 }, MOCK_DATA_P3);
      expect(result.answer).toBe('1s² 2s² 2p⁶ 3s¹');
    });

    it('returns correct config for Fe (Z=26)', () => {
      // Need Fe in mock data
      const result = runSolver('solver.electron_config', {}, { element: 'Fe', Z: 26 }, MOCK_DATA_P3);
      expect(result.answer).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶');
    });
  });

  describe('solver.count_valence', () => {
    it('returns 1 for Na (group 1)', () => {
      const result = runSolver('solver.count_valence', {}, { element: 'Na', group: 1 }, MOCK_DATA_P3);
      expect(result.answer).toBe(1);
    });

    it('returns 7 for Cl (group 17)', () => {
      const result = runSolver('solver.count_valence', {}, { element: 'Cl', group: 17 }, MOCK_DATA_P3);
      expect(result.answer).toBe(7);
    });
  });

  describe('solver.delta_chi', () => {
    it('returns ionic for large Δχ (Na-Cl)', () => {
      const result = runSolver('solver.delta_chi', {}, { elementA: 'Na', elementB: 'Cl' }, MOCK_DATA_P3);
      expect(result.answer).toBe('ionic');
    });
  });

  describe('solver.molar_mass', () => {
    it('computes M for H₂O = 18', () => {
      const result = runSolver('solver.molar_mass', {},
        { formula: 'H₂O', composition: JSON.stringify({ H: 2, O: 1 }) }, MOCK_DATA_P3);
      expect(result.answer).toBe(18);
    });
  });

  describe('solver.mass_fraction', () => {
    it('computes ω(H) in H₂O ≈ 11.1%', () => {
      const result = runSolver('solver.mass_fraction', { target_element: 'H' },
        { formula: 'H₂O', M: 18, composition: JSON.stringify({ H: 2, O: 1 }) }, MOCK_DATA_P3);
      expect(Number(result.answer)).toBeCloseTo(11.1, 0);
    });
  });

  describe('solver.amount_calc', () => {
    it('mode n: computes n = m/M', () => {
      const result = runSolver('solver.amount_calc', { mode: 'n' },
        { mass: 36, M: 18 }, MOCK_DATA_P3);
      expect(result.answer).toBe(2);
    });

    it('mode m: computes m = n × M', () => {
      const result = runSolver('solver.amount_calc', { mode: 'm' },
        { amount: 2, M: 18 }, MOCK_DATA_P3);
      expect(result.answer).toBe(36);
    });
  });

  describe('solver.concentration', () => {
    it('computes ω = m_solute/m_solution × 100', () => {
      const result = runSolver('solver.concentration', {},
        { m_solute: 10, m_solution: 100 }, MOCK_DATA_P3);
      expect(result.answer).toBe(10);
    });
  });

  describe('solver.stoichiometry', () => {
    it('computes product mass from given mass', () => {
      const result = runSolver('solver.stoichiometry', {},
        { given_mass: 4, given_coeff: 2, given_M: 2, find_coeff: 2, find_M: 18 }, MOCK_DATA_P3);
      expect(result.answer).toBe(36);
    });
  });

  describe('solver.reaction_yield', () => {
    it('computes practical mass with yield', () => {
      const result = runSolver('solver.reaction_yield', {},
        { given_mass: 4, given_coeff: 2, given_M: 2, find_coeff: 2, find_M: 18, yield_percent: 80 }, MOCK_DATA_P3);
      expect(Number(result.answer)).toBeCloseTo(28.8, 1);
    });
  });

  describe('solver.activity_compare', () => {
    it('returns "yes" when more active metal displaces less active', () => {
      const result = runSolver('solver.activity_compare', {},
        { metalA: 'Na', metalB: 'Cu', positionA: 1, positionB: 8 }, MOCK_DATA_P3);
      expect(result.answer).toBe('yes');
    });

    it('returns "no" when less active metal cannot displace', () => {
      const result = runSolver('solver.activity_compare', {},
        { metalA: 'Cu', metalB: 'Na', positionA: 8, positionB: 1 }, MOCK_DATA_P3);
      expect(result.answer).toBe('no');
    });
  });

  describe('solver.driving_force', () => {
    it('returns driving force label from reaction slots', () => {
      // Needs reaction with precipitation product
      const result = runSolver('solver.driving_force', {},
        { products: 'AgCl↓ + NaNO₃', has_precipitate: true }, MOCK_DATA_P3);
      expect(result.answer).toBe('precipitate');
    });
  });

  describe('solver.predict_observation', () => {
    it('returns observation text from slot', () => {
      const result = runSolver('solver.predict_observation', {},
        { observation: 'белый осадок AgCl' }, MOCK_DATA_P3);
      expect(result.answer).toBe('белый осадок AgCl');
    });
  });
});
```

### Step 2: Run tests to verify failure

Run: `npx vitest run src/lib/task-engine/__tests__/solvers.test.ts`
Expected: New tests FAIL.

### Step 3: Implement all 13 solvers

Add to `solvers.ts`:

```typescript
// ── Phase 3 solvers ────────────────────────────────────────────

// Klechkowski filling order for electron config
const SUBSHELL_ORDER: Array<[number, string, number]> = [
  [1,'s',2],[2,'s',2],[2,'p',6],[3,'s',2],[3,'p',6],[4,'s',2],[3,'d',10],[4,'p',6],
  [5,'s',2],[4,'d',10],[5,'p',6],[6,'s',2],[4,'f',14],[5,'d',10],[6,'p',6],
  [7,'s',2],[5,'f',14],[6,'d',10],[7,'p',6],
];

const SUPERSCRIPT_DIGIT_MAP: Record<number, string> = {
  0: '\u2070', 1: '\u00b9', 2: '\u00b2', 3: '\u00b3', 4: '\u2074',
  5: '\u2075', 6: '\u2076', 7: '\u2077', 8: '\u2078', 9: '\u2079',
};

function toSuperscript(n: number): string {
  return String(n).split('').map(d => SUPERSCRIPT_DIGIT_MAP[Number(d)] ?? d).join('');
}

function solveElectronConfig(params: Record<string, unknown>, slots: SlotValues): SolverResult {
  void params;
  const Z = Number(slots.Z);
  let remaining = Z;
  const parts: string[] = [];
  for (const [n, l, max] of SUBSHELL_ORDER) {
    if (remaining <= 0) break;
    const fill = Math.min(remaining, max);
    parts.push(`${n}${l}${toSuperscript(fill)}`);
    remaining -= fill;
  }
  return { answer: parts.join(' ') };
}

function solveCountValence(params: Record<string, unknown>, slots: SlotValues): SolverResult {
  void params;
  const group = Number(slots.group);
  // Main group: valence = group number (1-2 for s-block, group-10 for p-block? No — for main group, valence = last digit for groups 1-2, group-10 for 13-18)
  // Simplified: for groups 1-2, valence = group; for groups 13-18, valence = group - 10
  let valence: number;
  if (group <= 2) valence = group;
  else if (group >= 13) valence = group - 10;
  else valence = group; // transition metals — group number as approximation
  return { answer: valence };
}

function solveDeltaChi(
  params: Record<string, unknown>,
  slots: SlotValues,
  data: OntologyData,
): SolverResult {
  void params;
  const elA = findElement(String(slots.elementA), data);
  const elB = findElement(String(slots.elementB), data);
  const chiA = elA.electronegativity ?? 0;
  const chiB = elB.electronegativity ?? 0;
  const delta = Math.abs(chiA - chiB);

  let bondType: string;
  if (delta >= 1.7) bondType = 'ionic';
  else if (delta >= 0.4) bondType = 'covalent_polar';
  else bondType = 'covalent_nonpolar';

  return {
    answer: bondType,
    explanation_slots: { delta: delta.toFixed(2), chiA: String(chiA), chiB: String(chiB) },
  };
}

function solveMolarMass(params: Record<string, unknown>, slots: SlotValues, data: OntologyData): SolverResult {
  void params;
  const composition = typeof slots.composition === 'string' ? JSON.parse(slots.composition) : slots.composition;
  // Atomic masses from elements
  let M = 0;
  for (const [sym, count] of Object.entries(composition as Record<string, number>)) {
    const el = data.core.elements.find(e => e.symbol === sym);
    const Ar = el?.atomic_mass ?? 0;
    M += Ar * count;
  }
  return { answer: +M.toFixed(2) };
}

function solveMassFraction(params: Record<string, unknown>, slots: SlotValues, data: OntologyData): SolverResult {
  const targetEl = String(params.target_element ?? slots.element ?? '');
  const M = Number(slots.M);
  const composition = typeof slots.composition === 'string' ? JSON.parse(slots.composition) : slots.composition;
  const count = (composition as Record<string, number>)[targetEl] ?? 0;
  const el = data.core.elements.find(e => e.symbol === targetEl);
  const Ar = el?.atomic_mass ?? 0;
  const fraction = (Ar * count / M) * 100;
  return { answer: +fraction.toFixed(1) };
}

function solveAmountCalc(params: Record<string, unknown>, slots: SlotValues): SolverResult {
  const mode = String(params.mode ?? 'n');
  if (mode === 'n') {
    const mass = Number(slots.mass);
    const M = Number(slots.M);
    return { answer: +(mass / M).toFixed(3) };
  }
  // mode === 'm'
  const amount = Number(slots.amount);
  const M = Number(slots.M);
  return { answer: +(amount * M).toFixed(2) };
}

function solveConcentration(params: Record<string, unknown>, slots: SlotValues): SolverResult {
  const mode = String(params.mode ?? 'omega');
  if (mode === 'inverse') {
    // find m_solute from omega and m_solution
    const omega = Number(slots.omega);
    const m_solution = Number(slots.m_solution);
    return { answer: +((omega * m_solution) / 100).toFixed(1) };
  }
  if (mode === 'dilution') {
    // ω₁·m₁ = ω₂·m₂ → m₂ = ω₁·m₁/ω₂
    const omega1 = Number(slots.omega);
    const m1 = Number(slots.m_solution);
    const omega2 = Number(slots.omega_target ?? slots.omega / 2);
    return { answer: +((omega1 * m1) / omega2).toFixed(1) };
  }
  // Default: compute omega
  const m_solute = Number(slots.m_solute);
  const m_solution = Number(slots.m_solution);
  return { answer: +((m_solute / m_solution) * 100).toFixed(1) };
}

function solveStoichiometry(params: Record<string, unknown>, slots: SlotValues): SolverResult {
  void params;
  const givenMass = Number(slots.given_mass);
  const givenCoeff = Number(slots.given_coeff);
  const givenM = Number(slots.given_M);
  const findCoeff = Number(slots.find_coeff);
  const findM = Number(slots.find_M);

  // n_given = m / M, n_find = n_given × (find_coeff / given_coeff), m_find = n_find × M_find
  const nGiven = givenMass / givenM;
  const nFind = nGiven * (findCoeff / givenCoeff);
  const mFind = nFind * findM;

  return { answer: +mFind.toFixed(2) };
}

function solveReactionYield(params: Record<string, unknown>, slots: SlotValues): SolverResult {
  void params;
  const givenMass = Number(slots.given_mass);
  const givenCoeff = Number(slots.given_coeff);
  const givenM = Number(slots.given_M);
  const findCoeff = Number(slots.find_coeff);
  const findM = Number(slots.find_M);
  const yieldPercent = Number(slots.yield_percent ?? 100);

  const nGiven = givenMass / givenM;
  const nFind = nGiven * (findCoeff / givenCoeff);
  const mTheoretical = nFind * findM;
  const mPractical = mTheoretical * (yieldPercent / 100);

  return { answer: +mPractical.toFixed(2) };
}

function solveActivityCompare(params: Record<string, unknown>, slots: SlotValues): SolverResult {
  void params;
  const posA = Number(slots.positionA);
  const posB = Number(slots.positionB);
  // Lower position = more active in activity series
  const canDisplace = posA < posB;
  return { answer: canDisplace ? 'yes' : 'no' };
}

function solveDrivingForce(params: Record<string, unknown>, slots: SlotValues): SolverResult {
  void params;
  if (slots.has_precipitate) return { answer: 'precipitate' };
  if (slots.has_gas) return { answer: 'gas' };
  if (slots.has_water) return { answer: 'water' };
  if (slots.has_weak_electrolyte) return { answer: 'weak_electrolyte' };
  return { answer: 'none' };
}

function solvePredictObservation(params: Record<string, unknown>, slots: SlotValues): SolverResult {
  void params;
  return { answer: String(slots.observation ?? '') };
}
```

Register in SOLVERS:
```typescript
const SOLVERS: Record<string, SolverFn> = {
  // Phase 1-2
  'solver.compare_property': solveCompareProperty,
  'solver.periodic_trend_order': solvePeriodicTrendOrder,
  'solver.oxidation_states': (params, slots) => solveOxidationStates(params, slots),
  'solver.compose_salt_formula': solveComposeSaltFormula,
  'solver.solubility_check': solveSolubilityCheck,
  'solver.slot_lookup': (params, slots) => solveSlotLookup(params, slots),
  'solver.compare_crystal_melting': solveCompareCrystalMelting,
  // Phase 3
  'solver.electron_config': (params, slots) => solveElectronConfig(params, slots),
  'solver.count_valence': (params, slots) => solveCountValence(params, slots),
  'solver.delta_chi': solveDeltaChi,
  'solver.molar_mass': solveMolarMass,
  'solver.mass_fraction': solveMassFraction,
  'solver.amount_calc': (params, slots) => solveAmountCalc(params, slots),
  'solver.concentration': (params, slots) => solveConcentration(params, slots),
  'solver.stoichiometry': (params, slots) => solveStoichiometry(params, slots),
  'solver.reaction_yield': (params, slots) => solveReactionYield(params, slots),
  'solver.activity_compare': (params, slots) => solveActivityCompare(params, slots),
  'solver.driving_force': (params, slots) => solveDrivingForce(params, slots),
  'solver.predict_observation': (params, slots) => solvePredictObservation(params, slots),
};
```

Note: `solver.ionic_spectators` is deferred — it requires full ionic equation parsing which is complex. Use `solver.slot_lookup` with pre-computed spectator slots from the generator instead.

### Step 4: Run tests

Run: `npx vitest run src/lib/task-engine/__tests__/solvers.test.ts`
Expected: All tests pass.

### Step 5: Commit

```bash
git add src/lib/task-engine/solvers.ts src/lib/task-engine/__tests__/solvers.test.ts
git commit -m "feat(task-engine): add 13 Phase 3 solvers

Solvers for: electron_config, count_valence, delta_chi, molar_mass,
mass_fraction, amount_calc, concentration, stoichiometry, reaction_yield,
activity_compare, driving_force, predict_observation."
```

---

## Task 6: Extend distractor engine for new answer types

**Files:**
- Modify: `src/lib/task-engine/distractor-engine.ts`
- Test: `src/lib/task-engine/__tests__/distractor-engine.test.ts`

### Step 1: Write failing tests

```typescript
describe('calculation distractors', () => {
  it('generates multiplier-based distractors for large numbers', () => {
    const distractors = generateDistractors(
      36, { formula: 'H₂O', M: 18, mass: 36 }, 'choice_single', MOCK_DATA, 4,
    );
    expect(distractors.length).toBe(4);
    expect(distractors).not.toContain('36');
    // Should include values like 28.8, 43.2, 18, 72
    for (const d of distractors) {
      expect(Number.isFinite(Number(d))).toBe(true);
    }
  });
});

describe('electron config distractors', () => {
  it('generates configs for adjacent Z elements', () => {
    const distractors = generateDistractors(
      '1s² 2s² 2p⁶ 3s¹',
      { Z: 11, element: 'Na' },
      'choice_single',
      MOCK_DATA,
      3,
    );
    expect(distractors.length).toBe(3);
    expect(distractors).not.toContain('1s² 2s² 2p⁶ 3s¹');
  });
});

describe('activity series distractors', () => {
  it('generates yes/no/with-heating options', () => {
    const distractors = generateDistractors(
      'yes',
      { metalA: 'Na', metalB: 'Cu', positionA: 1, positionB: 8 },
      'choice_single',
      MOCK_DATA,
      3,
    );
    expect(distractors).toContain('no');
  });
});

describe('observation distractors', () => {
  it('generates other observation texts', () => {
    const data = { ...MOCK_DATA, rules: { ...MOCK_DATA.rules, qualitativeTests: [
      { target_id: 'Cl_minus', reagent_formula: 'AgNO₃', observation_ru: 'белый осадок AgCl' },
      { target_id: 'SO4_2minus', reagent_formula: 'BaCl₂', observation_ru: 'белый осадок BaSO₄' },
      { target_id: 'Fe3_plus', reagent_formula: 'KSCN', observation_ru: 'кроваво-красное окрашивание' },
    ]}};
    const distractors = generateDistractors(
      'белый осадок AgCl',
      { target_ion: 'Cl_minus', observation: 'белый осадок AgCl' },
      'choice_single',
      data,
      2,
    );
    expect(distractors).not.toContain('белый осадок AgCl');
    expect(distractors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('chain substance distractors', () => {
  it('generates other substances from chain pool', () => {
    const distractors = generateDistractors(
      'CaO',
      { chain_substances: ['CaCO₃', '?', 'Ca(OH)₂'], gap_index: 1, next: 'CaO' },
      'guided_selection',
      MOCK_DATA,
      3,
    );
    expect(distractors).not.toContain('CaO');
    expect(distractors.length).toBeGreaterThanOrEqual(2);
  });
});
```

### Step 2: Implement new distractor strategies

Add new strategies in `distractor-engine.ts` within the priority chain:

1. **Electron config** (before fallback): if answer matches pattern like `1s² 2s²...` and slots.Z exists, generate configs for Z-1, Z+1, Z-2, Z+2.
2. **Activity response** (before fallback): if answer is "yes"/"no" and slots have metalA/metalB, return ["yes", "no", "only with heating", "only with catalyst"].
3. **Observation** (before fallback): if slots have observation and data has qualitativeTests, return other observations.
4. **Calculation multiplier** (extend numeric): for choice_single with numeric answer > 10 and slots containing M or mass, use multiplier-based distractors (×0.8, ×1.2, ×0.5, ×2, ÷M, etc.).
5. **Chain substance** (before fallback): if interaction is guided_selection and slots have chain_substances, return other substances from substance pool.

### Step 3: Run tests

Run: `npx vitest run src/lib/task-engine/__tests__/distractor-engine.test.ts`
Expected: All pass.

### Step 4: Commit

```bash
git add src/lib/task-engine/distractor-engine.ts src/lib/task-engine/__tests__/distractor-engine.test.ts
git commit -m "feat(distractor-engine): add strategies for calculations, electron config, activity, observation, chain"
```

---

## Task 7: PT batch — 4 new templates + prompts

**Files:**
- Modify: `data-src/engine/task_templates.json` (add 4 templates)
- Modify: `data-src/engine/prompt_templates.ru.json` (add 4 prompts)
- Modify: `data-src/engine/prompt_templates.en.json` (add 4 prompts)
- Modify: `data-src/engine/prompt_templates.pl.json` (add 4 prompts)
- Modify: `data-src/engine/prompt_templates.es.json` (add 4 prompts)
- Test: `src/lib/task-engine/__tests__/task-engine.test.ts` (add integration tests)

### Step 1: Add prompt templates

In each locale file, add:
- `prompt.select_electron_config` — "What is the electron configuration of {element}?"
- `prompt.count_valence` — "How many valence electrons does {element} have?"
- `prompt.element_from_config` — "Which element has the electron configuration {config}?"
- `prompt.fill_orbital` — "Fill the orbital diagram for {element}."

### Step 2: Add task templates

Add to `task_templates.json`:

```json
{
  "template_id": "tmpl.pt.select_electron_config.v1",
  "meta": { "interaction": "choice_single", "objects": ["element"], "reasoning": ["property_lookup"], "evaluation": { "mode": "exact" } },
  "pipeline": {
    "generator": { "id": "gen.pick_element_for_config", "params": {} },
    "solvers": [{ "id": "solver.electron_config", "params": {} }],
    "renderers": [{ "id": "view.choice_single", "params": {} }]
  },
  "prompt_template_id": "prompt.select_electron_config",
  "explanation_template_id": "explain.select_electron_config",
  "evidence_rules": ["electron_config"],
  "difficulty_model": { "features": { "Z_range": "auto" }, "target_band": [0.25, 0.55] },
  "exam_tags": ["oge"],
  "competency_hint": { "electron_config": "P", "periodic_table": "S" }
},
{
  "template_id": "tmpl.pt.count_valence.v1",
  "meta": { "interaction": "numeric_input", "objects": ["element"], "reasoning": ["property_lookup"], "evaluation": { "mode": "exact" } },
  "pipeline": {
    "generator": { "id": "gen.pick_element_position", "params": {} },
    "solvers": [{ "id": "solver.count_valence", "params": {} }],
    "renderers": [{ "id": "view.numeric_input", "params": { "min": 1, "max": 8, "step": 1 } }]
  },
  "prompt_template_id": "prompt.count_valence",
  "explanation_template_id": "explain.count_valence",
  "evidence_rules": ["count_valence"],
  "difficulty_model": { "features": { "transition_metal": "auto" }, "target_band": [0.2, 0.5] },
  "exam_tags": ["oge"],
  "competency_hint": { "electron_config": "P", "periodic_table": "S" }
},
{
  "template_id": "tmpl.pt.element_from_config.v1",
  "meta": { "interaction": "choice_single", "objects": ["element"], "reasoning": ["property_lookup"], "evaluation": { "mode": "exact" } },
  "pipeline": {
    "generator": { "id": "gen.pick_element_for_config", "params": {} },
    "solvers": [{ "id": "solver.slot_lookup", "params": { "answer_field": "element" } }],
    "renderers": [{ "id": "view.choice_single", "params": {} }]
  },
  "prompt_template_id": "prompt.element_from_config",
  "explanation_template_id": "explain.element_from_config",
  "evidence_rules": ["electron_config"],
  "difficulty_model": { "features": { "Z_range": "auto" }, "target_band": [0.3, 0.6] },
  "exam_tags": ["oge"],
  "competency_hint": { "electron_config": "P", "periodic_table": "S" }
},
{
  "template_id": "tmpl.pt.fill_orbital.v1",
  "meta": { "interaction": "interactive_orbital", "objects": ["element"], "reasoning": ["constraint_satisfaction"], "evaluation": { "mode": "exact" } },
  "pipeline": {
    "generator": { "id": "gen.pick_element_for_config", "params": {} },
    "solvers": [{ "id": "solver.electron_config", "params": {} }],
    "renderers": [{ "id": "view.interactive_orbital", "params": {} }]
  },
  "prompt_template_id": "prompt.fill_orbital",
  "explanation_template_id": "explain.fill_orbital",
  "evidence_rules": ["electron_config"],
  "difficulty_model": { "features": { "Z_range": "auto", "has_d_block": "auto" }, "target_band": [0.3, 0.7] },
  "exam_tags": ["oge", "ege"],
  "competency_hint": { "electron_config": "P" }
}
```

### Step 3: Add integration tests

### Step 4: Build data and run tests

Run: `npm run build:data && npx vitest run`

### Step 5: Commit

```bash
git add data-src/engine/ src/lib/task-engine/__tests__/task-engine.test.ts
git commit -m "feat(task-engine): add PT batch — 4 electron config/valence templates + prompts"
```

---

## Task 8: Bonds batch — 2 new templates + prompts

Templates: `tmpl.bond.predict_property.v1`, `tmpl.bond.delta_chi.v1`

Prompts:
- `prompt.predict_crystal_property` — "Which physical properties are characteristic of substances with {crystal_type} crystal structure?"
- `prompt.bond_from_delta_chi` — "Determine the bond type in the compound formed by {elementA} and {elementB} based on electronegativity difference."

Follow same pattern as Task 7: add prompts (4 locales), add templates, add integration tests, build data, run tests, commit.

---

## Task 9: Oxidation states batch — 2 new templates + prompts

Templates: `tmpl.ox.select_by_state.v1`, `tmpl.ox.min_state.v1`

Prompts:
- `prompt.select_compound_by_state` — "In which compound does {element} have oxidation state {state}?"
- `prompt.min_oxidation_state` — "What is the minimum typical oxidation state of {element}?"

Need to add `min_oxidation_state` to `genPickElementPosition` output slots (compute as `Math.min(...typical_oxidation_states)`).

Follow same pattern: prompts, templates, tests, build, commit.

---

## Task 10: Substances batch — 7 new templates + prompts

Templates: `tmpl.class.classify_subclass.v1`, `tmpl.class.identify_by_description.v1`, `tmpl.sub.formula_to_name.v1`, `tmpl.sub.name_to_formula.v1`, `tmpl.sub.identify_amphoteric.v1`, `tmpl.sub.amphoteric_partner.v1`, `tmpl.sub.naming_rule.v1`

Prompts (7 new across 4 locales):
- `prompt.classify_subclass` — "Classify the subclass of {formula}."
- `prompt.identify_class_by_desc` — "Which class of inorganic substances matches this description: {description}?"
- `prompt.formula_to_name` — "What is the name of the substance {formula}?"
- `prompt.name_to_formula` — "Write the formula of {name}."
- `prompt.identify_amphoteric` — "Which substance is amphoteric?"
- `prompt.amphoteric_reaction_partner` — "{formula} is amphoteric. With which types of substances can it react?"
- `prompt.naming_rule_template` — "Which naming rule applies to {formula}?"

This batch requires `gen.pick_substance_by_class` to also fill `name` slot (currently fills formula, class, subclass). Add `name_ru` from substanceIndex to slots.

Also need `gen.pick_classification_rule` and `gen.pick_naming_rule` (added in Task 4).

For amphoteric templates, add filter to `genPickSubstanceByClass`: when `params.amphoteric` is set, cross-reference with elements that have `amphoteric: true` and filter substances accordingly.

Follow pattern: prompts, templates, update generator, tests, build, commit.

---

## Task 11: Reactions batch — 18 new templates + prompts

This is the largest batch. Split into sub-commits if needed.

### Sub-batches:

**11a. Exchange reactions (3 templates):**
- `tmpl.rxn.predict_exchange.v1`, `tmpl.rxn.driving_force.v1`, `tmpl.rxn.will_occur.v1`
- Needs `gen.pick_reaction` with exchange filter + driving_force solver

**11b. Activity series (2 templates):**
- `tmpl.rxn.activity_compare.v1`, `tmpl.rxn.will_metal_react.v1`
- Uses `gen.pick_activity_pair` + `solver.activity_compare`

**11c. Ionic equations (2 templates):**
- `tmpl.rxn.match_ionic.v1`, `tmpl.rxn.spectator_ions.v1`
- Uses `gen.pick_reaction{ionic}` + `solver.slot_lookup{net_ionic}`

**11d. Qualitative analysis (2 templates):**
- `tmpl.qual.identify_reagent.v1`, `tmpl.qual.identify_ion.v1`
- Uses `gen.pick_qualitative_test`

**11e. Genetic chains (2 templates):**
- `tmpl.chain.complete_step.v1`, `tmpl.chain.choose_reagent.v1`
- Uses `gen.pick_chain_step`, interaction: `guided_selection`

**11f. Redox (2 templates):**
- `tmpl.rxn.identify_oxidizer.v1`, `tmpl.rxn.predict_substitution.v1`
- Uses `gen.pick_reaction{redox}` + `solver.slot_lookup`

**11g. Energy & catalysis (5 templates):**
- `tmpl.rxn.factors_rate.v1`, `tmpl.rxn.exo_endo.v1`, `tmpl.rxn.equilibrium_shift.v1`, `tmpl.rxn.catalyst_props.v1`, `tmpl.rxn.identify_catalyst.v1`
- Uses `gen.pick_energy_catalyst` with mode params

Each sub-batch: add prompts (4 locales) + templates + integration tests + build + commit.

Prompts needed (18 new across 4 locales):
- `prompt.predict_exchange_products`, `prompt.identify_driving_force`, `prompt.will_reaction_occur`
- `prompt.activity_series_compare`, `prompt.will_metal_react`
- `prompt.match_ionic_equation`, `prompt.identify_spectator_ions`
- `prompt.identify_reagent_for_ion`, `prompt.identify_ion_by_obs`
- `prompt.complete_chain_step`, `prompt.choose_reagent_for_step`
- `prompt.identify_oxidizer_reducer`, `prompt.predict_substitution`
- `prompt.factors_affecting_rate`, `prompt.exo_endo_classify`, `prompt.equilibrium_shift`, `prompt.catalyst_properties`, `prompt.identify_catalyst`

---

## Task 12: Calculations batch — 9 new templates + prompts

Templates: `tmpl.calc.molar_mass.v1` through `tmpl.calc.yield.v1` (9 total, see design doc section 5.6)

Prompts (9 new across 4 locales):
- `prompt.calc_molar_mass` — "Calculate the molar mass of {formula}."
- `prompt.calc_mass_fraction` — "Calculate the mass fraction of {element} in {formula}."
- `prompt.calc_amount` — "Calculate the amount of substance (mol) for {mass}g of {formula}."
- `prompt.calc_mass_from_moles` — "Calculate the mass of {amount} mol of {formula}."
- `prompt.calc_concentration` — "Calculate the mass fraction of the solution if {m_solute}g of solute is dissolved in {m_solution}g of solution."
- `prompt.calc_solute_mass` — "Calculate the mass of solute needed for {m_solution}g of {omega}% solution."
- `prompt.calc_dilution` — "How much solution is needed to dilute {m_solution}g of {omega}% solution to {omega_target}%?"
- `prompt.calc_by_equation` — "Calculate the mass of {find_formula} formed from {given_mass}g of {given_formula} by the equation: {equation}"
- `prompt.calc_yield` — "Calculate the practical yield of {find_formula} from {given_mass}g of {given_formula} at {yield_percent}% yield."

Follow pattern: prompts, templates, tests, build, commit.

---

## Task 13: Ions batch — 8 new templates + prompts

Templates: `tmpl.ion.formula_to_name.v1` through `tmpl.ion.classify_suffix.v1` (8 total, see design doc section 5.7)

Prompts (8 new across 4 locales):
- `prompt.ion_formula_to_name` — "What is the name of the ion {formula}?"
- `prompt.ion_name_to_formula` — "Write the formula of the ion {name}."
- `prompt.ion_suffix_rule` — "What suffix type does the ion {formula} use?"
- `prompt.acid_to_anion` — "What anion does {acid_name} form?"
- `prompt.anion_to_acid` — "Which acid forms the anion {anion_name}?"
- `prompt.ate_ite_pair` — "What is the partner ion of {formula} in the -ate/-ite pair?"
- `prompt.ox_state_to_suffix` — "Which suffix corresponds to oxidation state {state} for {element}?"
- `prompt.classify_suffix_type` — "Classify the suffix type of {formula}."

Follow pattern: prompts, templates, tests, build, commit.

---

## Task 14: GuidedSelectionExercise React component

**Files:**
- Create: `src/features/task-engine/components/GuidedSelectionExercise.tsx`
- Create: `src/features/task-engine/components/GuidedSelectionExercise.css`

### Step 1: Create component

```typescript
import { useState, useCallback } from 'react';
import './GuidedSelectionExercise.css';

interface GuidedSelectionProps {
  chain: string[];
  gapIndex: number;
  candidates: Array<{ id: string; formula: string; class?: string }>;
  selectionMode: 'quick' | 'filtered';
  filters?: string[];
  onSelect: (candidateId: string) => void;
}

export function GuidedSelectionExercise({
  chain, gapIndex, candidates, selectionMode, filters = [], onSelect,
}: GuidedSelectionProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCandidates = candidates.filter(c => {
    if (activeFilter && c.class !== activeFilter) return false;
    if (searchQuery && !c.formula.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleSelect = useCallback((id: string) => {
    setSheetOpen(false);
    onSelect(id);
  }, [onSelect]);

  return (
    <div className="guided-selection">
      {/* Chain visualization */}
      <div className="chain-row">
        {chain.map((substance, i) => (
          <div key={i} className="chain-item-wrapper">
            {i > 0 && <span className="chain-arrow">→</span>}
            {i === gapIndex ? (
              <button
                className="chain-gap"
                onClick={() => setSheetOpen(true)}
                aria-label="Select substance"
              >
                ?
              </button>
            ) : (
              <span className="chain-substance">{substance}</span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom sheet / selection panel */}
      {sheetOpen && (
        <div className="selection-sheet" role="dialog" aria-label="Select substance">
          <div className="sheet-handle" onClick={() => setSheetOpen(false)} />

          {selectionMode === 'filtered' && (
            <>
              <input
                className="sheet-search"
                type="text"
                placeholder="Поиск..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {filters.length > 0 && (
                <div className="sheet-filters">
                  <button
                    className={`filter-chip ${!activeFilter ? 'active' : ''}`}
                    onClick={() => setActiveFilter(null)}
                  >все</button>
                  {filters.map(f => (
                    <button
                      key={f}
                      className={`filter-chip ${activeFilter === f ? 'active' : ''}`}
                      onClick={() => setActiveFilter(f)}
                    >{f}</button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="sheet-candidates">
            {filteredCandidates.map(c => (
              <button
                key={c.id}
                className="candidate-btn"
                onClick={() => handleSelect(c.id)}
              >
                {c.formula}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 2: Add CSS

Create `GuidedSelectionExercise.css` with styles for chain-row, chain-gap, selection-sheet, bottom sheet behavior (70-80vh on mobile), touch targets ≥ 44px, filter chips.

### Step 3: Commit

```bash
git add src/features/task-engine/
git commit -m "feat(task-engine): add GuidedSelectionExercise React component

Chain visualization with gap, bottom sheet for substance selection,
quick and filtered modes, search, class filter chips."
```

---

## Task 15: Wire all 21 competencies in exercise-adapters.ts

**Files:**
- Modify: `src/features/competency/exercise-adapters.ts`
- Test: `src/lib/task-engine/__tests__/task-engine.test.ts`

### Step 1: Update ENGINE_COMPETENCY_MAP

Replace the current 9-entry map with the full 21-entry map from the design doc (section 6).

### Step 2: Update loadEngineAdapter() data loading

Add the additional data sources needed for Phase 3 templates:

```typescript
export async function loadEngineAdapter(competencyId: string, locale?: SupportedLocale): Promise<Adapter | null> {
  if (!ENGINE_COMPETENCY_MAP[competencyId]) return null;

  const [{ createTaskEngine }, dl] = await Promise.all([
    import('../../lib/task-engine'),
    import('../../lib/data-loader'),
  ]);

  const [elements, ions, properties, solubilityPairs, oxidationExamples,
         promptTemplates, morphology, templates, bondExamples, substanceIndex,
         reactions, activitySeries, classificationRules, namingRules,
         qualitativeTests, energyCatalystTheory, geneticChains,
         calculationsData, ionNomenclature] = await Promise.all([
    dl.loadElements(locale),
    dl.loadIons(locale),
    dl.loadProperties(),
    dl.loadSolubilityRules(),
    dl.loadOxidationExamples(),
    dl.loadPromptTemplates(locale ?? 'ru'),
    locale === 'ru' || !locale ? dl.loadMorphology() : Promise.resolve(null),
    dl.loadTaskTemplates(),
    dl.loadBondExamples(),
    dl.loadSubstancesIndex(locale),
    dl.loadReactions(),
    dl.loadActivitySeries().catch(() => []),
    dl.loadClassificationRules().catch(() => []),
    dl.loadNamingRules().catch(() => []),
    dl.loadQualitativeTests().catch(() => []),
    dl.loadEnergyCatalystTheory().catch(() => null),
    dl.loadGeneticChains().catch(() => []),
    dl.loadCalculationsData().catch(() => null),
    dl.loadIonNomenclature().catch(() => null),
  ]);

  const ontology: OntologyData = {
    core: { elements, ions, properties },
    rules: {
      solubilityPairs, oxidationExamples, bondExamples,
      activitySeries, classificationRules, namingRules,
      qualitativeTests, energyCatalyst: energyCatalystTheory,
      ionNomenclature,
    },
    data: {
      substances: substanceIndex, reactions, geneticChains,
      calculations: calculationsData ?? undefined,
    },
    i18n: { morphology, promptTemplates },
  };

  const engine = createTaskEngine(templates, ontology);

  return {
    generate: () => {
      const task = engine.generateForCompetency(competencyId);
      if (!task) throw new Error(`No engine template for competency: ${competencyId}`);
      return engine.toExercise(task);
    },
  };
}
```

### Step 3: Add competency routing tests

In `task-engine.test.ts`, add tests verifying that each of the 12 new competencies returns a template.

### Step 4: Run tests + build

Run: `npx vitest run && npm run build`
Expected: All tests pass, build produces correct page count.

### Step 5: Commit

```bash
git add src/features/competency/exercise-adapters.ts src/lib/task-engine/__tests__/task-engine.test.ts
git commit -m "feat(task-engine): wire all 21 competencies to engine templates

Expand ENGINE_COMPETENCY_MAP from 9 to 21 entries. Load all Phase 3
data sources (activitySeries, classificationRules, namingRules,
qualitativeTests, energyCatalyst, geneticChains, calculations,
ionNomenclature) in loadEngineAdapter."
```

---

## Task 16: Full verification

### Step 1: Run all tests

Run: `npx vitest run`
Expected: 250+ tests passing (147 existing + 100+ new).

### Step 2: Run full build

Run: `npm run build`
Expected: Build succeeds, 940 pages generated.

### Step 3: Spot checks

- Verify all 66 task templates load from JSON
- Verify all 21 generators registered
- Verify all 20 solvers registered
- Verify all 21 competencies in ENGINE_COMPETENCY_MAP
- Verify prompt templates count matches template count per locale

### Step 4: Final commit if needed

Tag as Phase 3 complete in commit message.

---

## Summary

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Task templates | 15 | 66 | +51 |
| Generators | 10 | 21 | +11 |
| Solvers | 7 | 20 | +13 |
| Interaction types | 5 | 7 | +2 |
| Prompt templates/locale | 15 | ~55 | +~40 |
| Competencies covered | 9 | 21 | +12 |
| Tests | 147 | ~250+ | +100+ |
| OntologyData | flat (10 fields) | grouped (4 sub-objects) | restructured |
| New React components | 0 | 1 (GuidedSelection) | +1 |
