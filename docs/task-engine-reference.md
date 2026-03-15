# Task Engine Reference

Current-state reference for the generative task engine in "Chemistry Without Magic".

---

## 1. Architecture Overview

The task engine generates practice exercises from JSON templates at runtime. It replaces hardcoded exercise generators with a data-driven pipeline.

### Three-layer model

| Layer | Description | Stored in |
|-------|-------------|-----------|
| **Level A** | Language-neutral facts: template IDs, pipeline steps, evaluation mode, difficulty band, competency hints | `data-src/engine/task_templates.json` (65 templates) |
| **Level B** | Localized prompt text with `{slot}` placeholders, slot resolution directives (lookup, morph, enum maps) | `data-src/engine/prompt_templates.{locale}.json` (4 locales: ru, en, pl, es) |
| **Level C** | Exam overlays: `exam_tags` on templates, pinned instances with fixed slots and source provenance | `data-src/engine/pinned_instances.json`, `exam_tags` field on templates |

### Pipeline per task

```
Template
  -> Generator (fill slots from ontology data)
  -> Solver(s) (compute correct answer from slots)
  -> Prompt Renderer (render localized question text)
  -> Distractor Engine (generate plausible wrong options)
  -> Evaluator (check user answer)
  -> Exercise (UI-ready object with shuffled options)
```

### Key files

| File | Purpose |
|------|---------|
| `src/lib/task-engine/task-engine.ts` | `createTaskEngine()` factory; `executeTemplate()` and `executePinnedTemplate()` orchestration |
| `src/lib/task-engine/generators.ts` | 23 generator functions, `runGenerator()` dispatch |
| `src/lib/task-engine/solvers.ts` | 21 solver functions, `runSolver()` dispatch |
| `src/lib/task-engine/prompt-renderer.ts` | `renderPrompt()` and `renderToRichText()` |
| `src/lib/task-engine/slot-resolver.ts` | `resolveSlots()` with `lookup:` and `morph:` directives |
| `src/lib/task-engine/distractor-engine.ts` | `generateDistractors()` with 18 strategy branches |
| `src/lib/task-engine/evaluator.ts` | `evaluate()` with 4 modes: exact, tolerance, partial_credit, set_equivalence |
| `src/lib/task-engine/template-registry.ts` | `createRegistry()` -- index by ID, exam tag, competency |
| `src/lib/task-engine/types.ts` | All type definitions: `TaskTemplate`, `OntologyData`, `GeneratedTask`, etc. |
| `src/lib/task-engine/index.ts` | Public API re-exports |
| `src/features/competency/exercise-adapters.ts` | `ENGINE_COMPETENCY_MAP`, `buildEngine()`, `loadEngineAdapter()` |

### OntologyData bundle

The engine receives an `OntologyData` object assembled at load time with four sub-bundles:

```typescript
interface OntologyData {
  core:  { elements, ions, properties }
  rules: { solubilityPairs, oxidationExamples, bondExamples, activitySeries,
           classificationRules, namingRules, qualitativeTests, energyCatalyst,
           ionNomenclature, acidBaseRelations, kineticsRules, kineticsDirectionLabels }
  data:  { substances, reactions, geneticChains, calculations, foundations,
           reactionParticipants }
  i18n:  { morphology, promptTemplates, labels }
}
```

### Pinned instances

Pinned instances (`PinnedInstance`) fix slot values for reproducible exam questions. They link to a template via `template_id`, override slots via `slot_overrides`, and can lock distractors via `locked_distractors`. Each carries a `source_ref` with exam provenance (exam system, year, variant, task number).

---

## 2. Template Catalog

65 templates in `data-src/engine/task_templates.json`.

### Periodic Table & Electron Config (11 templates)

| Template ID | Generator | Solver | Interaction | Answer Kind | Competency (P=primary) |
|---|---|---|---|---|---|
| `tmpl.pt.compare_property.v1` | `gen.pick_element_pair` | `solver.compare_property` | choice_single | scalar_text | periodic_trends(P), periodic_table(S) |
| `tmpl.pt.order_by_property.v1` | `gen.pick_elements_same_period` | `solver.periodic_trend_order` | order_dragdrop | ordered_sequence | periodic_trends(P), periodic_table(S) |
| `tmpl.pt.find_period.v1` | `gen.pick_element_position` | `solver.slot_lookup` (period) | choice_single | enum_single | periodic_table(P) |
| `tmpl.pt.find_group.v1` | `gen.pick_element_position` | `solver.slot_lookup` (group) | choice_single | enum_single | periodic_table(P) |
| `tmpl.pt.select_electron_config.v1` | `gen.pick_element_for_config` | `solver.electron_config` | choice_single | scalar_text | electron_config(P), periodic_table(S) |
| `tmpl.pt.count_valence.v1` | `gen.pick_element_position` | `solver.count_valence` | numeric_input | scalar_number | electron_config(P), periodic_table(S) |
| `tmpl.pt.element_from_config.v1` | `gen.pick_element_for_config` | `solver.slot_lookup` (element) | choice_single | enum_single | electron_config(P), periodic_table(S) |
| `tmpl.pt.fill_orbital.v1` | `gen.pick_element_for_config` | `solver.electron_config` | interactive_orbital | interactive_state | electron_config(P) |
| `tmpl.bond.delta_chi.v1` | `gen.pick_element_pair` | `solver.delta_chi` | choice_single | enum_single | bond_type(P), periodic_trends(S) |
| `tmpl.bond.predict_property.v1` | `gen.pick_bond_example` | `solver.slot_lookup` (crystal_type) | choice_single | enum_single | crystal_structure_type(P), bond_type(S) |
| `tmpl.bond.compare_melting.v1` | `gen.pick_bond_pair` | `solver.compare_crystal_melting` | choice_single | scalar_text | crystal_structure_type(P), bond_type(S) |

