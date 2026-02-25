# Phase 3: Full Migration — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Replace all 58 traditional exercise generators with engine templates, covering all 21 competencies. Add 4 new interaction types (choice_multi, match_pairs, interactive_orbital, guided_selection). Restructure OntologyData into grouped sub-objects. Establish foundation for guided selection UI (reaction chain constructor with Bottom Sheet).

**Architecture:** Infrastructure-first approach — restructure OntologyData, add all generators/solvers, then add templates in feature batches. Each batch is independently testable.

**Tech Stack:** TypeScript (strict), Vitest, React (for guided selection UI), Astro, existing CSS modules pattern.

---

## 1. OntologyData Restructure

### Current (flat, 18 fields)

```typescript
interface OntologyData {
  elements, ions, properties, solubilityPairs, oxidationExamples,
  morphology, promptTemplates,
  bondExamples?, substanceIndex?, reactions?
}
```

### New (grouped, 4 sub-objects)

```typescript
interface OntologyData {
  core: {
    elements: Element[];
    ions: Ion[];
    properties: PropertyDef[];
  };
  rules: {
    solubilityPairs: SolubilityPair[];
    oxidationExamples: OxidationExample[];
    bondExamples?: BondExamplesData;
    activitySeries?: ActivitySeriesEntry[];
    classificationRules?: ClassificationRule[];
    namingRules?: NamingRule[];
    qualitativeTests?: QualitativeTest[];
    energyCatalyst?: EnergyCatalystTheory;
    ionNomenclature?: IonNomenclatureRules;
  };
  data: {
    substances?: SubstanceIndexEntry[];
    reactions?: Reaction[];
    geneticChains?: GeneticChain[];
    calculations?: CalculationsData;
  };
  i18n: {
    morphology: MorphologyData | null;
    promptTemplates: PromptTemplateMap;
  };
}
```

**Migration:** Update all references in generators.ts, solvers.ts, distractor-engine.ts, task-engine.ts, exercise-adapters.ts, and all test files. Mechanical but touches ~15 files.

---

## 2. New Generators (11)

### Periodic Table
| Generator | Purpose | Data Source |
|-----------|---------|-------------|
| `gen.pick_element_for_config` | Element for electron config (Z ≤ 36) | core.elements |

### Substances
| Generator | Purpose | Data Source |
|-----------|---------|-------------|
| `gen.pick_classification_rule` | Pick class/subclass rule | rules.classificationRules |
| `gen.pick_naming_rule` | Pick naming pattern + example | rules.namingRules |

### Reactions
| Generator | Purpose | Data Source |
|-----------|---------|-------------|
| `gen.pick_activity_pair` | Two metals from activity series | rules.activitySeries |
| `gen.pick_qualitative_test` | Ion identification test | rules.qualitativeTests |
| `gen.pick_chain_step` | Step from genetic chain | data.geneticChains |
| `gen.pick_energy_catalyst` | Rate factor / equilibrium / catalyst | rules.energyCatalyst |

### Calculations
| Generator | Purpose | Data Source |
|-----------|---------|-------------|
| `gen.pick_calc_substance` | Substance for molar mass / composition | data.calculations.calc_substances |
| `gen.pick_calc_reaction` | Reaction for stoichiometry | data.calculations.calc_reactions |
| `gen.pick_solution_params` | Random m_solute, m_solution, ω values | Pure random (no data) |

### Ions
| Generator | Purpose | Data Source |
|-----------|---------|-------------|
| `gen.pick_ion_nomenclature` | Ion for naming exercises (suffix, acid-anion pair) | core.ions + rules.ionNomenclature |

---

## 3. New Solvers (13)

### Periodic Table
| Solver | Computation | Output |
|--------|-------------|--------|
| `solver.electron_config` | Build config string from Z (Klechkowski order) | `"1s² 2s² 2p⁶ 3s¹"` |
| `solver.count_valence` | Count valence electrons from group/config | integer |
| `solver.delta_chi` | Δχ = \|χ_A - χ_B\|, classify bond | bond type string |

