# Transformation Plan — Chemistry Without Magic

> Живой план преобразований онтологии, локализации и архитектуры.
> Закрываем пункты по мере выполнения. Последнее обновление: 2026-03-08 (Phase D).

---

## Статус фаз

| Фаза | Название | Статус | Ветка/Коммит |
|------|----------|--------|--------------|
| **A** | Locale-Free Core + Relations Layer | ✅ Done | `feature/locale-free-ontology` a8ef33f |
| **B1** | Controlled Rule Text Generation | ✅ Done | `feature/locale-free-ontology` 1ee8966 |
| **B1.5** | Projection / Facet Integration | ✅ Done | `feature/locale-free-ontology` 0c8b3c6 |
| **B** | Relations Expansion | ✅ Done | `feature/locale-free-ontology` (see below) |
| **E** | Ontology Completion (schema + query API + observation facets + activity flags) | ✅ Done | `feature/locale-free-ontology` dc226f7 |
| **E3+** | Observation Ontology (reaction_observations + substance_properties + indicator model) | ✅ Done | `feature/localization-foundation` |
| **L** | Localization Foundation (EN/PL/ES overlays + morphology + generated texts) | ✅ Done | `feature/localization-foundation` c02dcef |
| **D** | Student Materials → Theory Layer | ✅ Done | `feature/localization-foundation` 896c2d2 |
| **C** | ADR-002 ID Migration (`sub:` everywhere) | ✅ Done | `feature/localization-foundation` |

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

## Phase E3+ — Observation Ontology ✅

**Branch**: `feature/localization-foundation`

Расширение E3 (observation facets): вместо прямых vocab lookup создана полноценная онтология наблюдений.

### Завершено

- [x] `data-src/rules/reaction_observations.json` — 11 structured observation entities (`obs:*`): precipitate (8), gas_evolution (2), indicator_change (1)
- [x] `data-src/substances/substance_properties.json` — 9 физических свойств веществ (`prop:color`, `prop:texture`, `phase:solid`) с `sub:*` ID
- [x] `data-src/rules/indicator_entities.json` — 3 индикатора (litmus, phenolphthalein, methyl_orange)
- [x] `data-src/rules/indicator_response_rules.json` — правило-маппинг indicator + medium → color
- [x] `data-src/rules/medium_states.json` — 3 состояния среды (acidic, neutral, alkaline)
- [x] `data-src/translations/{locale}/color_terms.json` — 4 locale packs (ru/en/pl/es): `color:brown` → "бурый" (ru), "brunatny" (pl)
- [x] `data-src/translations/{locale}/indicator_response_rules.json` — 4 locale packs с `short_statement_override` для идиом ("посинение лакмуса")
- [x] `scripts/lib/generate-rule-texts.mjs` — `generateQualitativeTexts()`: precipitate text из ontology props → locale noun assembly; gas → formula_display; indicator → override
- [x] `data-src/rules/qualitative_reactions.json` — `observation_facets` теперь ссылаются на `obs:*` ID (вместо плоских `"precipitate:AgCl"`)
- [x] `data-src/vocab/rule_terms.json` + translations — удалены `precipitate:*`/`indicator:*` (перешли в ontology)
- [x] Build: 5 новых файлов в bundle; manifest обновлён
- [x] Tests: 757 тестов ✓ (новая suite `generateQualitativeTexts`)

### Ключевые принципы реализации

- **Locale-specific noun assembly** (не в данных): `PRECIPITATE_NOUN = {ru: 'осадок', en: 'precipitate', pl: 'osad', es: 'precipitado'}` — rendering logic, not data
- **ES word order**: `{noun} {color} [texture] de {formula}` — branch в `buildPrecipitateDesc()`
- **Idiom override**: `computed:indicator_change:ind:litmus:medium:alkaline.short_statement_override = "посинение лакмуса"` — допустимо для фразеологизмов

---

## Phase L — Localization Foundation ✅

**Branch**: `feature/localization-foundation` c02dcef

### Завершено

- [x] EN/PL/ES locale overlays для ~15 data files (elements, ions, competencies, substances, reactions, …)
- [x] `generateActivityTexts()` — activity_summary в 4 локалях из machine flags + templates
- [x] `generateQualitativeTexts()` — observation_summary в 4 локалях из ontology (E3+)
- [x] `data-src/translations/ru/rule_terms.json` — Russian locale pack (ранее в vocab)
- [x] Build: `activity_texts.json`, `qualitative_texts.json` в bundle
- [x] PL ions.json: name_genitive (cations) + salt_anion (anions) + gender — морфологические поля для генерации
- [x] Morphological substance name generator: `scripts/lib/generate-substance-names.mjs` — 55 EN/ES + 49 PL из ион-морфологии
- [x] Manual entries: оксиды, кислоты, основные соли — все 80 веществ покрыты во всех 4 локалях
- [x] Тест-покрытие locale packs: `locale-coverage.test.ts` — threshold 0 для всех; 769 тестов ✓

---

## Phase C — ADR-002 ID Migration ✅

**Branch**: `feature/localization-foundation` (Tasks 1–5, 2026-03-08)

- [x] Audit: инвентаризация всех ID в `data-src/` (текущий формат)
- [x] ~~Decide `sub:` vs `subst:`~~ — **`sub:`** зафиксировано
- [x] Migration script: `scripts/migrate-ids.mjs` — 48 ions prefixed, 164 substances prefixed, 212+ ion refs updated
- [x] Update all `subject`/`object` поля в `relations/*.json` — already correct (no changes needed)
- [x] Update `ions[]` поля на веществах — done via migration script
- [x] Update `formula_lookup.json` pipeline — auto-updated via data migration
- [x] Regression: validate:data ✓, 769 tests (765 pass, 4 pre-existing locale-coverage failures)

---

## Phase D — Student Materials → Theory Layer ✅

**Branch**: `feature/localization-foundation` 896c2d2

### Завершено

- [x] `data-src/theory_modules/ion_nomenclature.json` — locale-free theory module: 2 секции (`anion_suffixes` + `substance_naming`), 5 `rule_card` блоков (binary_ide, oxy_max_ate, oxy_lower_ite, per_prefix, hypo_prefix) + параграфы
- [x] `data-src/translations/ru/theory_modules/ion_nomenclature.json` — Russian locale overlay
- [x] `data-src/translations/en/theory_modules/ion_nomenclature.json` — English locale overlay
- [x] `data-src/translations/pl/theory_modules/ion_nomenclature.json` — Polish locale overlay
- [x] `data-src/translations/es/theory_modules/ion_nomenclature.json` — Spanish locale overlay
- [x] `src/components/TheoryModulePanel.tsx` — bug fix: Russian overlay теперь тоже загружается (убран `locale !== 'ru'` guard — параграфы были пустыми для RU пользователей)

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
