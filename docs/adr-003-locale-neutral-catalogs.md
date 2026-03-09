# ADR-003: Explanatory Catalogs Must Be Locale-Neutral

**Дата**: 2026-03-09
**Статус**: Accepted
**Контекст**: Architecture review — `physical_foundations_ontology_package.zip`

---

## Контекст

ADR-001 установил: `data-src/` core files не содержат естественного языка.
ADR-002 установил: все entity ID используют namespaced prefix (`sub:`, `ion:`, `el:`, `ion:` и т.д.).

Оба правила применялись к **domain facts** (elements, ions, substances, rules, relations).

Теперь вводится новый слой — **explanatory catalogs**:

- `physical_concepts.json`
- `math_concepts.json`
- `mechanisms.json`
- `bridge_explanations.json`
- `group_definitions.json`
- `electron_exception_frames.json`

При review `physical_foundations_ontology_package.zip` обнаружена архитектурная ошибка в примерах:
поля `physical_concept.summary` и `mechanism.statement` содержали inline Russian text, нарушая ADR-001.

Та же проблема существует в `data-src/rules/energy_catalyst_theory.json` (поля с RU prose).

---

## Решение

**Все новые explanatory catalog source files в `data-src/` должны быть locale-neutral.**

### Разрешено в source JSON

| Тип | Примеры |
|-----|---------|
| Namespaced IDs и ссылки | `phys:temperature`, `mech:absorption_causes_upward_transition` |
| Перечисления (enums) | `kind: "physical_concept"`, `domain: "thermal"` |
| Структурные массивы | `requires_concepts[]`, `mechanism_sequence[]`, `target_anchors[]` |
| Числовые метаданные | `difficulty_level: 1`, `ordering: 3` |
| Frame key references | `summary_frame_id: "phys.temperature.summary"` |
| Anchor IDs | `anchors: ["temperature", "thermal-motion"]` |
| Короткие display names | `labels: { ru: "температура", en: "temperature" }` — только для proper nouns, не prose |

### Запрещено в source JSON

| Тип | Признаки |
|-----|---------|
| Inline explanatory prose | Любой `string` длиннее ~30 символов в объяснительных полях |
| Localized display strings | Поля типа `summary`, `statement`, `definition` с natural language |
| Pedagogical text | Любые обучающие предложения/абзацы |

---

## Корректные шаблоны

### PhysicalConcept: было → стало

```json
// ❌ Нарушение ADR-003 — inline RU prose
{
  "id": "phys:temperature",
  "summary": "Величина, связанная со средней кинетической энергией частиц."
}

// ✅ Корректно — frame key references
{
  "id": "phys:temperature",
  "kind": "physical_concept",
  "domain": "thermal",
  "labels": { "ru": "температура", "en": "temperature", "pl": "temperatura", "es": "temperatura" },
  "definition_frame_id": "phys.temperature.definition",
  "summary_frame_id": "phys.temperature.summary",
  "chemistry_relevance_frame_id": "phys.temperature.chemistry_relevance",
  "math_prereqs": ["math:average", "math:graph_reading"],
  "related_concepts": ["phys:thermal_motion", "phys:collision"],
  "anchors": ["temperature"]
}
```

### Mechanism: было → стало

```json
// ❌ Нарушение ADR-003
{
  "id": "mech:temperature_increases_particle_speed",
  "statement": "Рост температуры увеличивает среднюю скорость частиц."
}

// ✅ Корректно — per-variant frame keys
{
  "id": "mech:temperature_increases_particle_speed",
  "kind": "causal_mechanism",
  "statement_frame_id": "mech.temperature_increases_particle_speed.statement",
  "school_frame_id": "mech.temperature_increases_particle_speed.school",
  "strict_frame_id": "mech.temperature_increases_particle_speed.strict",
  "inputs": ["phys:temperature"],
  "outputs": ["phys:kinetic_energy", "phys:collision_frequency"],
  "requires_concepts": ["phys:temperature", "phys:thermal_motion"]
}
```

### BridgeExplanation — без изменений

`bridge_explanation` уже хранит только IDs и `*_frame_id` — соответствует ADR-003.

### Labels vs prose

```json
// ✅ OK — короткое proper noun
"labels": { "ru": "температура", "en": "temperature" }

// ❌ Нарушение — explanatory prose в labels
"labels": { "ru": "величина, связанная со средней кинетической энергией...", "en": "a quantity..." }
```

---

## Правило валидатора

Добавить в `scripts/lib/validate.mjs`:

```javascript
const PROSE_BANNED_FIELDS_IN_CATALOGS = [
  'summary', 'statement', 'definition', 'description',
  'explanation', 'reason', 'cause', 'intuition'
];

const CATALOG_FILE_PATTERNS = [
  'physical_concepts', 'math_concepts', 'mechanisms',
  'bridge_explanations', 'group_definitions', 'selector_definitions'
];

export function validateExplanatoryCatalogLocaleNeutral(data, filename) {
  const errors = [];
  const basename = path.basename(filename, '.json');
  if (!CATALOG_FILE_PATTERNS.some(p => basename.includes(p))) return errors;
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    for (const field of PROSE_BANNED_FIELDS_IN_CATALOGS) {
      if (typeof item[field] === 'string' && item[field].length > 20) {
        errors.push(
          `${filename}: ${item.id ?? '?'} — inline prose in field '${field}'. ` +
          `Use '${field}_frame_id' referencing a frame catalog entry instead.`
        );
      }
    }
  }
  return errors;
}
```

Вызвать из `validateAll()` для каждого нового каталога.

---

## Последствия

### Новые файлы

Для каждого каталога нужен frame catalog file:

| Каталог | Frame файл | Locale overlays |
|---------|-----------|----------------|
| `physical_concepts.json` | `data-src/frames/physical_concepts_frames.json` | `translations/{locale}/frames/physical_concepts.json` |
| `mechanisms.json` | `data-src/frames/mechanisms_frames.json` | `translations/{locale}/frames/mechanisms.json` |
| `bridge_explanations.json` | `data-src/frames/bridge_explanations_frames.json` | `translations/{locale}/frames/bridge_explanations.json` |

### Существующие нарушения (план миграции)

| Файл | Нарушение | Когда исправить |
|------|-----------|----------------|
| `data-src/rules/energy_catalyst_theory.json` | RU prose fields | After locale routing on `/competency/[id]` |
| `physical_foundations_pkg/examples/*.json` (черновик) | Inline RU prose | Before WP1 implementation |

### Загрузчики

Паттерн загрузки: `loadPhysicalConcepts(locale)` = load source catalog → load frame catalog for locale → inject rendered fields. Аналогично `loadElements(locale)` + electron_exception frames (Phase F).

---

## Связь с другими ADR

| ADR | Правило | Применяется к |
|-----|---------|--------------|
| ADR-001 | No natural language in `data-src/` core | Domain facts (elements, rules, relations) |
| ADR-002 | Namespaced ID prefixes | Все entity IDs |
| **ADR-003** | No prose in explanatory catalogs; use `*_frame_id` | Physical concepts, mechanisms, bridge explanations, group definitions |

---

## Примечание о `labels`

`labels` как multilingual dict остаётся допустимым для **коротких display names** (proper nouns), потому что:
- это практически static display string, не prose
- используется для chip/badge labels, не для explanatory content
- аналог `symbol`, `name_latin` в elements

Для всего, что длиннее ~5 слов → `*_frame_id`.