### Oxidation States (4 templates)

| Template ID | Generator | Solver | Interaction | Answer Kind | Competency |
|---|---|---|---|---|---|
| `tmpl.ox.determine_state.v1` | `gen.pick_oxidation_example` | `solver.oxidation_states` | numeric_input | scalar_number | oxidation_states(P) |
| `tmpl.ox.max_state.v1` | `gen.pick_element_position` | `solver.slot_lookup` (max_oxidation_state) | choice_single | enum_single | oxidation_states(P) |
| `tmpl.ox.min_state.v1` | `gen.pick_element_position` | `solver.slot_lookup` (min_oxidation_state) | choice_single | enum_single | oxidation_states(P) |
| `tmpl.ox.select_by_state.v1` | `gen.pick_oxidation_example` | `solver.slot_lookup` (formula) | choice_single | scalar_text | oxidation_states(P) |

### Bonds & Crystal Structure (4 templates)

| Template ID | Generator | Solver | Interaction | Answer Kind | Competency |
|---|---|---|---|---|---|
| `tmpl.bond.identify_type.v1` | `gen.pick_bond_example` | `solver.slot_lookup` (bond_type) | choice_single | enum_single | bond_type(P) |
| `tmpl.bond.identify_crystal.v1` | `gen.pick_bond_example` | `solver.slot_lookup` (crystal_type) | choice_single | enum_single | crystal_structure_type(P) |
| `tmpl.bond.select_by_type.v1` | `gen.pick_bond_example` | `solver.slot_lookup` (formula) | choice_single | scalar_text | bond_type(P) |
| `tmpl.bond.compare_melting.v1` | (listed above) | | | | |

### Classification & Naming (10 templates)

| Template ID | Generator | Solver | Interaction | Answer Kind | Competency |
|---|---|---|---|---|---|
| `tmpl.class.classify.v1` | `gen.pick_substance_by_class` | `solver.slot_lookup` (substance_class) | choice_single | enum_single | classification(P) |
| `tmpl.class.select_by_class.v1` | `gen.pick_substance_by_class` | `solver.slot_lookup` (formula) | choice_single | scalar_text | classification(P) |
| `tmpl.class.classify_subclass.v1` | `gen.pick_substance_by_class` | `solver.slot_lookup` (substance_subclass) | choice_single | scalar_text | classification(P) |
| `tmpl.class.identify_by_description.v1` | `gen.pick_classification_rule` | `solver.slot_lookup` (class_label) | choice_single | scalar_text | classification(P) |
| `tmpl.sub.formula_to_name.v1` | `gen.pick_substance_by_class` | `solver.slot_lookup` (name) | choice_single | scalar_text | naming(P), classification(S) |
| `tmpl.sub.name_to_formula.v1` | `gen.pick_substance_by_class` | `solver.slot_lookup` (formula) | choice_single | scalar_text | naming(P), classification(S) |
| `tmpl.sub.naming_rule.v1` | `gen.pick_naming_rule` | `solver.slot_lookup` (template) | choice_single | scalar_text | naming(P) |
| `tmpl.sub.identify_amphoteric.v1` | `gen.pick_substance_by_class` (amphoteric) | `solver.slot_lookup` (formula) | choice_single | scalar_text | amphoterism_logic(P), classification(S) |
| `tmpl.sub.amphoteric_partner.v1` | `gen.pick_substance_by_class` (amphoteric) | `solver.slot_lookup` (reaction_partners) | choice_multi | enum_multi | amphoterism_logic(P) |
| `tmpl.ion.compose_salt.v1` | `gen.pick_ion_pair` | `solver.compose_salt_formula` | choice_single | scalar_text | naming(P), classification(S) |

### Ion Nomenclature (9 templates)

| Template ID | Generator | Solver | Interaction | Answer Kind | Competency |
|---|---|---|---|---|---|
| `tmpl.ion.formula_to_name.v1` | `gen.pick_ion_nomenclature` (paired) | `solver.slot_lookup` (ionA_name) | choice_single | scalar_text | naming(P) |
| `tmpl.ion.name_to_formula.v1` | `gen.pick_ion_nomenclature` (paired) | `solver.slot_lookup` (ionA_formula) | choice_single | scalar_text | naming(P) |
| `tmpl.ion.suffix_rule.v1` | `gen.pick_ion_nomenclature` (paired) | `solver.slot_lookup` (ionA_suffix) | choice_single | enum_single | naming(P) |
| `tmpl.ion.acid_to_anion.v1` | `gen.pick_ion_nomenclature` (acid_pair) | `solver.slot_lookup` (anion_name) | choice_single | scalar_text | naming(P), classification(S) |
| `tmpl.ion.anion_to_acid.v1` | `gen.pick_ion_nomenclature` (acid_pair) | `solver.slot_lookup` (acid_name) | choice_single | scalar_text | naming(P), classification(S) |
| `tmpl.ion.acid_residue_graph.v1` | `gen.pick_acid_anion_from_graph` | `solver.slot_lookup` (anion_formula) | choice_single | scalar_text | naming(P) |
| `tmpl.ion.ate_ite_pair.v1` | `gen.pick_ion_nomenclature` (paired) | `solver.slot_lookup` (ionB_suffix) | choice_single | enum_single | naming(P) |
| `tmpl.ion.ox_state_to_suffix.v1` | `gen.pick_ion_nomenclature` (default) | `solver.slot_lookup` (suffix) | choice_single | enum_single | naming(P) |
| `tmpl.ion.classify_suffix_type.v1` | `gen.pick_ion_nomenclature` (default) | `solver.slot_lookup` (condition) | choice_single | enum_single | naming(P) |