### Reactions
| Solver | Computation | Output |
|--------|-------------|--------|
| `solver.driving_force` | Pattern-match products (↓, ↑, H₂O, weak electrolyte) | force label |
| `solver.activity_compare` | Compare positions in activity series | "yes"/"no" + explanation |
| `solver.ionic_spectators` | Extract spectator ions from full − net ionic | ion list |
| `solver.predict_observation` | Aggregate observation fields | observation text |

### Calculations
| Solver | Computation | Output |
|--------|-------------|--------|
| `solver.molar_mass` | Σ(Ar × count) from composition | number (g/mol) |
| `solver.mass_fraction` | (Ar × count / M) × 100 | number (%) |
| `solver.amount_calc` | n = m/M or m = n × M (param-driven) | number |
| `solver.concentration` | ω = m_solute/m_solution × 100 (or inverse) | number |
| `solver.stoichiometry` | n₁/coeff₁ = n₂/coeff₂ → find mass | number |
| `solver.reaction_yield` | m_practical = m_theoretical × yield/100 | number |

---

## 4. New Interaction Types

### 4.1 choice_multi

Same UI as choice_single but with checkboxes. Multiple correct answers.

**Evaluation:** `set_equivalence` mode — compare user's set to correct set, partial credit for subset.

**Use cases:** "Select all acids", "Which substances are electrolytes?", "Which factors speed up this reaction?"

**toExercise change:** Return `format: 'multiple_choice_multi'`, `correctIds: string[]` instead of `correctId: string`.

### 4.2 match_pairs

Two-column matching. Left column: items. Right column: matches. User draws connections.

**Evaluation:** Per-pair scoring with `partial_credit` mode.

**Use cases:** "Match ions to their qualitative reagents", "Match substances to their classes", "Match elements to their electron configs".

**toExercise change:** Return `format: 'match_pairs'`, `pairs: Array<{ left: string; right: string }>`, `shuffledRight: string[]`.

### 4.3 interactive_orbital

Orbital box filling. Shows empty orbital diagram, user fills electrons.

**Evaluation:** Compare filled orbital string to correct config.

**Use cases:** "Fill the orbital diagram for Fe" (existing exercise, now engine-powered).

**toExercise change:** Return `format: 'interactive_orbital'`, `targetZ: number`, `expectedConfig: string`.

### 4.4 guided_selection (foundation)

Chain/reaction context with guided substance selection.

**Template config:**
```json
"selection_mode": {
  "type": "guided",
  "filters": ["class", "group", "process"],
  "max_options": 8,
  "auto_prune_invalid": true
}
```

**UI:** React component with:
- Chain visualization: `[ CaCO₃ ] → [ ? ] → [ CO₂ ]`
- Bottom Sheet (mobile) / Popover (desktop) on tap
- Sections: Search, Class filter, Quick filters
- Touch targets ≥ 44px
- Visual indicators: ↓ (precipitate), ↑ (gas), ⚡ (redox), 💧 (neutralization)

**Three selection modes** (controlled by template difficulty):
1. **Quick mode (OGE):** 6-8 pre-filtered options
2. **Filtered mode (Adaptive):** User picks class → sees filtered list
3. **Pro mode (VSOSH):** Mini periodic table → element → oxidation state → auto-build formula

**Phase 3 scope:** Quick mode + Filtered mode. Pro mode deferred.

**Engine data flow:**
1. Generator picks chain + gap position
2. Solver computes valid answers + generates candidate pool
3. Template's `selection_mode` controls how candidates are presented
4. Distractor engine adds 2-3 plausible wrong candidates
5. UI renders chain + selection interface

**toExercise change:** Return `format: 'guided_selection'`, `context: { chain, gapIndex }`, `candidates: Array<{ formula, class, valid }>`, `selectionMode: SelectionModeConfig`.

---

## 5. Template Inventory (existing 15 + new 46 = 61 total)

### 5.1 Periodic Table (existing 3 + new 4 = 7)

