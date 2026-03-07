# Transformation Plan — Chemistry Without Magic

> Живой план преобразований онтологии, локализации и архитектуры.
> Закрываем пункты по мере выполнения. Последнее обновление: 2026-03-07 (Phase E).

---

## Статус фаз

| Фаза | Название | Статус | Ветка/Коммит |
|------|----------|--------|--------------|
| **A** | Locale-Free Core + Relations Layer | ✅ Done | `feature/locale-free-ontology` a8ef33f |
| **B1** | Controlled Rule Text Generation | ✅ Done | `feature/locale-free-ontology` 1ee8966 |
| **B1.5** | Projection / Facet Integration | ✅ Done | `feature/locale-free-ontology` 0c8b3c6 |
| **B** | Relations Expansion | ✅ Done | `feature/locale-free-ontology` (see below) |
| **E** | Ontology Completion (schema + query API + observation facets + activity flags) | ✅ Done | `feature/locale-free-ontology` dc226f7 |
| **C** | ADR-002 ID Migration (`sub:` everywhere) | 🔲 Deferred | — |
| **D** | Student Materials → Theory Layer | 🔲 Deferred | — |
| **L** | Localization Foundation (EN/PL/ES overlays + morphology) | 🔲 Planned | `feature/localization-foundation` (after E merge) |

---

## Phase A — Locale-Free Core ✅

### Завершено

- [x] Migration script `scripts/migrate-to-locale-packs.mjs`
- [x] `data-src/translations/ru/` — полный Russian locale pack (~45 файлов)
- [x] Удалены все `*_ru`/`*_en`/`*_pl`/`*_es` поля из core `data-src/`
- [x] Loaders: убран 'ru' skip из `data-loader.ts`, `build-overlay.ts`, `build-data-cache.ts`
- [x] `src/types/*.ts` — поля переименованы, `_ru` удалены
- [x] Code sweep `src/` — ~200 обращений к `_ru` полям обновлены
- [x] Build: 1424 pages ✓
- [x] Tests: 708 ✓
- [x] `data-src/relations/acid_base_relations.json` — 40 Brønsted-Lowry триплетов
- [x] `data-src/relations/ion_roles.json` — 26 role триплетов
- [x] `data-src/relations/relation_schema.json`
- [x] Build pipeline + manifest + `loadRelations<T>(key)` в data-loader
- [x] `docs/knowledge_graph_and_localization_plan.md`

### Pending