### Reactions (13 templates)

| Template ID | Generator | Solver | Interaction | Answer Kind | Competency |
|---|---|---|---|---|---|
| `tmpl.rxn.identify_type.v1` | `gen.pick_reaction` | `solver.slot_lookup` (reaction_type) | choice_single | enum_single | reactions_exchange(P) |
| `tmpl.rxn.predict_exchange.v1` | `gen.pick_reaction` (exchange) | `solver.slot_lookup` (equation) | choice_single | scalar_text | reactions_exchange(P) |
| `tmpl.rxn.driving_force.v1` | `gen.pick_reaction` (exchange) | `solver.driving_force` | choice_single | enum_single | reactions_exchange(P), gas_precipitate_logic(S) |
| `tmpl.rxn.will_occur.v1` | `gen.pick_reaction` | `solver.slot_lookup` (will_occur) | choice_single | enum_single | reactions_exchange(P), gas_precipitate_logic(S) |
| `tmpl.rxn.activity_compare.v1` | `gen.pick_activity_pair` | `solver.activity_compare` | choice_single | enum_single | activity_series_logic(P) |
| `tmpl.rxn.will_metal_react.v1` | `gen.pick_activity_pair` | `solver.slot_lookup` (reduces_H_A) | choice_single | enum_single | activity_series_logic(P) |
| `tmpl.rxn.predict_substitution.v1` | `gen.pick_reaction` (substitution) | `solver.slot_lookup` (equation) | choice_single | scalar_text | activity_series_logic(P), reactions_exchange(S) |
| `tmpl.rxn.match_ionic.v1` | `gen.pick_reaction` | `solver.slot_lookup` (net_ionic) | match_pairs | pair_mapping | ionic_spectators_logic(P) |
| `tmpl.rxn.spectator_ions.v1` | `gen.pick_reaction` | `solver.slot_lookup` (spectator_ions) | choice_single | scalar_text | ionic_spectators_logic(P) |
| `tmpl.rxn.identify_oxidizer.v1` | `gen.pick_reaction` (redox) | `solver.slot_lookup` (oxidizer) | choice_single | scalar_text | reactions_redox(P) |
| `tmpl.sol.check_pair.v1` | `gen.pick_salt_pair` | `solver.solubility_check` | choice_single | enum_single | gas_precipitate_logic(P) |
| `tmpl.chain.complete_step.v1` | `gen.pick_chain_step` | `solver.slot_lookup` (next) | guided_selection | scalar_text | genetic_chain_logic(P) |
| `tmpl.chain.choose_reagent.v1` | `gen.pick_chain_step` | `solver.slot_lookup` (reagent) | choice_single | scalar_text | genetic_chain_logic(P) |

### Qualitative Analysis (2 templates)

| Template ID | Generator | Solver | Interaction | Answer Kind | Competency |
|---|---|---|---|---|---|
| `tmpl.qual.identify_reagent.v1` | `gen.pick_qualitative_test` | `solver.slot_lookup` (reagent_formula) | choice_single | scalar_text | qualitative_reactions(P) |
| `tmpl.qual.identify_ion.v1` | `gen.pick_qualitative_test` | `solver.slot_lookup` (target_name) | choice_single | scalar_text | qualitative_reactions(P) |

### Energy, Kinetics & Catalysis (6 templates)

| Template ID | Generator | Solver | Interaction | Answer Kind | Competency |
|---|---|---|---|---|---|
| `tmpl.rxn.factors_rate.v1` | `gen.pick_energy_catalyst` (rate) | `solver.slot_lookup` (factor_name) | choice_single | enum_single | reaction_rate_factors(P) |
| `tmpl.rxn.exo_endo.v1` | `gen.pick_reaction` | `solver.slot_lookup` (heat_effect) | choice_single | enum_single | reaction_rate_factors(P) |
| `tmpl.rxn.equilibrium_shift.v1` | `gen.pick_energy_catalyst` (eq) | `solver.slot_lookup` (eq_shift) | choice_single | enum_single | equilibrium_shift(P) |
| `tmpl.rxn.catalyst_props.v1` | `gen.pick_energy_catalyst` (cat) | `solver.slot_lookup` (catalyst_name) | choice_single | enum_single | catalysis_concept(P) |
| `tmpl.rxn.identify_catalyst.v1` | `gen.pick_energy_catalyst` (cat) | `solver.slot_lookup` (catalyst) | choice_single | enum_single | catalysis_concept(P) |
| `tmpl.kinetics.directional.v1` | `gen.pick_kinetics_directional` | `solver.slot_lookup` (direction_label) | choice_single | enum_single | reaction_energy_profile(P) |

### Calculations (10 templates)