| # | Template ID | Prompt | Generator | Solver | Interaction | Traditional |
|---|------------|--------|-----------|--------|-------------|------------|
| ✓ | tmpl.pt.compare_property.v1 | compare_property | pick_element_pair | compare_property | choice_single | compare_electronegativity |
| ✓ | tmpl.pt.order_by_property.v1 | order_by_property | pick_elements_same_period | periodic_trend_order | order_dragdrop | — |
| ✓ | tmpl.pt.find_period.v1 | find_period | pick_element_position | slot_lookup{period} | choice_single | find_period_group |
| ✓ | tmpl.pt.find_group.v1 | find_group | pick_element_position | slot_lookup{group} | choice_single | find_period_group |
| 16 | tmpl.pt.select_electron_config.v1 | select_electron_config | pick_element_for_config | electron_config | choice_single | select_electron_config |
| 17 | tmpl.pt.count_valence.v1 | count_valence | pick_element_position | count_valence | numeric_input | count_valence |
| 18 | tmpl.pt.element_from_config.v1 | element_from_config | pick_element_for_config | slot_lookup{element} | choice_single | element_from_config |
| 19 | tmpl.pt.fill_orbital.v1 | fill_orbital | pick_element_for_config | electron_config | interactive_orbital | fill_orbital_boxes |

### 5.2 Bonds (existing 4 + new 2 = 6)

| # | Template ID | Prompt | Generator | Solver | Interaction | Traditional |
|---|------------|--------|-----------|--------|-------------|------------|
| ✓ | tmpl.bond.identify_type.v1 | identify_bond_type | pick_bond_example | slot_lookup{bond_type} | choice_single | identify_bond_type |
| ✓ | tmpl.bond.identify_crystal.v1 | identify_crystal_type | pick_bond_example | slot_lookup{crystal_type} | choice_single | identify_crystal_structure |
| ✓ | tmpl.bond.compare_melting.v1 | compare_melting_points | pick_bond_pair | compare_crystal_melting | choice_single | compare_melting_points |
| ✓ | tmpl.bond.select_by_type.v1 | select_by_bond_type | pick_bond_example{type} | slot_lookup{formula} | choice_single | select_substance_by_bond |
| 20 | tmpl.bond.predict_property.v1 | predict_crystal_property | pick_bond_example | slot_lookup{crystal_property} | choice_single | predict_property_by_structure |
| 21 | tmpl.bond.delta_chi.v1 | bond_from_delta_chi | pick_element_pair | delta_chi | choice_single | bond_from_delta_chi |

### 5.3 Oxidation States (existing 2 + new 2 = 4)

| # | Template ID | Prompt | Generator | Solver | Interaction | Traditional |
|---|------------|--------|-----------|--------|-------------|------------|
| ✓ | tmpl.ox.determine_state.v1 | determine_oxidation_state | pick_oxidation_example | oxidation_states | numeric_input | determine_ox_state |
| ✓ | tmpl.ox.max_state.v1 | max_oxidation_state | pick_element_position | slot_lookup{max_ox} | choice_single | max_min_ox_state |
| 22 | tmpl.ox.select_by_state.v1 | select_compound_by_state | pick_oxidation_example | slot_lookup{formula} | choice_single | select_compound_by_ox_state |
| 23 | tmpl.ox.min_state.v1 | min_oxidation_state | pick_element_position | slot_lookup{min_ox} | choice_single | max_min_ox_state |

### 5.4 Substances (existing 2 + new 7 = 9)

| # | Template ID | Prompt | Generator | Solver | Interaction | Traditional |
|---|------------|--------|-----------|--------|-------------|------------|
| ✓ | tmpl.class.classify.v1 | classify_substance | pick_substance_by_class | slot_lookup{class} | choice_single | classify_by_formula |
| ✓ | tmpl.class.select_by_class.v1 | select_by_class | pick_substance_by_class{class} | slot_lookup{formula} | choice_single | — |
| 24 | tmpl.class.classify_subclass.v1 | classify_subclass | pick_substance_by_class | slot_lookup{subclass} | choice_single | classify_subclass |
| 25 | tmpl.class.identify_by_description.v1 | identify_class_by_desc | pick_classification_rule | slot_lookup{class_label} | choice_single | identify_class_by_description |
| 26 | tmpl.sub.formula_to_name.v1 | formula_to_name | pick_substance_by_class | slot_lookup{name} | choice_single | formula_to_name |
| 27 | tmpl.sub.name_to_formula.v1 | name_to_formula | pick_substance_by_class | slot_lookup{formula} | choice_single | name_to_formula |
| 28 | tmpl.sub.identify_amphoteric.v1 | identify_amphoteric | pick_substance_by_class{amphoteric} | slot_lookup{formula} | choice_single | identify_amphoteric |
| 29 | tmpl.sub.amphoteric_partner.v1 | amphoteric_reaction_partner | pick_substance_by_class{amphoteric} | static{"both"} | choice_single | amphoteric_reaction_partner |
| 30 | tmpl.sub.naming_rule.v1 | naming_rule_template | pick_naming_rule | slot_lookup{template} | choice_single | naming_rule_template |

