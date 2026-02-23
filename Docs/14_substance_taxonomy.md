# 14. Таксономия веществ и архитектура поиска

## Принцип: «ID внутри, локаль снаружи»

В данных хранятся только коды (`type`, `class`, `subclass`).
UI-лейблы — в Paraglide (`taxonomy.type.simple` → "Простые").
Контентные названия веществ (`name_ru`, `synonyms`) — в JSON данных, т.к. участвуют в поиске.

---

## 1. Каноническая таксономия

**Файл**: `data-src/dictionaries/taxonomy.json`

Единственный источник правды для допустимых кодов type/class/subclass.

### Иерархия типов

```
simple (Простые вещества)
└── simple_substance
    ├── metal
    ├── nonmetal
    ├── noble_gas
    └── allotrope

inorganic (Неорганические)
├── oxide
│   ├── basic
│   ├── acidic
│   ├── amphoteric
│   └── indifferent
├── acid
│   ├── oxygen_containing
│   └── oxygen_free
├── base
│   ├── soluble
│   ├── insoluble
│   └── amphoteric
├── salt
│   ├── normal
│   ├── acidic
│   └── basic
└── other_inorganic
    ├── peroxide
    └── hydride

organic (Органические)
├── hydrocarbon
│   ├── alkane
│   ├── alkene
│   ├── alkyne
│   ├── diene
│   └── aromatic
├── alcohol
├── carboxylic_acid
├── aldehyde
├── ketone
├── ester
├── amine
├── phenol
├── carbohydrate
└── other_organic
```

### UI-фильтры

`taxonomy.json` определяет `ui_filters` — набор кнопок фильтра для каталога веществ.
Каждый фильтр имеет стабильный `id`, `kind` (system/type/class) и `match` (какие вещества показывать).

Фильтры по умолчанию: Все | Простые | Оксиды | Кислоты | Основания | Соли | Органические | Прочие неорг.

При выборе фильтра с подклассами (например, "Органические") UI показывает комбобокс для уточнения по class/subclass.

---

## 2. Миграция данных веществ

### Текущий формат (до миграции)

```json
{
  "id": "h2o2",
  "class": "other",
  "subclass": "peroxide"
}
```

### Целевой формат (после миграции)

```json
{
  "id": "h2o2",
  "taxonomy": {
    "type": "inorganic",
    "class": "other_inorganic",
    "subclass": "peroxide"
  }
}
```

### Маппинг миграции

| Текущий class | Текущий subclass | → type | → class | → subclass |
|---|---|---|---|---|
| `other` | `simple_substance` | `simple` | `simple_substance` | (по элементу) |
| `oxide` | `basic` | `inorganic` | `oxide` | `basic` |
| `oxide` | `acidic` | `inorganic` | `oxide` | `acidic` |
| `oxide` | `amphoteric` | `inorganic` | `oxide` | `amphoteric` |
| `acid` | `oxygen_containing` | `inorganic` | `acid` | `oxygen_containing` |
| `acid` | `oxygen_free` | `inorganic` | `acid` | `oxygen_free` |
| `base` | `soluble` | `inorganic` | `base` | `soluble` |
| `base` | `insoluble` | `inorganic` | `base` | `insoluble` |
| `base` | `amphoteric` | `inorganic` | `base` | `amphoteric` |
| `salt` | `normal` | `inorganic` | `salt` | `normal` |
| `other` | `peroxide` | `inorganic` | `other_inorganic` | `peroxide` |
| `other` | `hydride` | `inorganic` | `other_inorganic` | `hydride` |
| `other` | `alkane` | `organic` | `hydrocarbon` | `alkane` |
| `other` | `alkene` | `organic` | `hydrocarbon` | `alkene` |
| `other` | `alkyne` | `organic` | `hydrocarbon` | `alkyne` |
| `other` | `diene` | `organic` | `hydrocarbon` | `diene` |
| `other` | `alcohol` | `organic` | `alcohol` | — |
| `other` | `carboxylic_acid` | `organic` | `carboxylic_acid` | — |
| `other` | `aldehyde` | `organic` | `aldehyde` | — |
| `other` | `ketone` | `organic` | `ketone` | — |
| `other` | `ester` | `organic` | `ester` | — |
| `other` | `amine` | `organic` | `amine` | — |
| `other` | `phenol` | `organic` | `phenol` | — |
| `other` | `carbohydrate` | `organic` | `carbohydrate` | — |

### Затрагиваемые файлы

- `data-src/substances/*.json` — добавить `taxonomy`, удалить `class`/`subclass`
- `src/types/classification.ts` — добавить `SubstanceTaxonomy` с полем `type`
- `src/features/substances/SubstanceCatalog.tsx` — фильтрация по taxonomy
- `scripts/lib/generate-indices.mjs` — индекс с type/class/subclass
- `data-src/rules/classification_rules.json` — добавить type к правилам
- `scripts/lib/generate-search-index.mjs` — учитывать taxonomy при генерации

---

## 3. Словари поисковых синонимов

**Файлы**: `data-src/dictionaries/search_synonyms.{ru,en,pl,es}.json`

Словари нормализации запросов по локалям. Используются при генерации поискового индекса (build-time).

### Формат

```json
{
  "schema_version": "1.0",
  "locale": "ru",
  "entries": [
    { "key": "перекись", "expand": ["пероксид", "перекись водорода", "h2o2"] }
  ]
}
```

### Как используются