| Template ID | Generator | Solver | Interaction | Answer Kind | Competency |
|---|---|---|---|---|---|
| `tmpl.calc.molar_mass.v1` | `gen.pick_calc_substance` | `solver.molar_mass` | numeric_input | scalar_number | calculations_basic(P) |
| `tmpl.calc.mass_fraction.v1` | `gen.pick_calc_substance` | `solver.mass_fraction` | numeric_input | scalar_number | calculations_basic(P) |
| `tmpl.calc.amount.v1` | `gen.pick_calc_substance` | `solver.amount_calc` (mode=n) | numeric_input | scalar_number | calculations_basic(P) |
| `tmpl.calc.mass_from_moles.v1` | `gen.pick_calc_substance` | `solver.amount_calc` (mode=m) | numeric_input | scalar_number | calculations_basic(P) |
| `tmpl.calc.heat_of_reaction.v1` | `gen.pick_thermo_reaction` | `solver.heat_of_reaction` | numeric_input | scalar_number | calculations_basic(P) |
| `tmpl.calc.concentration.v1` | `gen.pick_solution_params` | `solver.concentration` (mode=omega) | numeric_input | scalar_number | calculations_solutions(P) |
| `tmpl.calc.solute_mass.v1` | `gen.pick_solution_params` | `solver.concentration` (mode=inverse) | numeric_input | scalar_number | calculations_solutions(P) |
| `tmpl.calc.dilution.v1` | `gen.pick_solution_params` | `solver.concentration` (mode=dilution) | numeric_input | scalar_number | calculations_solutions(P) |
| `tmpl.calc.by_equation.v1` | `gen.pick_calc_reaction` | `solver.stoichiometry` | numeric_input | scalar_number | reaction_yield_logic(P) |
| `tmpl.calc.yield.v1` | `gen.pick_calc_reaction` | `solver.reaction_yield` | numeric_input | scalar_number | reaction_yield_logic(P) |

---

## 3. Generator Catalog

23 generators in `src/lib/task-engine/generators.ts`. Each receives `(params, ontologyData)` and returns `SlotValues`.

| Generator ID | Description | Key Slots Produced | Data Dependencies |
|---|---|---|---|
| `gen.pick_element_pair` | Picks 2 elements with a shared property field; supports `main_group` filter and property-level filters | `elementA`, `elementB`, `property` | `core.elements`, `core.properties` |
| `gen.pick_elements_same_period` | Picks k elements from the same period with values for a given property; random ascending/descending order | `elements`, `element_symbols`, `property`, `order` | `core.elements`, `core.properties` |
| `gen.pick_oxidation_example` | Picks a random oxidation example; optional difficulty filter | `formula`, `element`, `expected_state` | `rules.oxidationExamples` |
| `gen.pick_ion_pair` | Picks a random cation/anion pair; supports charge range filters | `cation`, `anion`, `cation_id`, `anion_id`, `cation_charge`, `anion_charge` | `core.ions` |
| `gen.pick_salt_pair` | Picks a random solubility table entry | `salt_formula`, `cation_id`, `anion_id`, `expected_solubility` | `rules.solubilityPairs`, `core.ions` |
| `gen.pick_bond_example` | Picks a random bond example; optional bond_type filter | `formula`, `bond_type`, `crystal_type` | `rules.bondExamples` |
| `gen.pick_bond_pair` | Picks 2 bond examples with different crystal types | `formulaA`, `formulaB`, `crystal_typeA`, `crystal_typeB` | `rules.bondExamples` |
| `gen.pick_substance_by_class` | Picks a random substance; optional class filter and amphoteric filter | `formula`, `name`, `substance_class`, `substance_subclass` | `data.substances`, `core.elements` |
| `gen.pick_reaction` | Picks a random reaction; optional type_tag filter; extracts driving forces, ionic, redox data | `equation`, `reaction_type`, `reaction_id`, `reactants`, `heat_effect`, `has_precipitate`, `has_gas`, `has_water`, `will_occur`, `oxidizer`, `reducer` | `data.reactions` |
| `gen.pick_element_position` | Picks a random element from periods 1-6 (excluding lanthanides/actinides) | `element`, `period`, `group`, `max_oxidation_state`, `min_oxidation_state` | `core.elements` |
| `gen.pick_element_for_config` | Picks an element with Z <= 36; computes electron config string | `element`, `Z`, `period`, `group`, `config` | `core.elements` |
| `gen.pick_classification_rule` | Picks a random classification rule | `rule_id`, `class_label`, `subclass`, `pattern`, `description`, `examples` | `rules.classificationRules` |
| `gen.pick_naming_rule` | Picks a random naming rule with an example | `rule_id`, `class_label`, `pattern`, `template`, `example_formula`, `example_name` | `rules.namingRules` |
| `gen.pick_activity_pair` | Picks 2 metals from the activity series | `metalA`, `metalB`, `positionA`, `positionB`, `more_active`, `reduces_H_A`, `reduces_H_B` | `rules.activitySeries` |
| `gen.pick_qualitative_test` | Picks a random qualitative test | `target_id`, `target_name`, `reagent_formula`, `reagent_name`, `observation` | `rules.qualitativeTests` |
| `gen.pick_chain_step` | Picks a random genetic chain step; builds chain-with-gap structure | `chain_id`, `substance`, `reagent`, `next`, `gap_index`, `chain_substances` | `data.geneticChains` |
| `gen.pick_energy_catalyst` | Picks rate factor, catalyst, or equilibrium shift based on mode param | mode=rate: `factor_id`, `factor_name`, `factor_effect`; mode=cat: `catalyst`, `catalyst_name`; mode=eq: `eq_factor`, `eq_shift` | `rules.energyCatalyst` |
| `gen.pick_calc_substance` | Picks a calculation substance; generates random mass; computes amount | `formula`, `name`, `M`, `mass`, `amount`, `element`, `composition` | `data.calculations` |
| `gen.pick_calc_reaction` | Picks a calculation reaction; generates given mass and computes stoichiometric result + yield | `equation`, `given_formula`, `given_M`, `given_mass`, `find_formula`, `find_M`, `find_mass`, `yield_percent` | `data.calculations` |
| `gen.pick_thermo_reaction` | Picks a reaction with thermodynamic data (delta_H) | `equation`, `delta_H`, `calcReaction` | `data.calculations` |
| `gen.pick_solution_params` | Generates random solution parameters (solute mass, solution mass, omega, dilution target) | `m_solute`, `m_solution`, `omega`, `omega_target`, `omega1`, `m1`, `omega2` | None (pure random) |
| `gen.pick_ion_nomenclature` | Picks ion naming data in 3 modes: default (suffix rule), acid_pair (acid-anion pair), paired (two ions) | Varies by mode: `suffix`, `condition`, `acid_formula`, `anion_formula`, `ionA_formula`, etc. | `rules.ionNomenclature`, `core.ions` |
| `gen.pick_acid_anion_from_graph` | Follows `has_conjugate_base` chains in the acid-base relations graph to find terminal acid-anion pairs | `acid_id`, `acid_formula`, `acid_name`, `anion_id`, `anion_formula`, `anion_name` | `rules.acidBaseRelations`, `data.substances`, `core.ions` |
| `gen.pick_kinetics_directional` | Picks a directional_influence kinetics rule with source/target properties | `rule_id`, `source_prop`, `target_prop`, `direction`, `direction_label`, `direction_wrong_1`, `direction_wrong_2` | `rules.kineticsRules`, `rules.kineticsDirectionLabels` |