### 5.5 Reactions (existing 2 + new 18 = 20)

| # | Template ID | Prompt | Generator | Solver | Interaction | Traditional |
|---|------------|--------|-----------|--------|-------------|------------|
| ✓ | tmpl.rxn.identify_type.v1 | identify_reaction_type | pick_reaction | slot_lookup{reaction_type} | choice_single | classify_reaction_type |
| ✓ | tmpl.sol.check_pair.v1 | solubility_of_salt | pick_salt_pair | solubility_check | choice_single | solubility_lookup |
| 31 | tmpl.rxn.predict_exchange.v1 | predict_exchange_products | pick_reaction{exchange} | slot_lookup{products} | choice_single | predict_exchange_products |
| 32 | tmpl.rxn.driving_force.v1 | identify_driving_force | pick_reaction | driving_force | choice_single | identify_driving_force |
| 33 | tmpl.rxn.will_occur.v1 | will_reaction_occur | pick_reaction | driving_force | choice_single | will_reaction_occur |
| 34 | tmpl.rxn.activity_compare.v1 | activity_series_compare | pick_activity_pair | activity_compare | choice_single | activity_series_compare |
| 35 | tmpl.rxn.will_metal_react.v1 | will_metal_react | pick_activity_pair | activity_compare | choice_single | will_metal_react |
| 36 | tmpl.rxn.match_ionic.v1 | match_ionic_equation | pick_reaction{ionic} | slot_lookup{net_ionic} | choice_single | match_ionic_equation |
| 37 | tmpl.rxn.spectator_ions.v1 | identify_spectator_ions | pick_reaction{ionic} | ionic_spectators | choice_single | identify_spectator_ions |
| 38 | tmpl.rxn.predict_observation.v1 | predict_observation | pick_reaction{obs} | predict_observation | choice_single | predict_observation |
| 39 | tmpl.rxn.identify_oxidizer.v1 | identify_oxidizer_reducer | pick_reaction{redox} | slot_lookup{oxidizer} | choice_single | identify_oxidizer_reducer |
| 40 | tmpl.rxn.predict_substitution.v1 | predict_substitution | pick_reaction{substitution} | slot_lookup{products} | choice_single | predict_substitution_products |
| 41 | tmpl.qual.identify_reagent.v1 | identify_reagent_for_ion | pick_qualitative_test | slot_lookup{reagent} | choice_single | identify_reagent_for_ion |
| 42 | tmpl.qual.identify_ion.v1 | identify_ion_by_obs | pick_qualitative_test | slot_lookup{target_ion} | choice_single | identify_ion_by_observation |
| 43 | tmpl.chain.complete_step.v1 | complete_chain_step | pick_chain_step | slot_lookup{next} | guided_selection | complete_chain_step |
| 44 | tmpl.chain.choose_reagent.v1 | choose_reagent_for_step | pick_chain_step | slot_lookup{reagent} | guided_selection | choose_reagent_for_step |
| 45 | tmpl.rxn.factors_rate.v1 | factors_affecting_rate | pick_energy_catalyst{rate} | slot_lookup{factor} | choice_single | factors_affecting_rate |
| 46 | tmpl.rxn.exo_endo.v1 | exo_endo_classify | pick_reaction | slot_lookup{heat_effect} | choice_single | exo_endo_classify |
| 47 | tmpl.rxn.equilibrium_shift.v1 | equilibrium_shift | pick_energy_catalyst{eq} | slot_lookup{direction} | choice_single | equilibrium_shift |
| 48 | tmpl.rxn.catalyst_props.v1 | catalyst_properties | pick_energy_catalyst{cat} | slot_lookup{property} | choice_single | catalyst_properties |
| 49 | tmpl.rxn.identify_catalyst.v1 | identify_catalyst | pick_energy_catalyst{cat} | slot_lookup{catalyst} | choice_single | identify_catalyst |

