# Универсальный presentation layer для онтологии
## Спецификация хранения кратких, обычных и полных форм отображения

**Статус:** proposal  
**Назначение:** описать универсальный подход к хранению нескольких форм представления одной и той же сущности в онтологии, чтобы в зависимости от контекста можно было генерировать:
- краткую форму,
- обычную форму,
- формальную/полную форму,
- а при необходимости — морфологически согласованную форму внутри фразы.

---

## 1. Проблема

Для одной и той же сущности часто нужны разные способы отображения.

### Пример
Для типа кристаллической решётки:

- кратко в таблице: **ионная**
- обычно в тексте: **ионная решётка**
- формально в glossary/документации: **ионный тип кристаллической решётки**

Если хранить только одну строку `name`, то она неизбежно будет:
- либо слишком длинной для таблиц,
- либо слишком короткой для определений,
- либо неудобной для генерации текста.

---

## 2. Главный принцип

> Смысл живёт в ontology ref.  
> Языковая реализация живёт в localization/presentation layer.  
> Выбор формы делает renderer/generator по контексту.

То есть:
- одна сущность;
- несколько presentation forms;
- контекстно-зависимый выбор формы;
- optional morphology-aware generation.

---

## 3. Базовая модель

### 3.1. Core ontology
В core только canonical ref и структура:

```text
concept:ionic_crystal_lattice_type
parent: concept:crystal_lattice_type
```

В core **не должно** быть языковых строк.

---

## 4. Presentation layer

Для каждой displayable сущности в localization layer следует хранить минимум три основных формы:

- `name_short`
- `name`
- `name_formal`

### 4.1. `name_short`
Краткая форма для:
- таблиц,
- фильтров,
- chips,
- компактных списков,
- плотных UI.

### 4.2. `name`
Обычная форма для:
- inline текста,
- заголовков,
- карточек,
- стандартного отображения.

### 4.3. `name_formal`
Формальная или полная форма для:
- glossary,
- ontology docs,
- определений,
- диагностических сообщений,
- строгой документации.

---

## 5. Минимальный формат

```json
{
  "concept:ionic_crystal_lattice_type": {
    "name_short": "ионная",
    "name": "ионная решётка",
    "name_formal": "ионный тип кристаллической решётки"
  }
}
```

Это уже даёт хороший baseline.

---

## 6. Расширенный формат

Для более сильной генерации стоит хранить presentation как набор режимов.

```json
{
  "concept:ionic_crystal_lattice_type": {
    "presentations": {
      "short": "ионная",
      "default": "ионная решётка",
      "formal": "ионный тип кристаллической решётки"
    }
  }
}
```

Можно также поддержать дополнительные режимы:

- `heading`
- `glossary`
- `table_cell`
- `chip`
- `inline`
- `definition`
- `tooltip`

---

## 7. Render modes

Рекомендуемый универсальный набор render modes:

```ts
type PresentationMode =
  | "short"
  | "default"
  | "formal"
  | "heading"
  | "inline"
  | "table_cell"
  | "chip"
  | "definition"
  | "glossary"
  | "tooltip";
```

### Базовое соответствие
- `table_cell` → `short`
- `chip` → `short`
- `inline` → `default`
- `heading` → `default`
- `definition` → `formal`
- `glossary` → `formal`
- `tooltip` → `default` или `formal`, в зависимости от UX

---

## 8. Morphology-aware expansion

Если система должна не просто показывать label, а вставлять сущность внутрь фразы, нужен morphology layer.

### Зачем
Например, в русском надо получать:
- ионная решётка
- ионной решётки
- ионную решётку

А не просто всегда одну строку.

### Что хранить
- lemma
- part of speech
- gender
- number behavior
- declension / inflection class
- irregular forms
- agreement behavior
- phrase construction pattern

---

## 9. Пример morphology-aware representation

```json
{
  "concept:ionic_crystal_lattice_type": {
    "presentations": {
      "short": "ионная",
      "default": "ионная решётка",
      "formal": "ионный тип кристаллической решётки"
    },
    "morphology": {
      "pos": "adjective_or_adj_phrase",
      "agreement": {
        "gender": true,
        "number": true,
        "case": true
      },
      "forms": {
        "nom_sg_fem": "ионная",
        "gen_sg_fem": "ионной",
        "dat_sg_fem": "ионной",
        "acc_sg_fem": "ионную",
        "ins_sg_fem": "ионной",
        "prep_sg_fem": "ионной"
      },
      "head_nouns": {
        "default": "решётка",
        "formal": "тип кристаллической решётки"
      }
    }
  }
}
```

---

## 10. Ещё более универсальный вариант

Чтобы не привязываться к одному частному примеру, полезно разделять:

### 10.1. Lexical base
Лексическая единица:
- lemma
- part of speech
- morphology

### 10.2. Named presentation constructions
Способы собрать phrase из этой сущности:
- short
- default
- formal

### 10.3. Context policy
Какой construction выбирать в каком контексте.

---

## 11. Универсальная схема

```json
{
  "entity_ref": "concept:ionic_crystal_lattice_type",
  "labels": {
    "short": "ионная",
    "default": "ионная решётка",
    "formal": "ионный тип кристаллической решётки"
  },
  "morphology": {
    "kind": "adj_phrase",
    "features": {
      "agreement": ["gender", "number", "case"]
    }
  },
  "presentation_policy": {
    "table_cell": "short",
    "chip": "short",
    "inline": "default",
    "heading": "default",
    "definition": "formal",
    "glossary": "formal"
  }
}
```

---

## 12. Когда этого достаточно, а когда нет

