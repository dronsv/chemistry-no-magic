# Предложение по разделению ontology, translations и didactic materials
## Working draft for project architecture

**Статус:** proposal  
**Назначение:** зафиксировать целевую архитектуру хранения онтологии, переводов сущностей и дидактического контента.

---

## 1. Проблема

Сейчас в проекте смешиваются три разных типа данных:

1. **Ontology / canonical knowledge**
   - concepts
   - substances
   - ions
   - reactions
   - quantities
   - laws
   - relations
   - characteristics

2. **Entity translations / overlays**
   - имена сущностей
   - slug
   - aliases
   - surface forms
   - краткие справочные описания

3. **Didactic content**
   - учебные объяснения
   - theory modules
   - rule cards
   - comparison tables
   - authorial prose
   - локализованный RichText со ссылками на онтологию

Проблема в том, что дидактический контент сейчас частично живёт в `translations/`, хотя по смыслу это **не переводы сущностей**, а **самостоятельный учебный материал**.

---

## 2. Базовый принцип

Нужно развести три слоя:

### A. Ontology core
Хранит только структурные, языконезависимые сущности и связи.

### B. Entity translations / overlays
Хранит только то, что нужно для локализации и поиска сущностей.

### C. Didactic materials
Хранит локализованный учебный контент, связанный с онтологией через явные refs.

---

## 3. Ключевое правило

> `translations/` содержит только локализацию онтологических сущностей и минимальные справочные данные.  
> `didactic/` содержит авторский учебный контент, локализованный по языкам и связанный с онтологией через явные refs.

Это и есть целевая граница между слоями.

---

## 4. Что считается translation overlay

### В translations должно жить
- `name`
- `slug`
- `aliases`
- `surface_forms`
- morphology-aware forms
- краткое справочное `description`, если оно относится именно к сущности

### В translations не должно жить
- длинное учебное объяснение темы
- модульная theory prose
- описание, привязанное к конкретной странице курса
- таблицы сравнения
- авторские rule cards
- курс-специфичная подача материала

---

## 5. Что считается didactic material

Didactic material — это:

- theory modules
- учебные объяснения
- comparison tables
- rule cards
- contextual examples
- long-form RichText
- material tied to a lesson, module, curriculum level, or authoring context

Главная особенность didactic materials:

- они могут содержать refs на ontology entities;
- они могут по-разному объяснять один и тот же concept в разных курсах;
- они не обязаны быть “переводом сущности”;
- их lifecycle отличается от lifecycle ontology core и translations.

---

## 6. Предлагаемая структура каталогов

### 6.1. Ontology core
```text
data-src/
  concepts.json
  substances/
  ions/
  reactions/
  quantities/
  laws/
  characteristics/
  ...
```

### 6.2. Entity translations
```text
data-src/translations/
  ru/
    concepts.json
    substances.json
    ions.json
    reactions.json
    quantities.json
    laws.json
    ...
  en/
  pl/
  es/
```

### 6.3. Didactic materials
```text
data-src/didactic/
  ru/
    bonds_and_crystals.json
    acids_and_bases.json
    ...
  en/
  pl/
  es/
```

### 6.4. Structural skeleton of theory modules
```text
data-src/theory_modules/
  bonds_and_crystals.json
  acids_and_bases.json
  ...
```

---

## 7. Роль `theory_modules/`

`theory_modules/` должен хранить **структурный skeleton**, а не локализованный prose-контент.

### В `theory_modules/*.json` должно жить
- `module_id`
- block order
- block ids
- block types
- stable anchors
- `anchor_ref` / `concept_ref` where relevant
- structural metadata

### В `theory_modules/*.json` не должно жить
- локализованный текст
- длинные описания
- учебные пояснения
- rich localized content
- locale-specific prose

---

## 8. Роль `didactic/{locale}/`

`didactic/{locale}/` хранит **реальный учебный контент**.

### Там должно жить
- title blocks
- RichText body
- rule text
- educational explanations
- local tables
- contextual notes
- curated examples
- refs to ontology entities

### Формат
Желательно хранить как:
- RichText segments
- structured block payloads
- explicit refs
- stable mapping to block ids from skeleton

---

## 9. Пример разделения

### 9.1. Structural skeleton
`data-src/theory_modules/bonds_and_crystals.json`

```json
{
  "id": "bonds_and_crystals",
  "blocks": [
    {
      "id": "ionic_bond_card",
      "type": "concept_card",
      "anchor_ref": "concept:ionic_bond"
    },
    {
      "id": "lattice_comparison_table",
      "type": "comparison_table",
      "anchor_ref": "concept:crystal_lattice"
    }
  ]
}
```

### 9.2. Didactic content
`data-src/didactic/ru/bonds_and_crystals.json`

