# Предложение по архитектуре semantic didactic layer + localization + morphology
## Working draft

**Статус:** proposal  
**Назначение:** зафиксировать целевую архитектуру, в которой существует один общий дидактический материал, а локализации содержат только минимум, нужный для перевода, морфологии и генерации текста на базе онтологии.

---

## 1. Цель

Цель этой архитектуры — уйти от модели, где каждый язык хранит собственную полную версию дидактического материала как независимый текстовый источник истины.

Вместо этого предлагается:

1. хранить **один общий didactic semantic layer**;
2. хранить отдельно **ontology core**;
3. хранить отдельно **минимальный localization layer**;
4. хранить отдельно **morphology layer**;
5. хранить отдельно **language templates**;
6. использовать **optional locale overrides** только там, где генерация не даёт хорошего результата.

---

## 2. Базовый принцип

### Было
- ontology core
- translations per locale
- didactic prose per locale

### Предлагается
- ontology core
- one shared semantic didactic layer
- localization layer
- morphology layer
- language template layer
- optional locale-specific didactic overrides

---

## 3. Ключевая идея

> Основной источник истины для дидактики должен быть **семантическим**, а не текстовым.

Это означает, что учебный материал должен храниться как:

- sequence of ideas
- explanation graph
- references to ontology entities
- didactic roles
- constraints on rendering
- emphasis / ordering / examples / comparison structures

А не как готовый prose на каждом языке.

---

## 4. Слои архитектуры

---

## 4.1. Ontology core

### Содержит
- concepts
- substances
- ions
- reactions
- quantities
- constants
- laws
- relations
- characteristics
- methods
- test methods
- trends
- patterns

### Свойства
- locale-free
- structured
- canonical
- reusable across disciplines and courses

---

## 4.2. Shared semantic didactic layer

### Назначение
Описывает **что именно нужно объяснить**, в каком порядке, через какие сущности и смысловые связи.

### Содержит
- module structure
- block semantics
- explanation steps
- ontology refs
- educational roles
- examples as refs
- comparison structures
- didactic intent
- optional generation hints

### Не содержит
- окончательный prose per locale
- языковую морфологию
- склонения
- согласование
- длинные локализованные тексты как primary source

### Пример
```json
{
  "module_id": "bonds_and_crystals",
  "blocks": [
    {
      "id": "ionic_bond_mechanism",
      "kind": "explanation_sequence",
      "subject_ref": "concept:ionic_bond",
      "steps": [
        {
          "role": "participants",
          "refs": ["substance_class:metal", "substance_class:nonmetal"]
        },
        {
          "role": "mechanism",
          "refs": ["concept:electron_transfer"]
        },
        {
          "role": "result",
          "refs": ["concept:cation", "concept:anion"]
        }
      ]
    }
  ]
}
```

---

## 4.3. Localization layer

### Назначение
Даёт минимальный набор языковых данных, достаточный для:
- label rendering,
- lookup,
- generation,
- explanation assembly.

### Содержит
- `name`
- `short_label`
- `slug`
- `aliases`
- `surface_forms`
- optional short fallback description
- optional lexical notes

### Не содержит
- полный didactic prose
- course-specific explanations
- long theory modules

### Пример
```json
{
  "concept:ionic_bond": {
    "name": "ионная связь",
    "short_label": "ионная связь",
    "slug": "ionnaya-svyaz",
    "aliases": ["ионная химическая связь"],
    "surface_forms": ["ионная связь", "ионной связи", "ионную связь"]
  }
}
```

---

## 4.4. Morphology layer

### Назначение
Обеспечивает грамматически корректную генерацию текста из ontology refs и semantic didactic scripts.

### Почему он нужен
Без morphology layer невозможно качественно генерировать:
- русский,
- польский,
- испанский,
- и другие языки с сильной флективностью.

### Содержит
Для каждой лексической единицы или multiword term:
- lemma
- part of speech
- gender
- number behavior
- declension / inflection class
- irregular forms
- agreement features
- multiword inflection strategy
- optional case forms
- optional syntactic constraints