---

## 4. Solver Catalog

21 solvers in `src/lib/task-engine/solvers.ts`. Each receives `(params, slots, ontologyData)` and returns `SolverResult`.

### Direct computation solvers

| Solver ID | Logic | Uses deriveQuantity? |
|---|---|---|
| `solver.compare_property` | Looks up a property field on two elements, returns the symbol of the one with the higher value | No |
| `solver.periodic_trend_order` | Sorts element symbols by a property value in ascending or descending order | No |
| `solver.oxidation_states` | Returns `slots.expected_state` as-is (generator already resolved it) | No |
| `solver.compose_salt_formula` | Computes salt formula from cation + anion charges using LCM; handles polyatomic grouping with parentheses | No |
| `solver.solubility_check` | Looks up cation+anion pair in solubility table; maps slightly_soluble/decomposes to "insoluble" | No |
| `solver.slot_lookup` | Generic: returns `slots[params.answer_field]` directly | No |
| `solver.compare_crystal_melting` | Compares crystal types by `crystal_melting_rank` from bond examples data | No |
| `solver.electron_config` | Calls `getElectronConfig(Z)` from `src/lib/electron-config.ts` with exception overrides (Cr, Cu) | No |
| `solver.count_valence` | Derives valence electrons from group number (main group: group or group-10; transition: group) | No |
| `solver.delta_chi` | Calls `determineBondType(elA, elB)` from `src/lib/bond-calculator.ts`; returns bond type string with delta-chi in explanation_slots | No |
| `solver.driving_force` | Checks boolean slots (has_precipitate, has_gas, has_water, has_weak_electrolyte); returns first match | No |
| `solver.activity_compare` | Compares two metals by position in activity series; returns "yes" if A more active | No |
| `solver.predict_observation` | Returns `slots.observation` as-is | No |
| `solver.heat_of_reaction` | Returns `calcReaction.delta_H_kJmol` from the reaction object in slots | No |

### Formula-based solvers (use `evaluateFormula` / `solveFor` from `src/lib/formula-evaluator.ts`)

| Solver ID | Formula Used | Logic | Uses deriveQuantity? |
|---|---|---|---|
| `solver.molar_mass` | `formula:molar_mass_from_composition` | Evaluates indexed sum: M = SUM(Ar_i * count_i) | No (direct evaluateFormula with indexed bindings) |
| `solver.mass_fraction` | `formula:mass_fraction_element` | omega = Ar * n_atom / M | No (direct evaluateFormula) |
| `solver.amount_calc` | `formula:amount_from_mass` | mode=n: n=m/M; mode=m: m=n*M (via solveFor inversion) | No (direct evaluateFormula/solveFor) |
| `solver.concentration` | `formula:mass_fraction_solution` | mode=omega: w=m_solute/m_solution; mode=inverse: solveFor(m_solute); mode=dilution: uses deriveQuantity for mass conservation | Partially (dilution mode only) |

### Derivation planner solvers

| Solver ID | Logic | Uses deriveQuantity? |
|---|---|---|
| `solver.stoichiometry` | Builds QRef knowns (mass, stoich coefficients, molar masses for both roles), calls `deriveQuantity()` targeting `q:mass` of product | Yes |
| `solver.reaction_yield` | Same as stoichiometry but adds `q:yield` known; deriveQuantity applies yield factor after stoichiometric chain | Yes |
| `solver.derivation_planner` | Generic planner: reads `target_quantity`, `target_role`, `knowns_mapping` from params; builds derivation graph and plans algebraic path | Yes (via planDerivation + executePlan) |

---

## 5. Derivation Planner

Located in `src/lib/derivation/`. A backward-chaining AND/OR search over algebraic formulas.

### Components

| File | Purpose |
|------|---------|
| `derive-quantity.ts` | High-level orchestrator: handles lookup, decompose, stoichiometry, and fallback formula chain |
| `derivation-graph.ts` | `buildDerivationRules()` -- converts `ComputableFormula[]` into forward + inversion rules; `buildQuantityIndex()` -- indexes by target quantity |
| `derivation-planner.ts` | `planDerivation()` -- memoized AND/OR backward search with role compatibility, depth limit (6), approximate pruning, and cost scoring |
| `derivation-executor.ts` | `executePlan()` -- executes plan steps sequentially, calling `evaluateFormula` or `solveFor` per step |
| `resolvers.ts` | `resolveLookup()` -- element Ar lookup; `resolveDecompose()` -- substance formula parsing into element/count pairs |
| `molar-mass-resolver.ts` | `deriveMolarMass()` -- decompose substance, lookup Ar's, evaluate indexed M formula |
| `stoichiometry-helpers.ts` | `deriveStoichiometryChain()` -- 5-step chain: mass->amount (source) -> stoich ratio -> amount (target) -> mass (target) -> yield (optional) |
| `qref.ts` | `qrefKey()` -- canonical string key for QRef (quantity + role) |