```json
{
  "module_id": "bonds_and_crystals",
  "blocks": {
    "ionic_bond_card": {
      "title": [
        { "t": "ref", "id": "concept:ionic_bond", "v": "Ионная связь" }
      ],
      "rule": [
        { "t": "text", "v": "Школьное правило: Δχ ≥ 1,7 ..." }
      ],
      "body": [
        { "t": "text", "v": "Связь между " },
        { "t": "ref", "id": "substance_class:metal", "v": "металлом" },
        { "t": "text", "v": " и " },
        { "t": "ref", "id": "substance_class:nonmetal", "v": "неметаллом" },
        { "t": "text", "v": " за счёт " },
        { "t": "ref", "id": "concept:electron_transfer", "v": "переноса электронов" }
      ]
    }
  }
}
```

### 9.3. Entity translation overlay
`data-src/translations/ru/concepts.json`

```json
{
  "concept:ionic_bond": {
    "name": "Ионная связь",
    "slug": "ionnaya-svyaz",
    "aliases": ["ионная химическая связь"],
    "surface_forms": ["ионная связь", "ионной связи", "ионную связь"],
    "description": "Тип химической связи, основанный на электростатическом притяжении противоположно заряженных ионов."
  }
}
```

---

## 10. Почему это лучше

### 10.1. Один concept может иметь много объяснений
Один и тот же `concept:ionic_bond` может иметь:
- краткое справочное описание;
- школьное объяснение;
- олимпиадное объяснение;
- физико-химическое объяснение;
- материаловедческий контекст.

Эти вещи нельзя смешивать в одном translation overlay.

### 10.2. Дидактика имеет свой lifecycle
Didactic content:
- меняется чаще;
- зависит от автора;
- зависит от курса;
- зависит от уровня;
- зависит от соседних блоков;
- должен рендериться как document-like structure.

### 10.3. Build-time validation становится чище
Если didactic content хранится отдельно:
- можно отдельно валидировать RichText refs;
- можно отдельно валидировать skeleton;
- можно отдельно валидировать translations completeness;
- меньше semantic noise в translations layer.

### 10.4. Легче строить multi-course architecture
Один ontology core + разные didactic modules:
- школьный курс
- углублённый курс
- олимпиадный курс
- курс для физики материалов
- международные версии курса

---

## 11. Что делать с ChemText

`ChemText` следует считать **legacy / fallback layer**, а не целевой архитектурой.

### Было
- runtime scanning plain text
- formula detection on the fly
- heuristic wrapping

### Целевой режим
- pre-annotated RichText
- explicit refs
- build-time validation
- controlled linking
- ontology-aware rendering

### Рекомендуемая роль ChemText дальше
- backward compatibility
- migration helper
- legacy renderer for old blocks only

---

## 12. Renderer responsibilities

### 12.1. Loader
Loader должен:

1. загрузить structural skeleton из `theory_modules/`
2. загрузить localized didactic content из `didactic/{locale}/`
3. смержить их по `module_id + block_id`
4. отрендерить unified module structure

### 12.2. RichText renderer
Должен уметь:
- text segments
- ref segments
- formula segments
- embedded ontology blocks
- tables / structured cells
- build-time validated refs

### 12.3. Legacy fallback
Если для блока нет didactic content:
- можно временно использовать старый plain-text path
- но это только migration fallback, не целевая модель

---

## 13. Migration strategy

### Phase 1
Ввести новый каталог:
```text
data-src/didactic/{locale}/
```

### Phase 2
Обновить loader/pipeline:
- skeleton load
- didactic load
- merge by block ids

### Phase 3
Сделать пилот на `bonds_and_crystals`

### Phase 4
Оставить backward compatibility:
- old path still works
- new path preferred

### Phase 5
Постепенно перевести остальные theory modules

### Phase 6
Постепенно вывести `ChemText` из основной цепочки рендера

---

## 14. Что важно не делать

### Не надо
- держать дидактику в `translations/`
- смешивать entity description и course prose
- держать rich educational content в entity overlay files
- пытаться решить всё runtime-scanning'ом
- делать `ChemText` основным long-term renderer

### Надо
- сделать отдельный didactic layer
- хранить учебный контент как structured RichText
- валидировать refs build-time
- отделить structure от localized course content
- сохранить locale-free ontology core

---

## 15. Итоговая рекомендация

### Принять следующую целевую модель
- `data-src/theory_modules/` — structural skeleton
- `data-src/didactic/{locale}/` — localized didactic content
- `data-src/translations/{locale}/` — entity overlays only

### Принять следующее правило
> Дидактика — это не перевод.  
> Дидактика — это самостоятельный локализованный курс-специфичный контент, связанный с онтологией через явные refs.

### Практический первый шаг
Сделать `bonds_and_crystals` пилотом новой архитектуры и через него проверить:
- формат блока
- RichText refs
- build validation
- merge loader
- migration path for remaining modules

---

## 16. Короткий summary

Правильное разделение такое:

### Ontology
Структурное знание.

### Translations
Локализация сущностей.

### Didactic
Локализованный учебный контент.

Это устраняет текущую архитектурную путаницу и создаёт хорошую основу для:
- ontology-first authoring,
- richer theory modules,
- multi-course growth,
- build-time validation,
- controlled migration away from legacy `ChemText`.