1. При генерации `search_index.json` скрипт загружает синонимы для текущей локали
2. Для каждого вещества/элемента/реакции в индексе:
   - берём существующие поисковые термы (formula, name, keywords)
   - проверяем, совпадает ли какой-либо терм с `key` из словаря
   - если да — добавляем `expand` термы в поле `search`
3. При поиске пользовательский запрос также расширяется через тот же словарь

### Три уровня синонимов

| Уровень | Где хранится | Назначение |
|---|---|---|
| Синонимы сущности | `substance.synonyms_ru` / overlay | Привязаны к конкретному веществу |
| Синонимы запроса | `search_synonyms.*.json` | Нормализация пользовательского ввода |
| UI-лейблы | Paraglide messages | Отображение в интерфейсе |

---

## 4. Paraglide-ключи таксономии

Добавить в `messages/*.json`:

```
taxonomy_type_simple           = "Простые вещества"
taxonomy_type_inorganic        = "Неорганические"
taxonomy_type_organic          = "Органические"
taxonomy_class_simple_substance = "Простое вещество"
taxonomy_class_oxide           = "Оксид"
taxonomy_class_acid            = "Кислота"
taxonomy_class_base            = "Основание"
taxonomy_class_salt            = "Соль"
taxonomy_class_other_inorganic = "Прочее неорганическое"
taxonomy_class_hydrocarbon     = "Углеводород"
taxonomy_class_alcohol         = "Спирт"
taxonomy_class_carboxylic_acid = "Карбоновая кислота"
taxonomy_class_aldehyde        = "Альдегид"
taxonomy_class_ketone          = "Кетон"
taxonomy_class_ester           = "Сложный эфир"
taxonomy_class_amine           = "Амин"
taxonomy_class_phenol          = "Фенол"
taxonomy_class_carbohydrate    = "Углевод"
taxonomy_subclass_peroxide     = "Пероксид"
taxonomy_subclass_hydride      = "Гидрид"
taxonomy_subclass_alkane       = "Алкан"
taxonomy_subclass_alkene       = "Алкен"
taxonomy_subclass_alkyne       = "Алкин"
taxonomy_subclass_diene        = "Диен"
taxonomy_subclass_aromatic     = "Ароматический"
```

Для фильтров (множ. число):

```
filter_all              = "Все"
filter_simple           = "Простые"
filter_oxide            = "Оксиды"
filter_acid             = "Кислоты"
filter_base             = "Основания"
filter_salt             = "Соли"
filter_organic          = "Органические"
filter_other_inorganic  = "Прочие неорг."
```

---

## 5. Валидация (build/CI)

При сборке данных проверяем:

1. Каждый `taxonomy.type` вещества ∈ `taxonomy.json → types`
2. Каждый `taxonomy.class` вещества ∈ `taxonomy.json → classes[type]`
3. Каждый `taxonomy.subclass` (если указан) ∈ `taxonomy.json → subclasses[class]`
4. Нет "осиротевших" кодов в taxonomy.json, которые ни одно вещество не использует (warning)

### Динамические enum

JSON Schema не поддерживает динамические enum из внешнего файла. Подход:

- `substance.schema.json` — допускает `type`/`class`/`subclass` как `string` + `pattern`
- Валидатор в `scripts/lib/validate.mjs` проверяет соответствие `taxonomy.json` в runtime
- Опционально: build-скрипт может генерировать `substance.schema.generated.json` со строгими enum для IDE

---

## 6. Модель «Элемент ↔ Простое вещество»

### Текущее состояние

- Элементы (`elements.json`) содержат `symbol`, `group`, физ. свойства
- Простые вещества (`h2.json`, `o2.json`, ...) — отдельные сущности с `taxonomy.type = "simple"`
- Связь элемент → вещество: только через `links.element_symbols` в веществе

### Целевое состояние

Элемент получает поле `simple_substances`:

```json
{
  "symbol": "O",
  "simple_substances": [
    { "substance_id": "o2", "role": "primary" },
    { "substance_id": "o3", "role": "allotrope" }
  ]
}
```

На странице элемента это отображается как ссылки на соответствующие страницы веществ.

Полноценный `chem.graph.json` — отложен до появления реальной потребности.

---

## 7. План реализации

### Этап 1: Данные и валидация
- [x] Создать `data-src/dictionaries/taxonomy.json`
- [x] Создать `data-src/dictionaries/search_synonyms.{ru,en,pl,es}.json`
- [ ] Написать миграционный скрипт для substance JSON (class/subclass → taxonomy)
- [ ] Добавить валидацию taxonomy в `scripts/lib/validate.mjs`
- [ ] Подключить taxonomy.json и словари синонимов к build pipeline

### Этап 2: Типы и загрузчики
- [ ] Добавить `SubstanceTaxonomy` в `src/types/classification.ts`
- [ ] Обновить `SubstanceIndexEntry` — заменить `class`/`subclass` на `taxonomy`
- [ ] Добавить `loadTaxonomy()` в `src/lib/data-loader.ts`
- [ ] Обновить `loadSubstancesIndex()` для нового формата

### Этап 3: UI
- [ ] Добавить Paraglide-ключи таксономии в `messages/*.json`
- [ ] Переписать фильтры в `SubstanceCatalog.tsx` на основе taxonomy + ui_filters
- [ ] Добавить комбобокс подклассов при выборе "Органические"
- [ ] Обновить CSS-бейджи для новых классов

### Этап 4: Поиск
- [ ] Интегрировать search_synonyms в `scripts/lib/generate-search-index.mjs`
- [ ] Расширять поисковые термы через словарь при генерации индекса
- [ ] Добавить `synonyms_ru` к веществам, у которых есть бытовые названия
