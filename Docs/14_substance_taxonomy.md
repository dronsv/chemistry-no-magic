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

---

## 8. Экзаменационные профили

**Файл**: `data-src/dictionaries/exam_profiles.json`

Экзамен — это **слой над контентом**, а не часть таксономии. Разные экзамены используют один и тот же набор веществ/реакций, но с разными приоритетами.

### Структура профиля

```json
{
  "id": "ru_oge",
  "name_ru": "ОГЭ по химии",
  "country": "RU",
  "default_locale": "ru",
  "data_dir": "exam/oge",
  "required_taxonomy_classes": ["oxide", "acid", "base", "salt", ...],
  "topic_weights": { "periodic_table": 1.2, "calculations_basic": 1.0 },
  "substance_boosts": { "naoh": 1.2, "hcl": 1.2 }
}
```

### Как используются

- **Каталог веществ**: при активном профиле — поднимаем boosted вещества выше в списке
- **Поиск**: `score × substance_boost` при ранжировании результатов
- **Диагностика**: `topic_weights` влияют на выбор вопросов
- **Практика**: профиль определяет, какие упражнения приоритетнее

### Текущие профили (5 экзаменов)

| ID | Экзамен | Страна | Локаль | Органика |
|---|---|---|---|---|
| `ru_oge` | ОГЭ | RU | ru | Нет |
| `ru_ege` | ЕГЭ | RU | ru | Да |
| `gb_gcse` | GCSE | GB | en | Нет |
| `pl_matura` | Matura | PL | pl | Частично |
| `es_ebau` | EBAU | ES | es | Частично |

---

## 9. Нормализация формул

**Файл**: `data-src/dictionaries/search_norm_rules.json`

Правила преобразования формул для поиска (build-time + query-time):

- **Подстрочные индексы → ASCII**: `H₂O₂` → `H2O2`
- **Надстрочные**: `Cu²⁺` → `Cu2+`
- **Спецсимволы**: `→` → `->`, `•` → `·`
- **Детектор формул**: regex `^[A-Za-z\[\]()0-9·.+\-]+$`

Текстовые пайплайны для каждой локали (lowercase, ё→е, collapse spaces).

---

## 10. Долгосрочная стратегия масштабирования

### 10.1. Расширение локалей

Текущий `_ru` суффикс сохраняется как первичный. Для новых локалей — overlay-система.

Если потребуется > 6 локалей, рассмотреть добавление `i18n` контейнера в веществах:

```json
{
  "id": "h2o2",
  "name_ru": "Пероксид водорода",
  "synonyms_ru": ["перекись", "перекись водорода"],
  "i18n": {
    "de": { "name": "Wasserstoffperoxid", "synonyms": ["Wasserstoffperoxid"] },
    "fr": { "name": "Peroxyde d'hydrogène", "synonyms": ["eau oxygénée"] }
  }
}
```

**Правило**: старый код читает `name_ru`, новый — ищет `i18n[locale]` и фолбэчит на `name_ru`. Overlay-система продолжает работать параллельно.

### 10.2. Граф знаний (отложен, вероятность ~70%)

Текущие `links.element_symbols` + `composition` + `element_simple_substances` покрывают базовые связи.

Граф станет нужен при появлении:
- **Аллотропии** (C: алмаз/графит/фуллерены)
- **Цепочек превращений** как маршрутов обучения
- **Семантических отношений** ("типичный продукт", "реагент для")

Компромисс — "микро-граф" с минимальными типами рёбер:
- `element_has_simple_substance` (с rank и role)
- `reaction_connects` (через reaction_ids)

Этого достаточно для 80% задач без оверинжиниринга.

### 10.3. Версионирование схем

Все словари содержат `schema_version`. Политика обратной совместимости:
- Minor версия (1.0 → 1.1): добавление полей, обратно совместимо
- Major версия (1.0 → 2.0): ломающие изменения, требуют миграции

### 10.4. Build-валидация как страховка

Обязательные проверки в CI:
1. Все `taxonomy.type/class/subclass` веществ ∈ `taxonomy.json`
2. Все `exam_profiles.*.required_taxonomy_classes` ∈ `taxonomy.json`
3. Формулы в поисковом индексе нормализованы по `search_norm_rules.json`
4. Нет осиротевших кодов в taxonomy (warning)
5. Все `substance_boosts` в профилях ссылаются на существующие вещества

---

## Файлы-артефакты (справочник)

| Файл | Тип | Назначение |
|---|---|---|
| `data-src/dictionaries/taxonomy.json` | Данные | Каноническая таксономия + UI-фильтры |
| `data-src/dictionaries/exam_profiles.json` | Данные | Профили 5 экзаменов: веса, бусты, метаданные |
| `data-src/dictionaries/search_norm_rules.json` | Данные | Правила нормализации формул и текста |
| `data-src/dictionaries/search_synonyms.ru.json` | Данные | 25 поисковых синонимов (рус) |
| `data-src/dictionaries/search_synonyms.en.json` | Данные | 19 поисковых синонимов (англ) |
| `data-src/dictionaries/search_synonyms.pl.json` | Данные | 18 поисковых синонимов (пол) |
| `data-src/dictionaries/search_synonyms.es.json` | Данные | 17 поисковых синонимов (исп) |
| `Docs/14_substance_taxonomy.md` | Спец | Этот документ |
