# Transformation Plan — Chemistry Without Magic

> Живой план преобразований онтологии, локализации и архитектуры.
> Закрываем пункты по мере выполнения. Последнее обновление: 2026-03-07.

---

## Статус фаз

| Фаза | Название | Статус | Ветка/Коммит |
|------|----------|--------|--------------|
| **A** | Locale-Free Core + Relations Layer | ✅ Done | `feature/locale-free-ontology` a8ef33f |
| **B1** | Controlled Rule Text Generation | ✅ Done | `feature/locale-free-ontology` 1ee8966 |
| **B1.5** | Projection / Facet Integration | ✅ Done | `feature/locale-free-ontology` 0c8b3c6 |
| **B** | Relations Expansion | ✅ Done | `feature/locale-free-ontology` 8fa321f |
| **C** | ADR-002 ID Migration (`sub:` everywhere) | 🔲 Deferred | — |
| **D** | Student Materials → Theory Layer | 🔲 Deferred | — |

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

- [ ] Push `feature/locale-free-ontology` → PR → merge to master

---

## Phase B1 — Controlled Rule Text Generation ✅

**Spec**: `docs/phase_b1_controlled_rule_text_generation.md`

**Принцип**: Tier 1 rule summaries генерируются из структурных данных + vocab + templates.
Ручной текст разрешён только как `pedagogical_note` override.

### Шаги

- [ ] **Data: applicability_rules** — добавить `rule_kind`, `reactant_pattern`, `conditions[]`, `product_template`, `exceptions[]` в `data-src/rules/applicability_rules.json` (15 правил)
- [ ] **Data: activity_series** — добавить машиночитаемые флаги (`reduces_H_from_acid`, `reduces_H_from_water`, `displacement_below`) в `data-src/rules/activity_series.json`
- [ ] **Vocab**: создать `data-src/vocab/rule_terms.json` — typed vocab per locale (~50-100 terms: condition:heating, class:metal_hydroxide.insoluble.plural, product_template:metal_oxide, ...)
- [ ] **Templates**: создать `data-src/templates/rule_summary_templates.json` — шаблоны per `rule_kind` × locale
- [ ] **Generator**: реализовать `scripts/generate-rule-texts.mjs` — читает core + vocab + templates, генерирует summaries
- [ ] **Build integration**: вызов генератора в `scripts/build-data.mjs`, output в `public/data/{hash}/generated/`
- [ ] **Validator**: запрет `condition_ru`/`description_ru` в Tier 1 файлах; проверка наличия структурных полей
- [ ] **Loader**: `loadGeneratedRuleText(ruleId, locale)` в `src/lib/data-loader.ts`
- [ ] **Locale packs**: убрать `applicability_rules` и `activity_series` из ручных ru overlay (заменить генерацией); оставить только `pedagogical_note` override где нужно
- [ ] **knowledge_level**: добавить опциональный `knowledge_level` + `source_kind` в relation schema (`strict_chemistry` | `school_convention` | `pedagogical`)
- [ ] **Tests**: покрытие генератора (детерминированность, корректность для каждого из 15 правил)

---

## Phase B1.5 — Projection / Facet Integration 🔲

- [ ] Ввести `projection_builder` слой: generated texts потребляются через projections, не напрямую страницами
- [ ] `rule_summary_projection` — per locale, агрегирует canonical_summary + exception_note
- [ ] `observation_facet_projection` — gas evolution, precipitate, color → human-readable per locale
- [ ] Задокументировать data flow: generated JSON → projection builder → page component
- [ ] Запретить прямое чтение `generated/` файлов в page компонентах (lint rule или документальный контракт)

---

## Phase B — Relations Expansion 🔲

- [ ] `data-src/relations/forms_salt_with.json` — cation ↔ anion пары (из solubility data)
- [ ] `data-src/relations/has_naming_rule.json` — ion → suffix_rule.id маппинг
- [ ] `instance_of` / `subclass_of` — классификационный граф (интеграция с `class`/`subclass` на веществах)
- [ ] Validator: проверка что все `subject`/`object` ID существуют в онтологии (ID integrity)
- [ ] TypeScript тип `Relation` — добавить в `src/types/`
- [ ] Task engine generators: использовать граф для задач типа "найди кислотный остаток" / "назови кислоту"
- [x] ~~Resolve `sub:` vs `subst:`~~ — **решено: `sub:`**. Валидатор Phase B запрещает `subst:`.

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