### 5.6 Calculations (new 9)

| # | Template ID | Prompt | Generator | Solver | Interaction | Traditional |
|---|------------|--------|-----------|--------|-------------|------------|
| 50 | tmpl.calc.molar_mass.v1 | calc_molar_mass | pick_calc_substance | molar_mass | choice_single | calc_molar_mass |
| 51 | tmpl.calc.mass_fraction.v1 | calc_mass_fraction | pick_calc_substance | mass_fraction | choice_single | calc_mass_fraction |
| 52 | tmpl.calc.amount.v1 | calc_amount | pick_calc_substance | amount_calc{n} | choice_single | calc_amount_of_substance |
| 53 | tmpl.calc.mass_from_moles.v1 | calc_mass_from_moles | pick_calc_substance | amount_calc{m} | choice_single | calc_mass_from_moles |
| 54 | tmpl.calc.concentration.v1 | calc_concentration | pick_solution_params | concentration | choice_single | calc_solution_concentration |
| 55 | tmpl.calc.solute_mass.v1 | calc_solute_mass | pick_solution_params | concentration{inverse} | choice_single | calc_solute_mass |
| 56 | tmpl.calc.dilution.v1 | calc_dilution | pick_solution_params | concentration{dilution} | choice_single | calc_dilution |
| 57 | tmpl.calc.by_equation.v1 | calc_by_equation | pick_calc_reaction | stoichiometry | choice_single | calc_by_equation |
| 58 | tmpl.calc.yield.v1 | calc_yield | pick_calc_reaction | reaction_yield | choice_single | calc_yield |

### 5.7 Ions (existing 1 + new 8 = 9)

| # | Template ID | Prompt | Generator | Solver | Interaction | Traditional |
|---|------------|--------|-----------|--------|-------------|------------|
| ✓ | tmpl.ion.compose_salt.v1 | compose_salt | pick_ion_pair | compose_salt_formula | choice_single | — |
| 59 | tmpl.ion.formula_to_name.v1 | ion_formula_to_name | pick_ion_nomenclature | slot_lookup{name} | choice_single | formula_to_name |
| 60 | tmpl.ion.name_to_formula.v1 | ion_name_to_formula | pick_ion_nomenclature | slot_lookup{formula} | choice_single | name_to_formula |
| 61 | tmpl.ion.suffix_rule.v1 | ion_suffix_rule | pick_ion_nomenclature | slot_lookup{suffix_type} | choice_single | suffix_rule |
| 62 | tmpl.ion.acid_to_anion.v1 | acid_to_anion | pick_ion_nomenclature{acid_pair} | slot_lookup{anion_name} | choice_single | acid_to_anion |
| 63 | tmpl.ion.anion_to_acid.v1 | anion_to_acid | pick_ion_nomenclature{acid_pair} | slot_lookup{acid_name} | choice_single | anion_to_acid |
| 64 | tmpl.ion.ate_ite_pair.v1 | ate_ite_pair | pick_ion_nomenclature{paired} | slot_lookup{pair_name} | choice_single | ate_ite_pair |
| 65 | tmpl.ion.ox_to_suffix.v1 | ox_state_to_suffix | pick_ion_nomenclature | slot_lookup{suffix} | choice_single | oxidation_state_to_suffix |
| 66 | tmpl.ion.classify_suffix.v1 | classify_suffix_type | pick_ion_nomenclature | slot_lookup{suffix_label} | choice_single | classify_suffix_type |

---

## 6. Competency Wiring (all 21)

### Current ENGINE_COMPETENCY_MAP (9 entries)

```
periodic_trends, periodic_table, oxidation_states, naming,
gas_precipitate_logic, bond_type, crystal_structure_type,
classification, reactions_exchange
```

### Phase 3 additions (12 entries)

