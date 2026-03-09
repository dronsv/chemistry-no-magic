# Physical Foundations Layer — Specification

**Дата**: 2026-03-09
**Статус**: Approved — ready for implementation
**Пакет**: `docs/physical_foundations_ontology_package.zip` + Architecture Review 2026-03-09
**ADR**: ADR-003 (locale-neutral catalogs)

---

## Цель

Создать явный explanatory layer, который:

1. делает физические объяснения **first-class ontology objects**, а не ad hoc prose;
2. поддерживает отдельную страницу `/physical-foundations/` с deep-linkable sections;
3. генерирует **inline hints** на chemistry pages;
4. обслуживает **explanation chains** в task engine, theory modules, и ElementDetails;
5. остаётся полностью locale-neutral в source (ADR-003).

---

## Архитектурные слои

```
Layer A — Domain facts (existing)
  elements, ions, substances, rules, reactions, electron_exception
        │ uses for explanation
Layer B — Explanatory primitives (NEW)
  physical_concepts, math_concepts, mechanisms
  trend_rules, group_definitions, observables
        │ composed into
Layer C — Bridge models (NEW)
  bridge_explanations, topic_explanation_routes
        │ rendered via
Layer D — Locale rendering (extending existing)
  frame_catalogs/{locale}/*.json
  morphology
  template renderers (extending Phase B1 pipeline)
        │ consumed by
Layer E — Product surfaces (NEW)
  PhysFoundationHint (inline hint component)
  /physical-foundations/ page
  Deep links from ElementDetails, TheoryModule, ExplanationTrace
```

---

## Corrected Schemas (ADR-003 compliant)

### PhysicalConcept

```json
{
  "id": "phys:temperature",
  "kind": "physical_concept",
  "domain": "thermal",
  "labels": {
    "ru": "температура", "en": "temperature",
    "pl": "temperatura", "es": "temperatura"
  },
  "definition_frame_id": "phys.temperature.definition",
  "summary_frame_id": "phys.temperature.summary",
  "intuition_frame_id": "phys.temperature.intuition",
  "chemistry_relevance_frame_id": "phys.temperature.chemistry_relevance",
  "math_prereqs": ["math:average_value", "math:greater_less"],
  "related_concepts": ["phys:thermal_motion", "phys:collision"],
  "anchors": ["temperature"]
}
```

**Все поля — locale-neutral.** Prose только через frame IDs.

### MathConcept

```json
{
  "id": "math:average_value",
  "kind": "math_concept",
  "labels": { "ru": "среднее значение", "en": "average value", "pl": "wartość średnia", "es": "valor promedio" },
  "definition_frame_id": "math.average_value.definition",
  "difficulty_level": 1,
  "used_in_bridges": ["bridge:why_heating_speeds_reactions"]
}
```

### Mechanism

```json
{
  "id": "mech:temperature_increases_average_kinetic_energy",
  "kind": "causal_mechanism",
  "labels": {
    "ru": "рост температуры → рост средней кинетической энергии",
    "en": "temperature increase → higher average kinetic energy"
  },
  "statement_frame_id": "mech.temperature_increases_average_kinetic_energy.statement",
  "school_frame_id": "mech.temperature_increases_average_kinetic_energy.school",
  "strict_frame_id": "mech.temperature_increases_average_kinetic_energy.strict",
  "inputs": ["phys:temperature"],
  "outputs": ["phys:kinetic_energy"],
  "requires_concepts": ["phys:temperature", "phys:thermal_motion", "math:average_value"]
}
```

### BridgeExplanation