### Достаточно
Если нужно:
- компактный UI,
- таблицы,
- cards,
- glossary,
- headings,
- tooltips,
- basic text generation.

### Недостаточно
Если нужно:
- сложное синтаксическое встраивание в длинные предложения;
- language-specific rhetorical restructuring;
- stylistically rich didactic prose.

Тогда дополнительно нужны:
- templates
- morphology
- optional locale overrides

---

## 13. Какие сущности особенно нуждаются в таком подходе

Ниже — список основных кандидатов, для которых one-label model обычно недостаточна.

### 13.1. Типы кристаллических решёток
Примеры:
- ионная
- ионная решётка
- ионный тип кристаллической решётки

### 13.2. Типы химической связи
Примеры:
- ионная
- ионная связь
- ионный тип химической связи

- ковалентная полярная
- ковалентная полярная связь
- полярный ковалентный тип химической связи

### 13.3. Характеристики материалов
Примеры:
- хрупкость
- высокая хрупкость
- характеристика хрупкости материала

- пластичность
- высокая пластичность
- характеристика пластичности материала

### 13.4. Фазовые состояния
Примеры:
- твёрдая
- твёрдая фаза
- твёрдое агрегатное состояние вещества

- газообразная
- газовая фаза
- газообразное агрегатное состояние

### 13.5. Типы процессов
Примеры:
- плавление
- процесс плавления
- фазовый переход типа плавления

- сублимация
- процесс сублимации
- фазовый переход типа сублимации

### 13.6. Законы и уравнения
Примеры:
- закон Гука
- уравнение Клапейрона
- уравнение Клаузиуса–Клапейрона

Здесь могут понадобиться:
- краткая форма
- стандартное название
- формальная полная форма
- symbolic label

### 13.7. Количественные величины
Примеры:
- температура
- температура плавления
- стандартная температура плавления
- энтальпия
- изменение энтальпии
- стандартная энтальпия образования

### 13.8. Константы
Примеры:
- число Авогадро
- постоянная Больцмана
- газовая постоянная

Им часто нужен набор:
- human label
- symbolic form (`N_A`, `k_B`, `R`)
- formal expanded name

### 13.9. Классы веществ
Примеры:
- металл
- металлы
- металлический элемент
- класс металлических веществ

- неметалл
- неметаллы
- неметаллический элемент

### 13.10. Роли частиц
Примеры:
- катион
- анион
- положительно заряженный ион
- отрицательно заряженный ион

### 13.11. Типы растворов и сред
Примеры:
- раствор
- водный раствор
- расплав
- газовая фаза
- реакционная среда

### 13.12. Didactic headings and generated section titles
Например одна и та же сущность может рендериться как:
- heading
- inline mention
- tooltip label
- table category
- glossary entry

---

## 14. Какие сущности обычно не требуют такого слоя

Чаще всего one-label model достаточно для:

- химических формул как символов;
- очень стабильных собственных имён;
- некоторых element symbols;
- служебных технических ids;
- внутренних predicates/relations, не показываемых пользователю напрямую.

Но даже там иногда нужен display alias.

---

## 15. Рекомендуемый минимальный стандарт

Для всех сущностей, которые пользователь видит напрямую, рекомендовать минимум:

- `name_short`
- `name`
- `name_formal`

Для сущностей, участвующих в генерации текста, дополнительно:

- `morphology`
- `presentation_policy`

Для сложной генерации:

- `construction metadata`
- `templates`
- optional locale overrides

---

## 16. Пример набора для lattice types

```json
{
  "concept:ionic_crystal_lattice_type": {
    "name_short": "ионная",
    "name": "ионная решётка",
    "name_formal": "ионный тип кристаллической решётки"
  },
  "concept:molecular_crystal_lattice_type": {
    "name_short": "молекулярная",
    "name": "молекулярная решётка",
    "name_formal": "молекулярный тип кристаллической решётки"
  },
  "concept:atomic_crystal_lattice_type": {
    "name_short": "атомная",
    "name": "атомная решётка",
    "name_formal": "атомный тип кристаллической решётки"
  },
  "concept:metallic_crystal_lattice_type": {
    "name_short": "металлическая",
    "name": "металлическая решётка",
    "name_formal": "металлический тип кристаллической решётки"
  }
}
```

---

## 17. Рекомендуемый API renderer/generator

```ts
renderEntityLabel(ref, {
  locale: "ru",
  mode: "short"
})

renderEntityLabel(ref, {
  locale: "ru",
  mode: "default"
})

renderEntityLabel(ref, {
  locale: "ru",
  mode: "formal"
})
```

Для morphology-aware режима:

```ts
renderEntityForm(ref, {
  locale: "ru",
  mode: "default",
  case: "gen",
  number: "sg",
  gender: "fem"
})
```

---

## 18. Практическая рекомендация

### Принять следующий подход
1. В core держать только ref и структуру.
2. В localization держать presentation variants.
3. Для displayable сущностей ввести минимум:
   - `name_short`
   - `name`
   - `name_formal`
4. Для генерации текста добавить morphology.
5. Выбор формы вынести в renderer/generator.

### Главная формула
> Одна сущность может иметь несколько корректных способов называния.  
> Выбор способа называния зависит от контекста, а не от самой сущности.

---

## 19. Короткий summary

Правильный универсальный подход:

- один canonical ontology ref;
- несколько presentation forms;
- отдельный morphology layer;
- context-aware renderer.

Этот подход особенно нужен для:
- lattice types,
- bond types,
- material characteristics,
- phases,
- laws,
- quantities,
- constants,
- substance classes,
- generated didactic headings.