```typescript
const ENGINE_COMPETENCY_MAP: Record<string, string[]> = {
  // Phase 1-2 (existing)
  periodic_trends: ['tmpl.pt.compare_property.v1', 'tmpl.pt.order_by_property.v1'],
  periodic_table: ['tmpl.pt.compare_property.v1', 'tmpl.pt.order_by_property.v1',
                    'tmpl.pt.find_period.v1', 'tmpl.pt.find_group.v1',
                    'tmpl.pt.select_electron_config.v1', 'tmpl.pt.count_valence.v1',
                    'tmpl.pt.element_from_config.v1'],
  oxidation_states: ['tmpl.ox.determine_state.v1', 'tmpl.ox.max_state.v1',
                      'tmpl.ox.select_by_state.v1', 'tmpl.ox.min_state.v1'],
  naming: ['tmpl.ion.compose_salt.v1', 'tmpl.sub.formula_to_name.v1',
           'tmpl.sub.name_to_formula.v1', 'tmpl.sub.naming_rule.v1'],
  gas_precipitate_logic: ['tmpl.sol.check_pair.v1', 'tmpl.rxn.driving_force.v1',
                           'tmpl.rxn.will_occur.v1'],
  bond_type: ['tmpl.bond.identify_type.v1', 'tmpl.bond.select_by_type.v1',
              'tmpl.bond.delta_chi.v1'],
  crystal_structure_type: ['tmpl.bond.identify_crystal.v1', 'tmpl.bond.compare_melting.v1',
                            'tmpl.bond.predict_property.v1'],
  classification: ['tmpl.class.classify.v1', 'tmpl.class.select_by_class.v1',
                    'tmpl.class.classify_subclass.v1', 'tmpl.class.identify_by_description.v1'],
  reactions_exchange: ['tmpl.rxn.identify_type.v1', 'tmpl.rxn.predict_exchange.v1'],

  // Phase 3 (new)
  electron_config: ['tmpl.pt.select_electron_config.v1', 'tmpl.pt.count_valence.v1',
                     'tmpl.pt.element_from_config.v1', 'tmpl.pt.fill_orbital.v1'],
  amphoterism_logic: ['tmpl.sub.identify_amphoteric.v1', 'tmpl.sub.amphoteric_partner.v1'],
  reactions_redox: ['tmpl.rxn.identify_oxidizer.v1', 'tmpl.rxn.predict_substitution.v1'],
  genetic_chain_logic: ['tmpl.chain.complete_step.v1', 'tmpl.chain.choose_reagent.v1'],
  qualitative_analysis_logic: ['tmpl.qual.identify_reagent.v1', 'tmpl.qual.identify_ion.v1'],
  electrolyte_logic: ['tmpl.rxn.match_ionic.v1', 'tmpl.rxn.spectator_ions.v1'],
  reaction_energy_profile: ['tmpl.rxn.factors_rate.v1', 'tmpl.rxn.exo_endo.v1',
                             'tmpl.rxn.equilibrium_shift.v1'],
  catalyst_role_understanding: ['tmpl.rxn.catalyst_props.v1', 'tmpl.rxn.identify_catalyst.v1'],
  calculations_basic: ['tmpl.calc.molar_mass.v1', 'tmpl.calc.mass_fraction.v1',
                        'tmpl.calc.amount.v1', 'tmpl.calc.mass_from_moles.v1'],
  calculations_solutions: ['tmpl.calc.concentration.v1', 'tmpl.calc.solute_mass.v1',
                            'tmpl.calc.dilution.v1'],
  reaction_yield_logic: ['tmpl.calc.by_equation.v1', 'tmpl.calc.yield.v1'],
  ion_nomenclature: ['tmpl.ion.formula_to_name.v1', 'tmpl.ion.name_to_formula.v1',
                      'tmpl.ion.suffix_rule.v1', 'tmpl.ion.acid_to_anion.v1',
                      'tmpl.ion.anion_to_acid.v1', 'tmpl.ion.ate_ite_pair.v1',
                      'tmpl.ion.ox_to_suffix.v1', 'tmpl.ion.classify_suffix.v1'],
};
```

---

## 7. Guided Selection UI Component

### Component: `GuidedSelectionExercise`

**Location:** `src/features/task-engine/components/GuidedSelectionExercise.tsx`