```json
{
  "id": "bridge:why_heating_speeds_reactions",
  "kind": "bridge_explanation",
  "required_physical_concepts": [
    "phys:temperature", "phys:thermal_motion",
    "phys:collision", "phys:effective_collision"
  ],
  "required_math_concepts": ["math:average_value", "math:probability_basic"],
  "mechanism_sequence": [
    "mech:temperature_increases_average_kinetic_energy",
    "mech:higher_speed_increases_collision_rate",
    "mech:higher_energy_increases_effective_fraction"
  ],
  "target_anchors": ["temperature", "effective-collisions"],
  "hint_frame_id": "bridge.why_heating_speeds_reactions.hint",
  "school_frame_id": "bridge.why_heating_speeds_reactions.school",
  "strict_frame_id": "bridge.why_heating_speeds_reactions.strict",
  "deep_link": "/physical-foundations#temperature-and-collisions",
  "used_by_topics": ["topic:reaction_rate", "topic:gas_laws"],
  "used_by_rules": ["rule:applicability.heating_condition"]
}
```

---

## Pilot Set — WP1 первая волна

9 physical concepts + 7 mechanisms + 5 bridge explanations + 8 math concepts.

### Physical Concepts (9)

| ID | Domain | First used in |
|----|--------|---------------|
| `phys:temperature` | thermal | reaction rate, gas laws |
| `phys:thermal_motion` | thermal | reaction rate |
| `phys:collision` | thermal | reaction rate |
| `phys:effective_collision` | thermal | reaction rate |
| `phys:electronic_energy_level` | atomic_structure | electron exceptions, spectra |
| `phys:ground_state` | atomic_structure | electron exceptions, spectra |
| `phys:excited_state` | atomic_structure | spectra, flame tests |
| `phys:photon` | radiation | spectra, color |
| `phys:electrostatic_attraction` | electrostatics | bond energy, ionic bonds |

### Math Concepts (8)

| ID | Level | Used in |
|----|-------|---------|
| `math:greater_less` | 1 | all |
| `math:average_value` | 1 | reaction rate, temperature |
| `math:graph_reading` | 1 | all |
| `math:probability_basic` | 2 | reaction rate |
| `math:proportion` | 1 | gas laws, stoichiometry |
| `math:inverse_dependence` | 2 | gas laws, spectra |
| `math:difference` | 1 | energy levels |
| `math:percent` | 1 | calculations |

### Mechanisms (7)

| ID | Chain |
|----|-------|
| `mech:temperature_increases_average_kinetic_energy` | temp → kinetic energy |
| `mech:higher_speed_increases_collision_rate` | kinetic energy → collision rate |
| `mech:higher_energy_increases_effective_fraction` | energy → effective collisions |
| `mech:absorption_causes_upward_transition` | photon → excited state |
| `mech:downward_transition_emits_energy` | excited state → photon |
| `mech:ground_state_is_lowest_energy` | config exceptions vs excitation |
| `mech:exchange_stabilization_lowers_energy` | half/full d/f → lower energy |

### Bridge Explanations (5)

| ID | Used on pages |
|----|--------------|
| `bridge:why_heating_speeds_reactions` | reactions, kinetics |
| `bridge:why_atoms_emit_light` | periodic-table, spectra |
| `bridge:why_flame_tests_have_color` | reactions |
| `bridge:excitation_vs_configuration_exception` | periodic-table (ElementDetails) |
| `bridge:why_half_filled_is_stable` | periodic-table (ElementDetails, Epic D) |

---

## Work Packages — Implementation Checklist

### WP0. Convention & Validator (prerequisite for everything else)

- [ ] **ADR-003**: `docs/adr-003-locale-neutral-catalogs.md` ← **(сделано 2026-03-09)**
- [ ] Add `validateExplanatoryCatalogLocaleNeutral()` to `scripts/lib/validate.mjs`
- [ ] Register in `validateAll()` for `physical_concepts`, `mechanisms`, `bridge_explanations`
- [ ] Run `npm run validate:data` — verify no false positives

### WP1. Core Catalogs — Source Files

- [ ] `data-src/physical_concepts.json` — 9 pilot concepts (ADR-003 compliant, no inline prose)
- [ ] `data-src/math_concepts.json` — 8 pilot math concepts
- [ ] `data-src/mechanisms.json` — 7 pilot mechanisms
- [ ] `data-src/bridge_explanations.json` — 5 pilot bridges
- [ ] Register all 4 files in `scripts/build-data.mjs` (copy to bundle)
- [ ] Add to `scripts/lib/generate-manifest.mjs` under `entrypoints.physical` section
- [ ] Add to `src/types/manifest.ts` — `ManifestEntrypoints.physical?: {...}`
- [ ] Add types: `src/types/physical-foundations.ts` — `PhysicalConcept`, `Mechanism`, `MathConcept`, `BridgeExplanation`
- [ ] Run `npm run validate:data` — WP0 validator catches any prose violations
- [ ] Run `npm run build` — verify pages count unchanged, no TS errors