### Пример
```json
{
  "concept:ionic_bond": {
    "lemma": "ионная связь",
    "pos": "noun_phrase",
    "gender": "fem",
    "inflection": {
      "nom_sg": "ионная связь",
      "gen_sg": "ионной связи",
      "dat_sg": "ионной связи",
      "acc_sg": "ионную связь",
      "ins_sg": "ионной связью",
      "prep_sg": "ионной связи"
    }
  }
}
```

---

## 4.5. Language template layer

### Назначение
Преобразует semantic didactic structures в текст конкретного языка.

### Содержит
- sentence templates
- paragraph templates
- comparison templates
- rule presentation templates
- table caption templates
- list templates
- grammar slot definitions
- generation strategies

### Пример
```json
{
  "template_id": "bond_mechanism_basic",
  "language": "ru",
  "pattern": [
    { "t": "text", "v": "Связь между " },
    { "t": "slot", "name": "participant_1", "case": "ins" },
    { "t": "text", "v": " и " },
    { "t": "slot", "name": "participant_2", "case": "ins" },
    { "t": "text", "v": " за счёт " },
    { "t": "slot", "name": "mechanism", "case": "gen" }
  ]
}
```

---

## 4.6. Optional locale-specific didactic overrides

### Назначение
Нужны только там, где генерация:
- звучит неестественно,
- требует идиоматической перестройки,
- должна учитывать культурно-учебную специфику,
- требует сильного stylistic rewrite.

### Принцип
Locale override — это не основной источник истины, а **исключение**.

### Содержит
- rewritten block
- override paragraph
- locale-specific example wording
- locale-specific educational framing

---

## 5. Что считается source of truth

### Primary source of truth
- ontology core
- semantic didactic layer

### Secondary language infrastructure
- localization
- morphology
- templates

### Exceptions only
- locale-specific didactic overrides

---

## 6. Предлагаемая структура каталогов

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

  didactic/
    semantic/
      bonds_and_crystals.json
      acids_and_bases.json
      thermodynamics_intro.json

  localization/
    ru/
      entities.json
      morphology.json
      templates.json
    en/
      entities.json
      morphology.json
      templates.json
    pl/
      entities.json
      morphology.json
      templates.json
    es/
      entities.json
      morphology.json
      templates.json

  didactic_overrides/
    ru/
      bonds_and_crystals.json
    en/
    pl/
    es/