### Props
```typescript
interface GuidedSelectionProps {
  chain: Array<{ substance: string; isGap: boolean }>;
  candidates: Array<{
    formula: string;
    class: string;
    valid: boolean;
  }>;
  selectionMode: {
    type: 'quick' | 'filtered';
    filters: ('class' | 'group' | 'process')[];
    maxOptions: number;
  };
  onSelect: (formula: string) => void;
}
```

### Layout
```
┌──────────────────────────────────┐
│  Chain Visualization             │
│  [ CaCO₃ ] → [ ? ] → [ CO₂ ]  │
│                  ↑               │
│              tap to select       │
├──────────────────────────────────┤
│  Bottom Sheet (on tap)           │
│  ┌────────────────────────────┐  │
│  │ 🔎 Поиск                  │  │
│  ├────────────────────────────┤  │
│  │ Класс: [все] [кислоты]    │  │
│  │        [основания] [соли]  │  │
│  ├────────────────────────────┤  │
│  │ HCl        H₂SO₄          │  │
│  │ NaOH ⚡    KNO₃            │  │
│  │ HNO₃       CO₂ ↑          │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

### Visual Indicators
- ↓ — precipitate (осадок)
- ↑ — gas (газ)
- ⚡ — redox (ОВР)
- 💧 — neutralization (нейтрализация)

### Mobile UX
- Bottom Sheet: 70-80% screen height, swipe to close
- Touch targets ≥ 44px
- Filter chips horizontally scrollable

---

## 8. Distractor Engine Extensions

### New strategies needed:

1. **Calculation distractors:** Multiplier-based (×0.8, ×0.9, ×1.1, ×1.2, ×0.5, ×1.5) — same as traditional generators
2. **Electron config distractors:** Configs of adjacent Z elements
3. **Activity series distractors:** "no"/"only with heating"/"only with catalyst" for metal displacement
4. **Observation distractors:** Observations from other reactions
5. **Chain distractors:** Other substances from the chain pool

Most of these can extend the existing strategies (domain enum for activity/observation, numeric for calculations).

---

## 9. Implementation Structure

| Step | What | Files | Tests |
|------|------|-------|-------|
| 1 | Restructure OntologyData | types.ts + ~15 refs | Update all test files |
| 2 | Add 11 generators | generators.ts | ~30 new tests |
| 3 | Add 13 solvers | solvers.ts | ~35 new tests |
| 4 | Extend toExercise() for new interaction types | task-engine.ts | ~15 new tests |
| 5 | Extend distractor engine | distractor-engine.ts | ~15 new tests |
| 6 | PT batch: 4 templates + prompts | data JSON files | Integration tests |
| 7 | Bonds batch: 2 templates + prompts | data JSON files | Integration tests |
| 8 | Ox-states batch: 2 templates + prompts | data JSON files | Integration tests |
| 9 | Substances batch: 7 templates + prompts | data JSON files | Integration tests |
| 10 | Reactions batch: 18 templates + prompts | data JSON files | Integration tests |
| 11 | Calculations batch: 9 templates + prompts | data JSON files | Integration tests |
| 12 | Ions batch: 8 templates + prompts | data JSON files | Integration tests |
| 13 | GuidedSelectionExercise React component | New .tsx + .css | Component tests |
| 14 | Wire all 21 competencies | exercise-adapters.ts | E2E verify |
| 15 | Full verification: all tests + build | — | ~250+ tests |

---

## 10. Numeric Summary

| Metric | Phase 2 (current) | Phase 3 (target) | Delta |
|--------|-------------------|-------------------|-------|
| Task templates | 15 | 66 | +51 |
| Generators | 10 | 21 | +11 |
| Solvers | 7 | 20 | +13 |
| Interaction types | 3 | 7 | +4 |
| Prompt templates/locale | 15 | ~55 | +~40 |
| Competencies covered | 9 | 21 | +12 |
| Traditional generators replaced | 0 | 58 | +58 |
| Tests | 147 | ~250+ | +100+ |
| OntologyData fields | 10 flat | 4 grouped | restructured |
| New React components | 0 | 1 (GuidedSelection) | +1 |