### WP6. Locale Frames (RU first, EN/PL/ES wave 2)

- [ ] `data-src/frames/physical_concepts_frames.json` — 9 concepts × 4 frame variants (definition, summary, intuition, chemistry_relevance)
- [ ] `data-src/frames/mechanisms_frames.json` — 7 mechanisms × 3 variants (statement, school, strict)
- [ ] `data-src/frames/bridge_explanations_frames.json` — 5 bridges × 3 variants (hint, school, strict)
- [ ] Register in build pipeline (copy to bundle alongside concepts)
- [ ] Add `loadPhysicalFrames(locale)` to `src/lib/data-loader.ts`
- [ ] Add `loadBridgeFrames(locale)` to `src/lib/data-loader.ts`
- [ ] RU locale: `data-src/translations/ru/frames/physical_concepts.json`
- [ ] RU locale: `data-src/translations/ru/frames/mechanisms.json`
- [ ] RU locale: `data-src/translations/ru/frames/bridge_explanations.json`
- [ ] EN locale overlay: `data-src/translations/en/frames/physical_concepts.json` (wave 2)
- [ ] PL locale overlay: `data-src/translations/pl/frames/physical_concepts.json` (wave 2)
- [ ] ES locale overlay: `data-src/translations/es/frames/physical_concepts.json` (wave 2)

### WP2. Physical Foundations Page

- [ ] `src/pages/physical-foundations/index.astro` — RU page, static Astro
- [ ] `src/pages/en/physical-foundations/index.astro` — EN page
- [ ] Page sections matching anchor IDs:
  - `#temperature`
  - `#effective-collisions`
  - `#energy-levels`
  - `#excitation`
  - `#emission`
  - `#absorption`
  - `#spectra`
  - `#color`
  - `#excitation-vs-configuration-exception`
  - `#exchange-stabilization`
  - `#bond-energy`
  - `#gas-pressure`
- [ ] Section content rendered from bridge + mechanism frames (server-side)
- [ ] Add to navigation (`Nav.astro`) under Chemistry section or dedicated "Basics" entry
- [ ] Add to `data-src/topics.json` as section (or keep as standalone reference page)
- [ ] `src/pages/physical-foundations/[anchor].astro` — optional: deep-link redirects

### WP3. Deep-Link Anchors

- [ ] Define stable anchor namespace in `data-src/physical_concepts.json` (already in schema)
- [ ] Anchor uniqueness validated in `validate.mjs`
- [ ] No anchor collision with existing `/reactions/`, `/periodic-table/` page anchors
- [ ] Add `type PhysFoundationAnchor` to `src/types/physical-foundations.ts`

### WP4. Inline Hints on Chemistry Pages

- [ ] Build `loadBridgeForAnchor(anchorId, locale)` → returns rendered hint text + deep_link
- [ ] `PhysFoundationHint.tsx` component (see visualization-components.md for spec)
- [ ] Wire `bridge:excitation_vs_configuration_exception` into `ElementDetails.tsx`
  - Show under electron exception note when exception is shown
- [ ] Wire `bridge:why_heating_speeds_reactions` into `ReactionTheoryPanel`
  - Show as inline hint in kinetics/rate section
- [ ] Wire `bridge:why_atoms_emit_light` into PeriodicTable element detail
  - Show for elements used in flame tests

### WP5. Reverse Indices (build-time)

- [ ] `scripts/lib/generate-physical-indices.mjs`:
  - `bridge_to_topics.json` — bridge_id → [topic_ids]
  - `concept_to_topics.json` — concept_id → [topic_ids, page_urls]
  - `topic_to_prereqs.json` — topic_id → [bridge_ids, concept_ids]