```

---

## 7. Что хранить в semantic didactic layer

### Хранить
- block ids
- semantic block kind
- subject refs
- explanation steps
- example refs
- comparison refs
- ordering
- pedagogical role
- optional emphasis hints
- optional generation constraints

### Не хранить
- language-specific inflected text
- locale prose as main representation
- morphology
- declension forms
- translation-only data

---

## 8. Что хранить в localization/entities

### Хранить
- canonical display label
- short label
- aliases
- slug
- lookup forms
- optional short fallback description

### Не хранить
- full lesson text
- rich contextual educational prose
- block-specific explanation

---

## 9. Что хранить в morphology

### Для noun-like terms
- gender
- number
- case forms
- irregular patterns

### Для adjective-like terms
- agreement behavior
- comparative handling if needed
- predicate/adnominal usage if relevant

### Для multiword terms
- head word
- inflection strategy
- frozen vs inflectable components
- agreement behavior

### Для symbols and mixed forms
- whether they are indeclinable
- whether surrounding nouns need generation support

---

## 10. Что хранить в templates

### Templates должны задавать
- sentence skeleton
- slot names
- grammatical case requirements
- agreement hints
- optional fallback patterns
- paragraph composition rules

### Хорошие template roles
- definition sentence
- mechanism explanation
- property list lead-in
- comparison sentence
- rule statement
- example introduction
- process description
- cause-effect explanation

---

## 11. Как будет работать генерация

### Step 1
Из ontology core и semantic didactic layer выбираются:
- subject
- steps
- refs
- examples
- relationships

### Step 2
Для каждого ref подтягиваются:
- localization data
- morphology data

### Step 3
Выбирается language template.

### Step 4
Slot filling делает:
- inflection
- agreement
- lexical substitution
- sentence assembly

### Step 5
Если есть locale override — он может заменить generated block.

### Step 6
Результат идёт в RichText/document renderer.

---

## 12. Почему это лучше

### 12.1. Один смысл — много языков
Одна semantic didactic structure может быть выражена:
- по-русски,
- по-английски,
- по-польски,
- по-испански

без дублирования авторского смысла.

### 12.2. Меньше drift между языками
Если исходный смысл один, то языки перестают расходиться так легко.

### 12.3. Лучше поддержка генерации
Можно строить:
- краткие объяснения
- полные объяснения
- карточки
- списки
- таблицы
- адаптацию уровня сложности

из одного semantic source.

### 12.4. Лучше совместимость с ontology-first authoring
Потому что дидактика выражена через refs и semantic roles, а не через свободный prose.

### 12.5. Легче поддерживать многопредметность
Если потом появятся:
- физика,
- биология,
- материаловедение,
- математика,

эта модель переносится гораздо лучше, чем full-prose-per-locale.

---

## 13. Что может быть сложным

### 13.1. Морфология — это не бесплатный слой
Особенно для:
- русского,
- польского,
- multiword terms,
- сложных научных словосочетаний.

### 13.2. Не весь didactic prose хорошо редуцируется к шаблонам
Некоторые тексты:
- слишком авторские,
- слишком стилистические,
- слишком богаты риторически.

Для них нужны locale overrides.

### 13.3. Нужно аккуратно проектировать templates
Слишком бедные templates дадут деревянный текст.
Слишком сложные templates превратятся в почти полноценный NLG language.

---

## 14. Практическая рекомендация

### Не пытаться сразу генерировать всё
Лучше разделить didactic blocks по уровням генеративности:

#### Level 1 — fully generated
Подходят:
- определения
- краткие описания
- rule statements
- example intros
- simple comparisons

#### Level 2 — generated with optional override
Подходят:
- mechanism explanations
- property summaries
- structured tables
- mid-length educational paragraphs

#### Level 3 — handcrafted override preferred
Подходят:
- большие объяснительные тексты
- narrative introductions
- stylistically rich theory passages
- author-specific pedagogy

---

## 15. Рекомендуемая migration strategy

### Phase 1
Ввести новый semantic didactic format для 1 пилотного модуля.

### Phase 2
Ввести localization/entities + morphology + templates для 1–2 языков.

### Phase 3
Сделать генерацию:
- titles
- short definitions
- rule cards
- simple explanation blocks

### Phase 4
Оставить locale overrides для сложных блоков.

### Phase 5
Постепенно переводить другие модули.

---

## 16. Минимальный пилот

Для модуля `bonds_and_crystals` можно сначала сделать semantic representation для:

- ionic bond
- covalent polar bond
- covalent nonpolar bond
- metallic bond
- crystal lattice comparison table

А language generation включить только для:
- title
- short mechanism sentence
- examples intro
- property lead-in

---

## 17. Итоговая рекомендация

### Принять следующую модель
- один общий semantic didactic layer;
- минимум language-specific данных в localization;
- morphology как отдельный слой;
- language templates как отдельный слой;
- locale-specific didactic overrides только по необходимости.

### Главная формула архитектуры
> Didactic meaning is shared.  
> Language realization is localized.

---

## 18. Короткий summary

Правильное направление такое:

### Ontology core
Структурное знание.

### Semantic didactic layer
Общий смысловой учебный сценарий.

### Localization layer
Минимальные лексические данные для сущностей.

### Morphology layer
Склонение, согласование, инфлексия.

### Template layer
Языковая сборка текста.

### Overrides
Только там, где генерации недостаточно.

Это даёт:
- один общий учебный смысловой слой;
- меньше дублирования между языками;
- лучшую совместимость с ontology-first authoring;
- хорошую основу для генерации текста из онтологии.