- [x] Push `feature/locale-free-ontology` → PR → merge to master (PR #1 opened, Phases A–E)

---

## Phase B1 — Controlled Rule Text Generation ✅

**Spec**: `docs/phase_b1_controlled_rule_text_generation.md`

**Принцип**: Tier 1 rule summaries генерируются из структурных данных + vocab + templates.
Ручной текст разрешён только как `pedagogical_note` override.

### Шаги

- [x] **Data: applicability_rules** — добавить `rule_kind`, `reactant_pattern`, `conditions[]`, `product_template`, `exceptions[]` в `data-src/rules/applicability_rules.json` (15 правил)
- [x] **Data: activity_series** — добавить машиночитаемые флаги (`reduces_H_from_water`, `displacement_below`) в `data-src/rules/activity_series.json` (Phase E4)
- [x] **Vocab**: создать `data-src/vocab/rule_terms.json` — typed vocab per locale
- [x] **Templates**: создать `data-src/templates/rule_summary_templates.json` — шаблоны per `rule_kind` × locale
- [x] **Generator**: реализовать `scripts/lib/generate-rule-texts.mjs` — читает core + vocab + templates, генерирует summaries
- [x] **Build integration**: вызов генератора в `scripts/build-data.mjs`, output в bundle
- [x] **Validator**: `validateApplicabilityRuleStructure()` — проверка структурных полей; validator читает allowed fields из schema динамически
- [x] **Loader**: `loadRuleTexts()` в `src/lib/data-loader.ts`
- [x] **Locale packs**: убрать `condition`/`description` из ru overlay; оставить только `pedagogical_note`
- [x] **knowledge_level**: добавить `knowledge_level` + `source_kind` в relation schema (Phase E1); аннотированы acid_base_relations, ion_roles, has_naming_rule
- [x] **Tests**: 728 тестов ✓

---

## Phase B1.5 — Projection / Facet Integration ✅

- [x] Ввести `projection_builder` слой: `src/lib/rule-text-projection.ts`
- [x] `rule_summary_projection` — per locale, агрегирует canonical_summary + exception_note → `RuleSummaryProjection`
- [x] `observation_facet_projection` — gas evolution → `observation?: string` в projection (Phase E3)
- [x] Data flow: generated JSON → projection builder → page component (ReactionTheoryPanel)
- [x] Прямое чтение `generated/` файлов запрещено через документальный контракт

---

## Phase B — Relations Expansion ✅

- [x] `data-src/relations/forms_salt_with.json` — 67 cation ↔ anion пар (build-time из solubility data)
- [x] `data-src/relations/has_naming_rule.json` — 22 ion → suffix_rule.id триплета
- [x] `relations/instance_of.json` — 328 классификационных триплетов (build-time из class/subclass веществ)
- [x] Validator: `validateRelationIdIntegrity()` — проверка sub:/ion:/el: ID в онтологии
- [x] TypeScript тип `Relation` — `src/types/relation.ts`
- [x] Task engine generators: `gen.pick_acid_anion_from_graph` — находит кислотный остаток через граф acid_base_relations; шаблон `tmpl.ion.acid_residue_graph.v1` (4 локали)
- [x] ~~Resolve `sub:` vs `subst:`~~ — **решено: `sub:`**. Валидатор Phase B запрещает `subst:`.

---

## Phase E — Ontology Completion ✅

**Design**: `docs/plans/2026-03-07-ontology-completion-design.md`

### E1: Relation Schema Extension

- [x] `data-src/relations/relation_schema.json` — добавлены `knowledge_level` (strict_chemistry | school_convention | pedagogical) и `source_kind`
- [x] `src/types/relation.ts` — опциональные поля + тип `KnowledgeLevel`
- [x] `acid_base_relations.json` аннотирован `knowledge_level: "strict_chemistry"` (42 триплета)
- [x] `ion_roles.json` аннотирован `knowledge_level: "school_convention"` (27 триплетов)
- [x] `has_naming_rule.json` аннотирован `knowledge_level: "school_convention"` (22 триплета)
- [x] Validator читает allowed fields из schema динамически (не hardcoded)

### E2: Relations Query API

- [x] `src/lib/relations.ts` — 5 чистых функций: `getTargets`, `getSources`, `filterByKnowledgeLevel`, `terminalConjugateBase`, `getAtStep`
- [x] `src/lib/__tests__/relations.test.ts` — 13 тестов; monoprotic + diprotic chain traversal
- [x] `generators.ts` дедуплицирован: `buildTerminalAnionMap` заменён на `terminalConjugateBase` из `relations.ts`

### E3: Observation Facets

- [x] `applicability_rules.json` — добавлены `observation_facets` в 4 gas-evolution правила (CO2, SO2, H2S, NH3)
- [x] `rule_summary_templates.json` — шаблон `observation_summary:gas_evolution` (4 локали)
- [x] `generate-rule-texts.mjs` — генерирует `observation_summary` слот из facets
- [x] `src/lib/rule-text-projection.ts` — добавлено поле `observation?: string` в `RuleSummaryProjection`

### E4: Activity Series Machine Flags

- [x] `src/types/rules.ts` — `ActivitySeriesEntry`: добавлены `reduces_H_from_water?`, `displacement_below?`; `name` сделан опциональным (locale-free)
- [x] `data-src/rules/activity_series.json` — все 18 металлов обновлены с обоими флагами
- [x] `src/lib/__tests__/activity-series-flags.test.ts` — 4 теста проверяют назначение флагов
- [x] `generators.ts` — fallback `a.name ?? a.symbol` для locale-free данных

**Итог**: 728 тестов ✓, build ✓, PR #1 обновлён

---

## Phase C — ADR-002 ID Migration 🔲

**Масштаб**: 300+ файлов. Только после стабилизации A + B.

- [ ] Audit: инвентаризация всех ID в `data-src/` (текущий формат)
- [x] ~~Decide `sub:` vs `subst:`~~ — **`sub:`** зафиксировано
- [ ] Migration script: `scripts/migrate-ids.mjs` — batch rename `nacl` → `sub:nacl`, `SO4_2minus` → `ion:SO4_2minus` и т.д.
- [ ] Update all `subject`/`object` поля в `relations/*.json`
- [ ] Update `ions[]` поля на веществах
- [ ] Update `formula_lookup.json` pipeline
- [ ] Regression: все 1424 страницы + 708 тестов

---

## Phase D — Student Materials → Theory Layer 🔲

- [ ] Извлечь педагогические тексты из ZIP-архивов (`student_materials/`, `acid_base_for_students.md`)
- [ ] Создать `data-src/theory_modules/ion_nomenclature.json` — расширить секцию Brønsted
- [ ] `data-src/translations/ru/theory_modules/ion_nomenclature.json` — Russian text
- [ ] `data-src/translations/en/theory_modules/ion_nomenclature.json` — English text
- [ ] Locale pack для pl/es

---

## Open Questions

| Вопрос | Решение |
|--------|---------|
| `sub:` vs `subst:` prefix? | ✅ **`sub:`** — зафиксировано. `subst:` запрещён с Phase B. |
| `has_constituent_ion` vs `ions[]` на веществах? | Оба: `ions[]` — быстрый доступ runtime; relation — для graph traversal |
| Reverse relations (`has_conjugate_acid`) — хранить или вычислять? | Вычислять (при ~66 триплетах traversal дешевле) |
| `energy_catalyst_theory.json` с русским в core — убирать когда? | После locale routing на `/competency/[id]` страницах |
| Tier 2 генерация (naming/classification rules) — когда? | После оценки качества B1 pilot |
| `pedagogical_note` override — отдельный файл или в locale pack? | В locale pack (поле `pedagogical_note` в overlay) |

---

## Принципы (не менять без обсуждения)

1. **Locale-free core** — `data-src/` не содержит естественного языка
2. **Text from ontology first** — structured fields → vocab + templates → generated text; ручной текст только для Tier 3
3. **One entity, multiple roles** — роли через `has_role` relation, не через дублирующие поля
4. **Derived, not stored** — `terminal_conjugate_base`, `acid_residue` — вычисляются из графа
5. **Step for polyprotic chains** — поле `step` в триплетах сохраняется (из ZIP 1)
6. **`ion:` унифицированный prefix** для всех ионов (не `cat:`/`an:`)