### deriveQuantity dispatch order

1. **Direct lookup** -- `q:relative_atomic_mass` of an element: returns `el.atomic_mass`
2. **Molar mass** -- `q:molar_mass` of substance: decompose -> lookup Ar's -> indexed formula
3. **Component contribution** -- `q:component_molar_mass_contribution`: Ar * count for one element in a substance
4. **Component mass fraction** -- `q:component_mass_fraction`: M_part / M
5. **Stoichiometry** -- detected by presence of two `q:stoich_coeff` knowns with different roles: full stoichiometry chain
6. **Single-substance mass/amount** -- derive M via ontology, then formula chain for m <-> n <-> M
7. **Fallback** -- pure formula chain via planner (no ontology context needed)

### Plan scoring

Lower score = better plan. Scoring dimensions:
- Step count: 100 per step
- Approximate formula penalty: +50
- Indexed binding penalty: +30
- Generic role match penalty: +20 (unscoped rule matching scoped target)
- Inversion penalty: +10
- Per-rule baseCost (from formula metadata)

---

## 6. Competency-to-Template Mapping

From `ENGINE_COMPETENCY_MAP` in `src/features/competency/exercise-adapters.ts`. 20 competencies mapped to 65 templates.

| Competency | Template IDs |
|---|---|
| `periodic_trends` | `tmpl.pt.compare_property.v1`, `tmpl.pt.order_by_property.v1`, `tmpl.bond.delta_chi.v1` |
| `periodic_table` | `tmpl.pt.compare_property.v1`, `tmpl.pt.order_by_property.v1`, `tmpl.pt.find_period.v1`, `tmpl.pt.find_group.v1`, `tmpl.pt.select_electron_config.v1`, `tmpl.pt.count_valence.v1`, `tmpl.pt.element_from_config.v1` |
| `electron_config` | `tmpl.pt.select_electron_config.v1`, `tmpl.pt.count_valence.v1`, `tmpl.pt.element_from_config.v1`, `tmpl.pt.fill_orbital.v1` |
| `oxidation_states` | `tmpl.ox.determine_state.v1`, `tmpl.ox.max_state.v1`, `tmpl.ox.min_state.v1`, `tmpl.ox.select_by_state.v1` |
| `bond_type` | `tmpl.bond.identify_type.v1`, `tmpl.bond.select_by_type.v1`, `tmpl.bond.delta_chi.v1`, `tmpl.bond.predict_property.v1` |
| `crystal_structure_type` | `tmpl.bond.identify_crystal.v1`, `tmpl.bond.compare_melting.v1`, `tmpl.bond.predict_property.v1` |
| `classification` | `tmpl.class.classify.v1`, `tmpl.class.select_by_class.v1`, `tmpl.class.classify_subclass.v1`, `tmpl.class.identify_by_description.v1`, `tmpl.sub.identify_amphoteric.v1`, `tmpl.sub.formula_to_name.v1`, `tmpl.sub.name_to_formula.v1`, `tmpl.ion.compose_salt.v1`, `tmpl.ion.acid_to_anion.v1`, `tmpl.ion.anion_to_acid.v1`, `tmpl.ion.acid_residue_graph.v1` |
| `naming` | `tmpl.ion.compose_salt.v1`, `tmpl.sub.formula_to_name.v1`, `tmpl.sub.name_to_formula.v1`, `tmpl.sub.naming_rule.v1`, `tmpl.ion.formula_to_name.v1`, `tmpl.ion.name_to_formula.v1`, `tmpl.ion.suffix_rule.v1`, `tmpl.ion.acid_to_anion.v1`, `tmpl.ion.anion_to_acid.v1`, `tmpl.ion.acid_residue_graph.v1`, `tmpl.ion.ate_ite_pair.v1`, `tmpl.ion.ox_state_to_suffix.v1`, `tmpl.ion.classify_suffix_type.v1` |
| `amphoterism_logic` | `tmpl.sub.identify_amphoteric.v1`, `tmpl.sub.amphoteric_partner.v1` |
| `ion_nomenclature` | `tmpl.ion.formula_to_name.v1`, `tmpl.ion.name_to_formula.v1`, `tmpl.ion.suffix_rule.v1`, `tmpl.ion.acid_to_anion.v1`, `tmpl.ion.anion_to_acid.v1`, `tmpl.ion.acid_residue_graph.v1`, `tmpl.ion.ate_ite_pair.v1`, `tmpl.ion.ox_state_to_suffix.v1`, `tmpl.ion.classify_suffix_type.v1` |
| `reactions_exchange` | `tmpl.rxn.identify_type.v1`, `tmpl.rxn.predict_exchange.v1`, `tmpl.rxn.driving_force.v1`, `tmpl.rxn.will_occur.v1`, `tmpl.rxn.predict_substitution.v1`, `tmpl.rxn.activity_compare.v1`, `tmpl.rxn.will_metal_react.v1` |
| `gas_precipitate_logic` | `tmpl.sol.check_pair.v1`, `tmpl.rxn.driving_force.v1`, `tmpl.rxn.will_occur.v1` |
| `reactions_redox` | `tmpl.rxn.identify_oxidizer.v1` |
| `genetic_chain_logic` | `tmpl.chain.complete_step.v1`, `tmpl.chain.choose_reagent.v1` |
| `qualitative_analysis_logic` | `tmpl.qual.identify_reagent.v1`, `tmpl.qual.identify_ion.v1` |
| `electrolyte_logic` | `tmpl.rxn.match_ionic.v1`, `tmpl.rxn.spectator_ions.v1` |
| `reaction_energy_profile` | `tmpl.rxn.factors_rate.v1`, `tmpl.rxn.exo_endo.v1`, `tmpl.rxn.equilibrium_shift.v1`, `tmpl.kinetics.directional.v1` |
| `catalyst_role_understanding` | `tmpl.rxn.catalyst_props.v1`, `tmpl.rxn.identify_catalyst.v1` |
| `calculations_basic` | `tmpl.calc.molar_mass.v1`, `tmpl.calc.mass_fraction.v1`, `tmpl.calc.amount.v1`, `tmpl.calc.mass_from_moles.v1`, `tmpl.calc.heat_of_reaction.v1` |
| `calculations_solutions` | `tmpl.calc.concentration.v1`, `tmpl.calc.solute_mass.v1`, `tmpl.calc.dilution.v1` |
| `reaction_yield_logic` | `tmpl.calc.by_equation.v1`, `tmpl.calc.yield.v1` |