- [ ] Add to build pipeline (after WP1 data is present)
- [ ] Add to manifest under `entrypoints.physical.indices`
- [ ] Add loaders: `loadBridgeToTopics()`, `loadTopicPrereqs(topicId, locale)`

---

## D+ Phase (after WP1 + Phase F)

Добавить на `electron_exception.stabilization.family` → mechanism references:

```json
// В electron_exception_frames.json или отдельном mapping:
{
  "exchange_stabilization": {
    "mechanism_ids": ["mech:exchange_stabilization_lowers_energy"],
    "bridge_id": "bridge:why_half_filled_is_stable",
    "deep_link": "/physical-foundations#exchange-stabilization"
  },
  "shell_symmetry": {
    "mechanism_ids": ["mech:full_shell_symmetry_lowers_energy"],
    "bridge_id": "bridge:why_full_shell_is_stable",
    "deep_link": "/physical-foundations#exchange-stabilization"
  },
  "energy_proximity": {
    "mechanism_ids": ["mech:small_nd_nf_energy_gap"],
    "bridge_id": "bridge:why_nd_nf_proximity",
    "deep_link": "/physical-foundations#energy-levels"
  }
}
```

- [ ] Add `mechanism_ref` + `bridge_id` + `deep_link` to `electron_exception.stabilization` (data)
- [ ] `ElementDetails.tsx` / `ElementDetailPanel.tsx` — render "learn more" CTA using these fields

---

## Rollout Sequence

```
Phase F (in progress):
  Epic D — electron_exception: moves + stabilization + frames + reason generation
        ↓
WP0 (next):
  ADR-003 validator in build pipeline
        ↓ (parallel tracks)
WP1 + WP6 pilot:
  Core catalogs (9 concepts, 7 mechanisms, 5 bridges) — locale-neutral
  RU frames for all — completes explanation chain
        ↓
D+ :
  Wire mechanism_refs into electron_exception.stabilization
  ElementDetails gains "Learn more" CTA → /physical-foundations#exchange-stabilization
        ↓
WP2 + WP3:
  /physical-foundations/ page with anchors
        ↓
WP4:
  Inline hints on reactions + periodic-table pages
        ↓
WP5:
  Build-time reverse indices
        ↓
Wave 2:
  EN/PL/ES frame overlays
  Expand pilot to ~20 concepts
  PL/ES physical-foundations pages
```

---

## Дизайн решения по `mechanism_sequence`

На v1 — линейный список (`array`). Extensible к DAG в будущем:

```json
// v1: список
"mechanism_sequence": ["mech:A", "mech:B", "mech:C"]

// future v2: граф (не ломает v1 consumers)
"mechanism_graph": {
  "start": "mech:A",
  "edges": [{ "from": "mech:A", "to": ["mech:B", "mech:C"] }]
}
```

---

## Observables + Trend Rules (scope note)

Слой `observables` и `trend_rules` (atomic_radius, ionization_energy) также требует locale-neutral source. Это **отдельный backlog item** — не часть Physical Foundations pilot. Связь:

- `observable:atomic_radius` → `trend_rule:atomic_radius.across_period` → `bridge:why_radius_decreases`
- Referencing mechanisms: `mech:increasing_nuclear_charge`, `mech:similar_shielding_within_period`

Временно живёт в `specs-backlog.md` §N. Physical Foundations pilot не ждёт этого.

---

## Open Questions

| Вопрос | Статус |
|--------|--------|
| Нужен ли отдельный `frames/` subdirectory или влить в existing `templates/`? | Recommendation: отдельный `data-src/frames/` — отличается форматом от rule_summary_templates |
| `labels_key` vs inline `labels` dict? | **Decision**: inline `labels` ok для proper nouns (≤5 слов), `*_frame_id` для всего остального |
| PL/ES для physical-foundations страницы — когда? | Wave 2, после RU + EN |
| Интеграция с task engine: tasks могут ссылаться на bridge? | Yes — через `prerequisite_bridge_ids[]` в task template (Phase F+) |