---

## 7. Interaction Formats

7 interaction types, mapped to UI Exercise formats in `task-engine.ts::toExercise()`.

| Interaction Type | Exercise Format | UI Behavior | Answer Kind(s) |
|---|---|---|---|
| `choice_single` | `multiple_choice` | Radio buttons; 1 correct + 3 distractors, shuffled | scalar_text, scalar_number, enum_single |
| `choice_multi` | `multiple_choice_multi` | Checkboxes; multiple correct IDs + distractors, shuffled | enum_multi |
| `order_dragdrop` | `order_items` | Drag-and-drop reorder; items presented shuffled, correctOrder holds answer | ordered_sequence |
| `numeric_input` | `multiple_choice` | Rendered as radio buttons (not free-text input); correct value + numeric distractors | scalar_number |
| `match_pairs` | `match_pairs` | Left-right pair matching; pairs parsed from "left:right" strings | pair_mapping |
| `interactive_orbital` | `interactive_orbital` | Dedicated orbital-filling widget; targetZ passed as prop; answer is opaque state | interactive_state |
| `guided_selection` | `guided_selection` | Chain display with gap; substance options shown; chain and gapIndex in context | scalar_text |

### Answer Kinds

| Kind | Meaning | Examples |
|---|---|---|
| `scalar_text` | Free-form string: formula, element symbol, name | "NaCl", "Fe", "sulfuric acid" |
| `scalar_number` | Numeric value | 98.0, +3, 0.125 |
| `enum_single` | One value from a known domain set | "ionic", "soluble", "exo" |
| `enum_multi` | Multiple values from a domain set (unordered) | ["acid", "base"] |
| `ordered_sequence` | Ordered string array | ["Li", "Na", "K", "Rb"] |
| `pair_mapping` | Array of "left:right" encoded pairs | ["Na+:Cl-"] |
| `interactive_state` | Opaque state interpreted by a dedicated UI widget | (orbital diagram) |

### Evaluation Modes

| Mode | Logic |
|---|---|
| `exact` | JSON-level equality of user answer vs correct answer |
| `tolerance` | Numeric comparison within +/- tolerance value |
| `partial_credit` | Position-by-position array match, fractional score (0..1) |
| `set_equivalence` | Order-independent set equality |

---

## 8. Distractor Engine

18 strategy branches in `src/lib/task-engine/distractor-engine.ts`. Strategy selection is based on slot context, interaction type, and answer kind. Priority order:

1. **Element compare** -- slots have `elementA`/`elementB`: other element + "equal" + "cannot determine"
2. **Melting compare** -- slots have `formulaA`/`formulaB`/`crystal_typeA`: other formula + locale labels
3. **Domain enum** -- answer matches a known domain (bond_type, crystal_type, substance_class, reaction_type, heat_effect, driving_force): other values from the domain
4. **Solubility** -- answer is soluble/insoluble: opposite + slightly_soluble
5. **Activity yes/no** -- metalA/metalB or will_occur context: opposite + "only with heating" + "depends on concentration"
6. **Calculation multiplier** -- numeric answer + M/composition slots: correct * [0.5, 2, 0.8, 1.2, 1.5, 0.1, 10, 3]
7. **Numeric** -- numeric_input or number answer: offsets (+/-1, +/-2), sign flip, zero
8. **Formula / ion** -- cation_id slot: other anion bases from ontology + subscript swaps
9. **Substance formula** -- bond_type or substance_class slot: formulas from bond examples or substances of different class
10. **Electron config** -- orbital notation with Z slot: configs for adjacent Z values
11. **Observation** -- observation + target_ion slots: other qualitative test observations
12. **Chain substance** -- guided_selection + chain_substances: other substance formulas
13. **Kinetics direction** -- direction_wrong_1 slot: pre-computed wrong direction labels
14. **Order permutation** -- ordered_sequence: reverse, swap-last-two, swap-middle
15. **Choice multi** -- enum_multi: wrong items from domain enums or ontology substances
16. **Match pairs** -- pair_mapping: wrong net-ionic equations from reactions pool
17. **Explicit strategy** -- `distractor_strategy` from template metadata: `other_formulas`, `other_names`, `same_pool` with configurable source/pool
18. **Fallback** -- random element symbols (scalar only; structured answer kinds get empty distractors)

### Explicit Distractor Strategies

Declared on templates via `meta.distractor_strategy`:

| Strategy ID | Params | Logic |
|---|---|---|
| `other_formulas` | `source`: substances, ions, anions, qualitative_reagents, oxidation_examples | Picks formulas from the specified pool |
| `other_names` | `source`: substances, ions, anions, qualitative_targets, acids | Picks locale-specific names from the specified pool |
| `same_pool` | `pool_id`, optional `field` | Resolves a named pool: rate_factors, equilibrium_shifts, catalysts, suffix_rules, ion_suffixes, element_symbols |

---

## 9. Prompt Rendering & Slot Resolution

### Prompt rendering (`prompt-renderer.ts`)

1. Look up prompt template by ID from locale-specific `promptTemplates` map
2. Call `resolveSlots()` to resolve slot directives
3. Replace `{key}` placeholders in the question string with resolved values

### Slot resolution directives (`slot-resolver.ts`)

| Directive | Syntax | Example | Logic |
|---|---|---|---|
| **Passthrough** | (no directive) | `{formula}` | Copies slot value as-is |
| **Lookup** | `lookup:collection.{key}.path` | `lookup:properties.{property}.i18n.en.name` | Navigates into PropertyDef objects |
| **Morph** | `morph:domain.{key}.field` | `morph:elements.{element}.gen` | Looks up morphological form (nom, gen, dat, acc, inst, loc); falls back to rule-based `decline()`, then to nominative |
| **Enum map** | `{ "key1": "value1", ... }` | `{ "ascending": "ascending", "descending": "descending" }` | Maps slot value through a locale-specific string map |

### Rich text rendering (`renderToRichText`)

Parses `{ref:id}` and `{ref:id|form}` tokens in rendered text into `RichText` segments (text + ref), enabling FormulaChip/OntologyRef rendering in the UI.

---

## 10. Data Dependencies Summary

| Data Source | Loaded Via | Used By (Generators) | Used By (Solvers) |
|---|---|---|---|
| `elements.json` (118 elements) | `loadElements()` | pick_element_pair, pick_elements_same_period, pick_element_position, pick_element_for_config, pick_substance_by_class | compare_property, periodic_trend_order, delta_chi, electron_config, molar_mass, mass_fraction, stoichiometry |
| `ions.json` (31 ions) | `loadIons()` | pick_ion_pair, pick_salt_pair, pick_ion_nomenclature, pick_acid_anion_from_graph | compose_salt_formula |
| `rules/properties.json` (5 properties) | `loadProperties()` | pick_element_pair, pick_elements_same_period | compare_property, periodic_trend_order |
| `rules/solubility.json` (108 entries) | `loadSolubilityRules()` | pick_salt_pair | solubility_check |
| `rules/oxidation_examples.json` (22 examples) | `loadOxidationExamples()` | pick_oxidation_example | oxidation_states |
| `rules/bond_examples.json` (17 examples) | `loadBondExamples()` | pick_bond_example, pick_bond_pair | compare_crystal_melting (crystal_melting_rank) |
| `substances/` (80 substances) | `loadSubstancesIndex()` | pick_substance_by_class | (distractor generation) |
| `reactions/` (32 reactions) | `loadReactions()` | pick_reaction | driving_force, slot_lookup |
| `rules/activity_series.json` (18 entries) | `loadActivitySeries()` | pick_activity_pair | activity_compare |
| `rules/classification_rules.json` | `loadClassificationRules()` | pick_classification_rule | (slot_lookup) |
| `rules/naming_rules.json` | `loadNamingRules()` | pick_naming_rule | (slot_lookup) |
| `rules/qualitative_tests.json` (11 tests) | `loadQualitativeTests()` | pick_qualitative_test | predict_observation |
| `rules/energy_catalyst.json` | `loadEnergyCatalystTheory()` | pick_energy_catalyst | (slot_lookup) |
| `genetic_chains.json` (5 chains) | `loadGeneticChains()` | pick_chain_step | (slot_lookup) |
| `calculations_data.json` (24 substances, 10 reactions) | `loadCalculationsData()` | pick_calc_substance, pick_calc_reaction, pick_thermo_reaction | heat_of_reaction |
| `rules/ion_nomenclature.json` | `loadIonNomenclature()` | pick_ion_nomenclature | (slot_lookup) |
| `relations/acid_base_relations.json` (40 triples) | `loadRelations()` | pick_acid_anion_from_graph | (slot_lookup) |
| `rules/kinetics_rules.json` | `loadKineticsData()` | pick_kinetics_directional | (slot_lookup) |
| `formulas.json` (computable formulas) | `loadFormulas()` | (none) | molar_mass, mass_fraction, amount_calc, concentration, stoichiometry, reaction_yield, derivation_planner |
| `constants.json` (physical constants) | `loadConstants()` | (none) | All formula-based solvers |
| `prompt_templates.{locale}.json` | `loadPromptTemplates()` | (none) | (prompt rendering) |
| `translations/{locale}/morphology.json` | `loadMorphology()` | (none) | (slot resolution for morph: directives) |

---

## 11. Engine Initialization

`buildEngine()` in `exercise-adapters.ts` assembles the full OntologyData by loading 22 data sources in parallel, then calls `createTaskEngine(templates, ontology)`.

### Entry points

| Function | Purpose |
|---|---|
| `loadEngineAdapter(competencyId, locale)` | Returns an `Adapter` that generates exercises for a specific competency. Picks a random template from `ENGINE_COMPETENCY_MAP[competencyId]` on each call. |
| `loadFeatureAdapter(competencyIds, locale)` | Returns an `Adapter` that generates exercises for any competency in the given set. Picks a random competency, then a random template. |
| `buildEngine(locale)` | Builds and returns a raw `TaskEngine` instance for direct use. |

### TaskEngine API

```typescript
interface TaskEngine {
  generate(templateId: string): GeneratedTask;
  generateRandom(): GeneratedTask;
  generateForCompetency(competencyId: string): GeneratedTask | null;
  generateFromPinned(instance: PinnedInstance): GeneratedTask;
  toExercise(task: GeneratedTask): Exercise;
}
```
