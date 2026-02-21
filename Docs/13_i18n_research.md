# 13. Исследование интернационализации (i18n)

> Дата: 2026-02-21
> Статус: исследование
> Цель: анализ подходов к многоязычности для проекта «Химия без магии»

## Содержание

1. [Текущее состояние](#1-текущее-состояние)
2. [Общие принципы i18n](#2-общие-принципы-i18n)
3. [Подход A: Astro i18n + Paraglide.js](#3-подход-a-astro-i18n--paraglide-js)
4. [Подход B: Самописное JSON-решение](#4-подход-b-самописное-json-решение)
5. [Подход C: i18next + react-i18next](#5-подход-c-i18next--react-i18next)
6. [Сравнительная таблица](#6-сравнительная-таблица)
7. [Локализованные URL-пути (SEO)](#7-локализованные-url-пути-seo)
8. [Стратегия локализации данных](#8-стратегия-локализации-данных)
9. [Управление переводами (TMS)](#9-управление-переводами-tms)
10. [Принятое решение](#10-принятое-решение)
11. [План миграции](#11-план-миграции)
12. [Ссылки](#12-ссылки)

---

## 1. Текущее состояние

### Что уже готово

| Аспект | Статус | Детали |
|--------|--------|--------|
| Структура данных | Готово | 1 881 вхождение `_ru` полей в 59 JSON-файлах |
| TypeScript типы | Готово | Суффикс `_ru` в 10+ файлах типов |
| Astro конфиг | Не настроено | Нет i18n-интеграции |
| Компоненты | Хардкод | 582 русских строки в 84 компонентах (TSX, Astro) |
| Зависимости | Нет | Нет i18n-библиотек (намеренно, по архитектуре) |
| Data pipeline | Частично | Обрабатывает `_ru`, но без разделения по локалям |
| Поиск | Частично | Индексирует всё без разделения по языкам |

### Конвенция `_ru` в данных

Проект изначально спроектирован с учётом будущей локализации. Все контентные поля используют суффикс языка:

```json
{
  "id": "caco3",
  "name_ru": "Карбонат кальция",
  "appearance_ru": "Белый порошок или кристаллы"
}
```

Это позволяет добавить `name_en`, `name_kk` параллельно, не ломая существующую структуру.

### Два слоя локализации

1. **UI-строки** (~582 строки): кнопки, навигация, сообщения об ошибках, заголовки — живут в компонентах (TSX, Astro)
2. **Контентные данные** (~1 881 поле): названия элементов, теория, задачи ОГЭ — живут в JSON-файлах `data-src/`

Каждый слой требует своей стратегии.

---

## 2. Общие принципы i18n

### Терминология

- **i18n** (internationalization) — проектирование архитектуры для поддержки нескольких языков
- **l10n** (localization) — адаптация контента для конкретной локали (перевод, форматы дат/чисел)
- **ICU MessageFormat** — стандарт Unicode для форматирования сообщений с плюрализацией и выбором по полу/числу
- **CLDR** (Common Locale Data Repository) — база данных правил плюрализации, форматов дат, валют для всех языков

### Ключевые best practices

**Разделение кода и контента.** Текстовые строки не должны быть захардкожены в компонентах. Вместо `<button>Далее</button>` → `<button>{t('next')}</button>`.

**Плюрализация через CLDR.** Разные языки имеют разные правила множественного числа. Русский: 1 элемент / 2 элемента / 5 элементов. Английский: 1 element / 2 elements. Казахский: только одна форма. ICU MessageFormat решает это стандартно:

```
{count, plural, one {# элемент} few {# элемента} many {# элементов} other {# элементов}}
```

> Ref: [ICU MessageFormat Guide — Phrase](https://phrase.com/blog/posts/guide-to-the-icu-message-format/) | [ICU Documentation — Unicode](https://unicode-org.github.io/icu/userguide/format_parse/messages/)

**Контекст для переводчиков.** Строка "Связи" вне контекста может означать bonds, connections, relations. Ключи должны быть семантичными: `nav.bonds_page_title`, а не `str_42`.

**Не конкатенировать строки.** `"Найдено " + count + " элементов"` — антипаттерн. Порядок слов меняется между языками. Использовать интерполяцию: `"found_elements": "Найдено {count} элементов"`.

**Локаль ≠ язык.** `ru-KZ` (русский в Казахстане) может отличаться от `ru-RU` форматами дат и чисел.

> Ref: [Lokalise — How to translate JSON files](https://lokalise.com/blog/json-l10n/) | [SimpleLocalize — ICU message format](https://simplelocalize.io/blog/posts/what-is-icu/)

---

## 3. Подход A: Astro i18n + Paraglide.js

### Описание

Комбинация встроенного i18n-роутинга Astro 5 (маршруты `/ru/`, `/en/`, `/kk/`) с Paraglide.js — компиляторным решением для UI-строк.

### Как работает Paraglide

Paraglide компилирует переводы из JSON в **tree-shakable JavaScript-функции**:

```
// messages/ru.json
{ "next_button": "Далее", "loading": "Загрузка..." }

// messages/en.json
{ "next_button": "Next", "loading": "Loading..." }
```

Компилятор генерирует:
```typescript
// Автогенерация — типизированные функции
export const next_button = () => "Далее"  // или "Next" в зависимости от локали
export const loading = () => "Загрузка..."
```

Если компонент использует только `next_button`, то `loading` не попадёт в бандл — tree-shaking на уровне отдельных строк.

### Настройка Astro

```javascript
// astro.config.mjs
import { defineConfig } from "astro/config"
import paraglide from "@inlang/paraglide-astro"

export default defineConfig({
  i18n: {
    locales: ["ru", "en", "kk"],
    defaultLocale: "ru",
    routing: {
      prefixDefaultLocale: false  // /periodic-table/ → русский (без /ru/)
    }
  },
  integrations: [
    paraglide({
      project: "./project.inlang",
      outdir: "./src/paraglide"
    })
  ]
})
```

> Ref: [Paraglide-Astro — inlang](https://inlang.com/m/iljlwzfs/paraglide-astro-i18n) | [Astro i18n Routing](https://docs.astro.build/en/guides/internationalization/)

### Использование в компонентах

```tsx
// До (хардкод)
<button>Далее</button>
<div>Загрузка...</div>

// После (Paraglide)
import * as m from '../paraglide/messages'
<button>{m.next_button()}</button>
<div>{m.loading()}</div>
```

Маршрутизация:
```
src/pages/
  periodic-table/index.astro    → /periodic-table/   (русский, default)
  en/periodic-table/index.astro → /en/periodic-table/ (английский)
  kk/periodic-table/index.astro → /kk/periodic-table/ (казахский)
```

Или через `getStaticPaths` для генерации из одного шаблона:
```astro
---
export function getStaticPaths() {
  return [
    { params: { lang: 'ru' } },
    { params: { lang: 'en' } },
    { params: { lang: 'kk' } }
  ]
}
---
```

> Ref: [Astro i18n recipes](https://docs.astro.build/en/recipes/i18n/) | [Paraglide.js GitHub](https://github.com/opral/paraglide-js)

### Характеристики

| Метрика | Значение |
|---------|----------|
| Bundle size (client) | ~2 КБ (только используемые строки) |
| Runtime overhead | 0 (compile-time) |
| TypeScript | Полная типизация, автокомплит ключей |
| Плюрализация | ICU MessageFormat |
| Совместимость | Astro 5, React 19 |
| Формат переводов | JSON (messages/ru.json, messages/en.json) |

### Плюсы

- **Минимальный bundle**: только используемые переводы попадают в клиентский JS — критично для static-first архитектуры проекта
- **Compile-time проверки**: опечатка в ключе = ошибка компиляции, а не пустая строка в рантайме
- **Нативная интеграция с Astro**: читает `lang` из `<html>`, не отправляет код определения языка на клиент
- **ICU MessageFormat**: стандартная плюрализация для русского (one/few/many), казахского (other), английского (one/other)
- **Инструментарий inlang**: lint правила для переводов, IDE расширение, CI проверки

### Минусы

- **Относительно молодая библиотека** (2023+): меньше Stack Overflow ответов, чем у i18next
- **Инструментарий inlang**: требует настройки `project.inlang/settings.json`
- **Не решает локализацию данных**: для JSON-данных (`elements.json`, `oge_tasks.json`) нужна отдельная стратегия в data pipeline

> Ref: [Why I Replaced i18next with Paraglide.js](https://dropanote.de/en/blog/20250726-why-i-replaced-i18next-with-paraglide-js/) | [Paraglide.js setup guide](https://dropanote.de/en/blog/20250625-paraglide-js-setup-guide/)

---

## 4. Подход B: Самописное JSON-решение

### Описание

Без внешних зависимостей. Два уровня: UI-словари в `locales/*.json` + расширение `_ru`/`_en`/`_kk` конвенции в data-src. Build-time выбор локали.

### Архитектура

```
locales/
  ru.json    → { "nav.home": "Главная", "nav.diagnostics": "Диагностика", ... }
  en.json    → { "nav.home": "Home", "nav.diagnostics": "Diagnostics", ... }
  kk.json    → { "nav.home": "Басты бет", ... }

src/lib/
  i18n.ts    → useTranslation() хук, getLocale(), t(key)
```

### Реализация

```typescript
// src/lib/i18n.ts
type Locale = 'ru' | 'en' | 'kk'

const dictionaries: Record<Locale, Record<string, string>> = {}

export async function loadDictionary(locale: Locale) {
  if (!dictionaries[locale]) {
    dictionaries[locale] = await fetch(`/locales/${locale}.json`).then(r => r.json())
  }
  return dictionaries[locale]
}

export function t(key: string, locale: Locale, params?: Record<string, string | number>) {
  let str = dictionaries[locale]?.[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, String(v))
    }
  }
  return str
}
```

### Характеристики

| Метрика | Значение |
|---------|----------|
| Bundle size (client) | ~0.5 КБ (код) + словарь (~3-5 КБ gzip) |
| Runtime overhead | Минимальный (lookup по объекту) |
| TypeScript | Ручная типизация (или codegen) |
| Плюрализация | Нужно реализовать вручную |
| Совместимость | Любой стек |
| Формат переводов | JSON key-value |

### Плюсы

- **Ноль зависимостей**: полностью соответствует философии проекта «без тяжёлых библиотек»
- **Полный контроль**: нет чёрных ящиков, всё видно в исходниках
- **Простота для маленькой команды**: нет learning curve по инструментарию
- **Расширяет существующую конвенцию**: `_ru` суффиксы уже используются, добавить `_en`/`_kk` — естественное расширение

### Минусы

- **Нет автокомплита ключей**: опечатка в `t('nav.hom')` не поймается до рантайма (если не написать codegen)
- **Плюрализация вручную**: CLDR правила для русского (one/few/many/other) — нетривиальная логика, которую нужно реализовать и протестировать
- **Нет проверки пропущенных переводов**: без специальных скриптов легко пропустить непереведённую строку
- **Масштабируемость**: при >3 языках и >500 строк управление становится громоздким
- **Нет готовой интеграции с TMS**: экспорт/импорт переводов для Crowdin/Weblate нужно писать отдельно

---

## 5. Подход C: i18next + react-i18next

### Описание

Самый популярный i18n-стек в экосистеме JavaScript. Runtime-библиотека с JSON-namespaces для переводов, плагинами для определения языка, загрузки переводов и форматирования.

### Настройка

```typescript
// src/lib/i18n-config.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'en', 'kk'],
    ns: ['common', 'periodic-table', 'diagnostics'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json'
    },
    interpolation: { escapeValue: false }
  })
```

### Использование в React

```tsx
import { useTranslation } from 'react-i18next'

function PeriodicTablePage() {
  const { t } = useTranslation('periodic-table')
  return <h1>{t('title')}</h1>  // "Периодическая таблица" / "Periodic Table"
}
```

> Ref: [React i18next docs](https://react.i18next.com/) | [i18next documentation](https://www.i18next.com/)

### Характеристики

| Метрика | Значение |
|---------|----------|
| Bundle size (client) | ~56 КБ (minified), ~15 КБ (gzip) |
| Runtime overhead | Средний (парсинг, интерполяция, плюрализация в рантайме) |
| TypeScript | Поддержка через `i18next` типы (v23+) |
| Плюрализация | Встроенная, ICU через плагин |
| Совместимость | React 19 — да; Astro 5 — проблемы с интеграцией |
| Формат переводов | JSON (вложенные namespaces) |

### Плюсы

- **Огромная экосистема**: 30+ плагинов — backend loaders, language detectors, formatters, postProcessors
- **5M+ загрузок в неделю**: максимум ресурсов, ответов на Stack Overflow, примеров
- **Готовые интеграции с TMS**: Crowdin, Lokalise, Phrase, Locize — нативная поддержка
- **ICU MessageFormat через плагин**: `i18next-icu` добавляет полную поддержку
- **Namespace splitting**: загрузка переводов по модулям (common, periodic-table, exam)

### Минусы

- **56 КБ bundle**: противоречит принципу «минимизировать клиентский JS» из CLAUDE.md
- **Runtime overhead**: каждый вызов `t()` — lookup + интерполяция + плюрализация в рантайме
- **Проблемы с Astro 5**: `astro-i18next` не обновлялся под Astro 5; требуется ручная интеграция через React islands
- **Инициализация**: `i18n.init()` должен завершиться до рендера — добавляет задержку при гидрации
- **Overkill для static-first**: библиотека рассчитана на динамические SPA; для статического сайта большая часть функциональности не нужна

> Ref: [i18next npm](https://www.npmjs.com/package/i18next) | [Phrase — Best React i18n Libraries](https://phrase.com/blog/posts/react-i18n-best-libraries/)

---

## 6. Сравнительная таблица

| Критерий | A: Paraglide | B: Самописное | C: i18next |
|----------|:------------:|:-------------:|:----------:|
| **Bundle size** | ~2 КБ | ~0.5 КБ + словарь | ~56 КБ |
| **Runtime overhead** | 0 | Минимальный | Средний |
| **TypeScript** | Автокомплит ключей | Ручная типизация | Типизация через конфиг |
| **Плюрализация** | ICU (встроенная) | Ручная реализация | ICU (через плагин) |
| **Tree-shaking** | На уровне строк | Весь словарь | Весь namespace |
| **Проверка ключей** | Compile-time | Нет | Runtime |
| **Astro 5** | Нативная интеграция | Совместимо | Проблемы |
| **React islands** | Работает | Работает | Работает |
| **Интеграция с TMS** | inlang CLI | Ручной экспорт | Нативная |
| **Learning curve** | Средняя | Низкая | Средняя |
| **Сообщество** | Растущее (~3k stars) | — | Огромное (~7k stars) |
| **Static-first** | Идеально | Хорошо | Плохо |
| **Зависимости** | 1 (paraglide) | 0 | 3+ (i18next, react-i18next, backend) |
| **Проверка пропусков** | inlang lint | Нет (без скриптов) | Плагины |

---

## 7. Локализованные URL-пути (SEO)

### Зачем

Google рекомендует использовать URL-пути, понятные для целевой аудитории. Локализованные пути улучшают:
- **CTR в поиске**: `/en/periodic-table/` понятнее англоязычному пользователю, чем `/en/periodicheskaya-tablica/`
- **Индексацию**: поисковые системы лучше ранжируют страницы с ключевыми словами в URL
- **UX**: пользователь видит читаемый путь на своём языке

### Варианты URL-схем

| Схема | Пример (русский) | Пример (английский) | Пример (казахский) |
|-------|-------------------|---------------------|---------------------|
| Префикс + оригинал | `/periodic-table/` | `/en/periodic-table/` | `/kk/periodic-table/` |
| Префикс + перевод | `/periodic-table/` | `/en/periodic-table/` | `/kk/periodtyk-keste/` |
| Субдомен | `chemistry.site/` | `en.chemistry.site/` | `kk.chemistry.site/` |

**Рекомендуется: Префикс + перевод пути.** Русский (default) без префикса, остальные с `/{locale}/` и переведённым slug.

### Маппинг путей проекта

Текущие 12 статических маршрутов + 2 динамических:

| Текущий путь | English | Қазақша |
|-------------|---------|---------|
| `/` | `/en/` | `/kk/` |
| `/diagnostics/` | `/en/diagnostics/` | `/kk/diagnostika/` |
| `/periodic-table/` | `/en/periodic-table/` | `/kk/periodtyk-keste/` |
| `/periodic-table/H/` | `/en/periodic-table/H/` | `/kk/periodtyk-keste/H/` |
| `/substances/` | `/en/substances/` | `/kk/zattekter/` |
| `/substances/nacl/` | `/en/substances/nacl/` | `/kk/zattekter/nacl/` |
| `/bonds/` | `/en/bonds/` | `/kk/baylanys/` |
| `/oxidation-states/` | `/en/oxidation-states/` | `/kk/tottygyu-darezhe/` |
| `/reactions/` | `/en/reactions/` | `/kk/reaktsiyalar/` |
| `/calculations/` | `/en/calculations/` | `/kk/esepteuler/` |
| `/exam/` | `/en/exam/` | `/kk/emtikhan/` |
| `/profile/` | `/en/profile/` | `/kk/profil/` |
| `/search/` | `/en/search/` | `/kk/izdeu/` |
| `/about/` | `/en/about/` | `/kk/zhoba-turaly/` |

> Примечание: английские пути совпадают с текущими (slug уже на английском). Казахские — транслитерация.

### SEO-разметка для мультиязычных страниц

Каждая страница должна содержать `hreflang` для связи локализованных версий:

```html
<link rel="alternate" hreflang="ru" href="https://chemistry.svistunov.online/periodic-table/" />
<link rel="alternate" hreflang="en" href="https://chemistry.svistunov.online/en/periodic-table/" />
<link rel="alternate" hreflang="kk" href="https://chemistry.svistunov.online/kk/periodtyk-keste/" />
<link rel="alternate" hreflang="x-default" href="https://chemistry.svistunov.online/periodic-table/" />
```

Canonical URL указывает на текущую локаль (не на default):
```html
<!-- На странице /en/periodic-table/ -->
<link rel="canonical" href="https://chemistry.svistunov.online/en/periodic-table/" />
```

Sitemap расширяется `xhtml:link`:
```xml
<url>
  <loc>https://chemistry.svistunov.online/periodic-table/</loc>
  <xhtml:link rel="alternate" hreflang="ru" href="https://chemistry.svistunov.online/periodic-table/" />
  <xhtml:link rel="alternate" hreflang="en" href="https://chemistry.svistunov.online/en/periodic-table/" />
  <xhtml:link rel="alternate" hreflang="kk" href="https://chemistry.svistunov.online/kk/periodtyk-keste/" />
</url>
```

> Ref: [Google — Managing multi-regional and multilingual sites](https://developers.google.com/search/docs/specialty/international/localized-versions) | [Astro Sitemap integration](https://docs.astro.build/en/guides/integrations-guide/sitemap/)

### Реализация в текущей архитектуре

#### Что нужно изменить

Аудит выявил **все точки, где URL-пути захардкожены** в проекте:

**1. Навигация (`src/components/Nav.astro`)** — 11 ссылок:
```javascript
const links = [
  { href: '/', label: 'Главная' },
  { href: '/diagnostics/', label: 'Диагностика' },
  // ... ещё 9
]
```
→ Нужна функция `localizedHref(path, locale)`, которая по маппингу путей возвращает правильный URL.

**2. Главная страница (`src/pages/index.astro`)** — ~12 ссылок на модули:
```html
<a href="/exam/">Решать задания ОГЭ</a>
<a href="/diagnostics/">Пройти диагностику</a>
```
→ Замена на `localizedHref()`.

**3. Детальные страницы** — кросс-ссылки:
- `[symbol].astro`: ссылки на `/periodic-table/`, `/reactions/#id`, `/substances/{id}/`
- `[id].astro`: ссылки на `/substances/`
→ Все через `localizedHref()`.

**4. React-компоненты** — программная навигация:
- `FormulaChip.tsx`: `window.location.href = '/substances/${id}/'`
- `DiagnosticsApp.tsx`: ссылка на `/profile/`
- `ProfileApp.tsx`: ссылки на `/diagnostics/`
- `BaseLayout.astro`: `location.href = '/search/'` (Ctrl+K)
→ Компоненты получают `locale` через prop или контекст, используют `localizedHref()`.

**5. Поисковый индекс (`scripts/lib/generate-search-index.mjs`)** — URL в каждой записи:
```javascript
url: `/periodic-table/${el.symbol}/`
url: `/substances/${sub.id}/`
// + 11 статических страниц
```
→ Генерировать отдельный индекс на каждую локаль: `search_index.json`, `search_index.en.json`, `search_index.kk.json`.

**6. SEO-разметка (`src/layouts/BaseLayout.astro`)**:
- Breadcrumb JSON-LD генерируется из `Astro.url.pathname` — **работает автоматически** с любыми путями
- `og:locale` захардкожен как `ru_RU` → нужно динамическое значение
- Canonical URL: уже использует `Astro.url.href` → **работает автоматически**
- JSON-LD схемы на отдельных страницах: `inLanguage: "ru"` → нужно динамическое значение

**7. Sitemap (`astro.config.mjs`)** — фильтры и приоритеты:
```javascript
filter: (page) => !page.includes('/profile/')
```
→ Расширить фильтры для всех локалей: исключить `/en/profile/`, `/kk/profil/`.

#### Что работает без изменений

- **Data loader** (`src/lib/data-loader.ts`): загружает из `/data/{hash}/`, не зависит от URL страницы
- **ViewTransitions**: работают с любыми URL, прозрачно
- **BKT engine** + **localStorage**: хранилище по competency ID, не зависит от локали URL
- **CSS**: стили не зависят от маршрутов
- **Динамические параметры** (`[symbol]`, `[id]`): ID элементов (H, O, Na) и веществ (nacl, h2o) — универсальные, не переводятся

#### Оценка трудозатрат

| Компонент | Объём работы | Сложность |
|-----------|-------------|-----------|
| Маппинг путей (конфиг) | 1 файл, ~30 строк | Низкая |
| `localizedHref()` утилита | 1 файл, ~20 строк | Низкая |
| Nav.astro | Рефакторинг 1 файла | Низкая |
| Страницы (index, about, etc.) | 12 файлов, замена ссылок | Средняя |
| React-компоненты | 4 файла, добавить locale prop | Средняя |
| BaseLayout.astro (hreflang, og:locale) | 1 файл, ~15 строк | Низкая |
| Генератор поискового индекса | 1 файл, цикл по локалям | Средняя |
| Sitemap конфиг | 1 файл, расширить фильтры | Низкая |
| Динамические маршруты | 2 файла (`[symbol]`, `[id]`) | Средняя |
| **Итого** | ~25 файлов | **Средняя** |

#### Архитектурное решение: маппинг путей

Центральный конфиг для маппинга:

```typescript
// src/lib/routes.ts
export type Locale = 'ru' | 'en' | 'kk'

export const pathMap: Record<string, Record<Locale, string>> = {
  '/':                  { ru: '/',                  en: '/en/',                  kk: '/kk/' },
  '/diagnostics/':      { ru: '/diagnostics/',      en: '/en/diagnostics/',      kk: '/kk/diagnostika/' },
  '/periodic-table/':   { ru: '/periodic-table/',   en: '/en/periodic-table/',   kk: '/kk/periodtyk-keste/' },
  '/substances/':       { ru: '/substances/',       en: '/en/substances/',       kk: '/kk/zattekter/' },
  '/bonds/':            { ru: '/bonds/',             en: '/en/bonds/',            kk: '/kk/baylanys/' },
  '/oxidation-states/': { ru: '/oxidation-states/', en: '/en/oxidation-states/', kk: '/kk/tottygyu-darezhe/' },
  '/reactions/':        { ru: '/reactions/',         en: '/en/reactions/',         kk: '/kk/reaktsiyalar/' },
  '/calculations/':     { ru: '/calculations/',     en: '/en/calculations/',     kk: '/kk/esepteuler/' },
  '/exam/':             { ru: '/exam/',              en: '/en/exam/',             kk: '/kk/emtikhan/' },
  '/profile/':          { ru: '/profile/',           en: '/en/profile/',          kk: '/kk/profil/' },
  '/search/':           { ru: '/search/',            en: '/en/search/',           kk: '/kk/izdeu/' },
  '/about/':            { ru: '/about/',             en: '/en/about/',            kk: '/kk/zhoba-turaly/' },
}

export function localizedHref(path: string, locale: Locale): string {
  // Точное совпадение
  if (pathMap[path]?.[locale]) return pathMap[path][locale]
  // Динамические маршруты: /periodic-table/H/ → /kk/periodtyk-keste/H/
  for (const [base, locales] of Object.entries(pathMap)) {
    if (path.startsWith(base) && base !== '/') {
      const suffix = path.slice(base.length)
      return locales[locale] + suffix
    }
  }
  // Fallback: добавить префикс локали
  return locale === 'ru' ? path : `/${locale}${path}`
}
```

Этот конфиг используется:
- В Astro-страницах: `localizedHref('/periodic-table/', locale)`
- В React-компонентах: через prop `locale` + импорт `localizedHref`
- В build-скриптах: для генерации поискового индекса и sitemap

При использовании Paraglide-Astro (Подход A) маппинг путей можно описать в `project.inlang/settings.json`, и интеграция обеспечит автоматический роутинг. При самописном решении (Подход B) — конфиг выше.

### Определение языка и навигация

#### Приоритет выбора локали

```
1. localStorage('preferred_locale')   — пользователь ранее выбрал язык
        ↓ нет
2. navigator.languages / Accept-Language — язык браузера / ОС
        ↓ нет совпадений с поддерживаемыми
3. Геолокация (опционально)            — IP → страна → язык
        ↓ нет
4. Fallback: English ('en')
```

Русский **не является fallback по умолчанию**, потому что для нового пользователя без русскоязычного браузера английский — более универсальный выбор. Русскоязычные пользователи автоматически получат русский через `navigator.languages` (шаг 2).

#### Алгоритм определения

```typescript
// src/lib/locale-detect.ts
export type Locale = 'ru' | 'en' | 'kk'

const SUPPORTED_LOCALES: Locale[] = ['ru', 'en', 'kk']
const STORAGE_KEY = 'preferred_locale'
const FALLBACK: Locale = 'en'

export function detectLocale(): Locale {
  // 1. Сохранённый выбор пользователя
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
  if (saved && SUPPORTED_LOCALES.includes(saved)) return saved

  // 2. Язык браузера / ОС
  for (const lang of navigator.languages) {
    const code = lang.split('-')[0].toLowerCase()
    const match = SUPPORTED_LOCALES.find(l => l === code)
    if (match) return match
  }

  // 3. Fallback — английский
  return FALLBACK
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale)
}

export function getSavedLocale(): Locale | null {
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
  return saved && SUPPORTED_LOCALES.includes(saved) ? saved : null
}
```

#### Когда происходит определение

Для **static-first** сайта определение языка невозможно при SSG (нет сервера). Два варианта:

**Вариант A: Клиентский редирект на главной (рекомендуется)**

Корневая страница `/` содержит минимальный скрипт, который определяет язык и перенаправляет:

```astro
---
// src/pages/index.astro — landing page / locale router
---
<html>
<head><meta charset="utf-8" /><title>Chemistry</title></head>
<body>
<script>
  const SUPPORTED = ['ru', 'en', 'kk'];
  const STORAGE_KEY = 'preferred_locale';

  function detect() {
    // 1. Сохранённый выбор
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    // 2. Язык браузера
    for (const lang of navigator.languages) {
      const code = lang.split('-')[0].toLowerCase();
      if (SUPPORTED.includes(code)) return code;
    }
    // 3. Fallback
    return 'en';
  }

  const locale = detect();
  const pathMap = { ru: '/', en: '/en/', kk: '/kk/' };
  // Русский — default, остаётся на /
  // Остальные — редирект на /{locale}/
  if (locale !== 'ru') {
    location.replace(pathMap[locale] || '/en/');
  }
  // Если ru — показать русскую главную (содержимое ниже)
</script>
<!-- Русская главная страница рендерится статически -->
</body>
</html>
```

**Плюсы**: не нужен сервер; русские пользователи видят страницу мгновенно (без редиректа); остальные получают 1 быстрый редирект.
**Минусы**: мерцание для не-русских пользователей; поисковый бот не выполняет JS → видит русскую версию (но `hreflang` решает это).

**Вариант B: Middleware (Astro SSR/hybrid)**

Если проект перейдёт на hybrid rendering:

```typescript
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url
  // Если уже на локализованном пути — продолжить
  if (pathname.startsWith('/en/') || pathname.startsWith('/kk/')) return next()
  // Для корня — определить по Accept-Language
  if (pathname === '/') {
    const acceptLang = context.request.headers.get('accept-language') || ''
    const locale = parseAcceptLanguage(acceptLang) // → 'ru' | 'en' | 'kk'
    if (locale !== 'ru') {
      return context.redirect(`/${locale}/`, 302)
    }
  }
  return next()
})
```

**Плюсы**: нет мерцания, определение до рендера, корректно для ботов.
**Минусы**: требует SSR/hybrid (не static-first), добавляет серверные расходы.

**Вариант C: Баннер-предложение (рекомендуется Google)**

Google [явно не рекомендует](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites) автоматические редиректы по языку: *«Avoid automatically redirecting users based on what you think the user's language may be. These redirections could prevent users and search engines from viewing all the versions of your site.»*

Вместо редиректа — ненавязчивый баннер:

```tsx
// src/components/LocaleBanner.tsx
import { detectLocale, getSavedLocale, saveLocale, type Locale } from '../lib/locale-detect'
import { localizedHref } from '../lib/routes'

export default function LocaleBanner({ currentLocale, currentPath }: {
  currentLocale: Locale
  currentPath: string
}) {
  // Не показывать, если пользователь уже выбирал язык
  if (getSavedLocale()) return null

  const detected = detectLocale()
  // Не показывать, если определённый язык совпадает с текущим
  if (detected === currentLocale) return null

  const labels: Record<Locale, string> = {
    ru: 'Доступна русская версия',
    en: 'This page is available in English',
    kk: 'Бұл бет қазақ тілінде қолжетімді',
  }

  function accept() {
    saveLocale(detected)
    window.location.href = localizedHref(currentPath, detected)
  }

  function dismiss() {
    saveLocale(currentLocale)  // Запомнить текущий выбор
  }

  return (
    <div className="locale-banner" role="alert">
      <span>{labels[detected]}</span>
      <button onClick={accept}>Switch / Перейти</button>
      <button onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  )
}
```

**Плюсы**: соответствует рекомендациям Google; не мешает индексации; пользователь сам решает; работает на static.
**Минусы**: пользователь видит «чужой» язык на первое посещение (до клика на баннер).

> Ref: [Google — Managing multi-regional sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites) | [Linguise — Auto-redirect best practices](https://www.linguise.com/blog/guide/hreflang-tags-vs-language-detection-whats-the-best-approach-for-multilingual-seo/) | [WPML — How browser redirect affects Google indexing](https://wpml.org/documentation/getting-started-guide/language-setup/automatic-redirect-based-on-browser-language/how-browser-language-redirect-affects-google-indexing/)

**Рекомендация**: **Вариант C (баннер)** как основной подход. Русский — default для всех, включая поисковых ботов. Баннер появляется один раз, после выбора сохраняется в localStorage и больше не показывается.

#### Переключатель языка в UI

Компонент в Nav:

```tsx
// src/components/LocaleSwitcher.tsx
import { saveLocale, type Locale } from '../lib/locale-detect'
import { localizedHref } from '../lib/routes'

interface Props {
  currentLocale: Locale
  currentPath: string  // Текущий путь без префикса (e.g. '/periodic-table/')
}

const localeLabels: Record<Locale, string> = {
  ru: 'Рус',
  en: 'Eng',
  kk: 'Қаз',
}

export default function LocaleSwitcher({ currentLocale, currentPath }: Props) {
  function switchTo(locale: Locale) {
    saveLocale(locale)
    window.location.href = localizedHref(currentPath, locale)
  }

  return (
    <div className="locale-switcher">
      {(['ru', 'en', 'kk'] as Locale[]).map(locale => (
        <button
          key={locale}
          className={locale === currentLocale ? 'active' : ''}
          onClick={() => switchTo(locale)}
          aria-label={`Switch to ${localeLabels[locale]}`}
        >
          {localeLabels[locale]}
        </button>
      ))}
    </div>
  )
}
```

Размещение: в Nav.astro, справа от поиска. На мобильном — в бургер-меню.

#### Совместимость с текущим хранилищем

Проект уже использует localStorage для BKT P(L) значений и настроек. Ключ `preferred_locale` не конфликтует с существующими:

| Ключ | Назначение | Модуль |
|------|-----------|--------|
| `bkt_pl_*` | P(L) значения компетенций | `src/lib/storage.ts` |
| `diagnostics_*` | Состояние диагностики | `src/features/diagnostics/` |
| `preferred_locale` | **Новый**: выбранный язык | `src/lib/locale-detect.ts` |

---

## 8. Стратегия локализации данных

Независимо от выбранного подхода для UI, данные в JSON-бандлах требуют отдельной стратегии.

### Текущая структура

```
data-src/elements.json
  → [{ "id": "H", "name_ru": "Водород", "atomic_number": 1, ... }]
```

### Вариант 1: Параллельные файлы по локали

```
data-src/elements.json         → name_ru, appearance_ru, ...
data-src/elements.en.json      → { "H": { "name": "Hydrogen" }, ... }
data-src/elements.kk.json      → { "H": { "name": "Сутегі" }, ... }
```

Build pipeline генерирует:
```
public/data/{hash}/elements.json      → ru (default)
public/data/{hash}/elements.en.json   → en
public/data/{hash}/elements.kk.json   → kk
```

**Плюсы**: переводчик работает только с файлом своего языка; не надо менять основной JSON.
**Минусы**: синхронизация ключей между файлами; нужен скрипт проверки полноты.

### Вариант 2: Мультиязычные поля в одном файле

```json
{
  "id": "H",
  "name_ru": "Водород",
  "name_en": "Hydrogen",
  "name_kk": "Сутегі",
  "atomic_number": 1
}
```

Build pipeline извлекает нужную локаль при сборке.

**Плюсы**: все данные в одном месте; проще видеть пропуски.
**Минусы**: файлы растут × количество языков; переводчику нужен весь файл.

### Принятое решение

**Параллельные файлы** для всех данных — единообразно, проще для переводчиков, не нужно менять основной JSON.

Data loader адаптируется:
```typescript
// src/lib/data-loader.ts
export async function loadElements(locale: Locale = 'ru') {
  const manifest = await loadManifest()
  const base = await fetch(`/data/${manifest.hash}/elements.json`).then(r => r.json())
  if (locale === 'ru') return base
  const translations = await fetch(`/data/${manifest.hash}/elements.${locale}.json`).then(r => r.json())
  return mergeTranslations(base, translations)
}
```

---

## 9. Управление переводами (TMS)

### Платформы

| Платформа | Тип | Цена | Особенности |
|-----------|-----|------|-------------|
| **Crowdin** | SaaS | Бесплатно для open-source | Интеграция с GitHub, машинный перевод (Google, DeepL), in-context editing |
| **Weblate** | Open-source | Self-hosted бесплатно; облако от €45/мес | Git-native, FOSS-friendly, continuous translation |
| **Tolgee** | Open-source | Self-hosted бесплатно | In-context translation, SDK для React |
| **Pontoon** | Open-source | Self-hosted | Разработан Mozilla, фокус на сообщество |
| **Lokalise** | SaaS | От $120/мес | API-first, CI/CD интеграции, AI-перевод |

> Ref: [Weblate vs Crowdin — StackShare](https://stackshare.io/stackups/crowdin-vs-weblate) | [Crowdin.com](https://crowdin.com/) | [Tolgee — OpenAlternative](https://openalternative.co/tolgee)

### Рекомендация для проекта

Для некоммерческого образовательного проекта:

1. **Crowdin** (бесплатно для open-source) — если проект публичный. Лучший DX, интеграция с GitHub, machine translation.
2. **Weblate self-hosted** — если нужен полный контроль. Git-native подход идеально совпадает с CDN-first архитектурой.
3. **Без TMS на старте** — для 2-3 языков и <600 UI-строк можно управлять JSON-файлами в git. TMS добавить позже при масштабировании.

### Рабочий процесс перевода

```
Разработчик                   Переводчик                  CI/CD
     │                             │                         │
     ├─ добавляет ключ ─────────►  │                         │
     │  (messages/ru.json)         │                         │
     │                             │                         │
     │                    ◄── переводит ──►                  │
     │                    (messages/en.json)                  │
     │                             │                         │
     │                             ├──── push ─────────────► │
     │                             │                    проверка
     │                             │                   полноты
     │                             │                    ключей
     │                             │                         │
     ◄───────────── build с новыми переводами ──────────────┤
```

---

## 10. Принятое решение

> **Статус: утверждено (2026-02-21)**

### Конфигурация

| Аспект | Решение |
|--------|---------|
| **Подход** | A: Astro i18n + Paraglide.js |
| **UI-строки** | Paraglide — compile-time, tree-shakable, ~2 КБ, TypeScript автокомплит |
| **Данные** | Параллельные файлы по локали (`elements.en.json`, `elements.kk.json`) |
| **URL-пути** | Локализованные slug (`/kk/periodtyk-keste/`, `/en/periodic-table/`) |
| **Default локаль** | Русский — без префикса (`/periodic-table/`) |
| **Fallback** | English — если язык браузера не поддерживается |
| **Определение языка** | Баннер-предложение (не редирект, по рекомендации Google) |
| **Сохранение выбора** | `localStorage('preferred_locale')` |

### Как работает загрузка

**UI-строки — build-time, нулевая загрузка:**
```
npm run build →
  /periodic-table/index.html       ← русские строки вшиты в HTML
  /en/periodic-table/index.html    ← английские строки вшиты в HTML
  /kk/periodtyk-keste/index.html   ← казахские строки вшиты в HTML
```
Пользователь получает готовый HTML. Paraglide не добавляет runtime JS для статических страниц.

**Данные — on demand при монтировании React island:**
```
Пользователь на /en/periodic-table/
  → React island монтируется
  → loadElements('en')
  → fetch /data/{hash}/elements.json       ← базовые данные (числа, формулы)
  + fetch /data/{hash}/elements.en.json    ← английские названия (параллельно)
  → merge → отрисовка
```
Для русского — один fetch (как сейчас). Для других локалей — два параллельных fetch (база + переводы).

### Обоснование

1. **Соответствие архитектуре.** Static-first, минимальный JS, tree-shaking — все три принципа проекта. i18next добавляет 56 КБ runtime, самописное решение не даёт compile-time проверок.

2. **Масштаб.** ~582 UI-строки + ~1 881 контентных поля × 3 языка. Достаточно для compile-time проверок (Paraglide), недостаточно для оправдания runtime-библиотеки (i18next).

3. **TypeScript-first.** Опечатка в ключе = ошибка сборки, не пустая строка на продакшене.

4. **SEO.** Локализованные пути + hreflang + баннер (не редирект) — по рекомендациям Google.

5. **Параллельные файлы данных.** Переводчик работает с одним файлом своего языка; основной JSON не меняется; merge только в runtime.

### Альтернативы (для справки)

- **Подход B (самописное JSON)**: если принципиально не добавлять зависимости и языков будет ≤2
- **Подход C (i18next)**: если проект перейдёт на SSR/hybrid rendering

---

## 11. План миграции

### Фаза 0: Инфраструктура (без смены поведения для пользователя)

1. Настроить Astro i18n routing в `astro.config.mjs` (locales, defaultLocale, prefixDefaultLocale)
2. Установить `@inlang/paraglide-astro`, создать `project.inlang/settings.json`
3. Извлечь ~582 русских строки из компонентов в `messages/ru.json`
4. Создать `src/lib/routes.ts` — маппинг локализованных путей
5. Создать `src/lib/locale-detect.ts` — определение языка, работа с localStorage

### Фаза 1: UI на двух языках (русский + английский)

6. Заменить хардкод в компонентах на вызовы Paraglide `m.key()`
7. Создать `messages/en.json` — перевод UI-строк
8. Создать страницы для `/en/` маршрутов (через `getStaticPaths` или дублирование)
9. Добавить `LocaleSwitcher` в Nav (Рус / Eng)
10. Добавить `LocaleBanner` — предложение сменить язык
11. Обновить `BaseLayout.astro`: hreflang, og:locale, canonical URL
12. Обновить `astro.config.mjs` — sitemap с xhtml:link

### Фаза 2: Данные на английском

13. Создать параллельные файлы переводов: `data-src/elements.en.json`, `data-src/substances/*.en.json`, и т.д.
14. Расширить `scripts/build-data.mjs` — копировать `*.en.json` в бандл
15. Адаптировать `src/lib/data-loader.ts` — `loadElements(locale)`, параллельный fetch + merge
16. Генерировать `search_index.en.json` — английский поисковый индекс
17. Обновить `src/types/manifest.ts` — добавить локализованные entrypoints

### Фаза 3: Казахский язык

18. Создать `messages/kk.json`, `data-src/*.kk.json`
19. Добавить казахские маршруты с локализованными slug
20. Расширить `LocaleSwitcher`: Рус / Eng / Қаз
21. Обновить sitemap и hreflang для трёх локалей

### Фаза 4: Качество и автоматизация

22. CI проверка полноты переводов (inlang lint + скрипт проверки JSON-ключей)
23. (Опционально) Подключить TMS (Crowdin / Weblate)
24. Тесты: проверка что все маршруты генерируются для всех локалей

---

## 12. Ссылки

### Astro i18n

- [Astro Internationalization (i18n) Routing](https://docs.astro.build/en/guides/internationalization/) — официальная документация
- [Astro i18n Recipes](https://docs.astro.build/en/recipes/i18n/) — рецепты и примеры
- [Astro.js Localization: Static & Dynamic Content — Phrase](https://phrase.com/blog/posts/astro-js-localization-dynamic-static-content/)
- [Astro Localization Guide — BitDoze](https://www.bitdoze.com/astro-i18n-localization/)

### Paraglide.js

- [Paraglide.js GitHub](https://github.com/opral/paraglide-js) — исходный код, документация
- [Paraglide-Astro Integration — inlang](https://inlang.com/m/iljlwzfs/paraglide-astro-i18n) — интеграция с Astro
- [Paraglide.js Setup Guide](https://dropanote.de/en/blog/20250625-paraglide-js-setup-guide/) — пошаговая настройка
- [Why I Replaced i18next with Paraglide.js](https://dropanote.de/en/blog/20250726-why-i-replaced-i18next-with-paraglide-js/) — сравнение из практики
- [Paraglide.js — Type-Safe i18n — Medium](https://medium.com/@janszotkowski/paraglide-js-the-type-safe-compiler-based-i18n-library-you-should-know-about-53f5d242b6bb)
- [@inlang/paraglide-js — npm](https://www.npmjs.com/package/@inlang/paraglide-js)

### i18next

- [i18next documentation](https://www.i18next.com/) — официальная документация
- [react-i18next documentation](https://react.i18next.com/) — React-интеграция
- [i18next — npm](https://www.npmjs.com/package/i18next)
- [Best React i18n Libraries — Phrase](https://phrase.com/blog/posts/react-i18n-best-libraries/)
- [Internationalization in React: Complete Guide 2026 — GloryWebs](https://www.glorywebs.com/blog/internationalization-in-react)

### ICU MessageFormat и стандарты

- [ICU MessageFormat Guide — Phrase](https://phrase.com/blog/posts/guide-to-the-icu-message-format/)
- [ICU Message Format — Unicode Documentation](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [ICU Message Format — SimpleLocalize](https://simplelocalize.io/blog/posts/what-is-icu/)
- [ICU Message Syntax — Crowdin](https://crowdin.com/blog/icu-guide)

### TMS и управление переводами

- [Crowdin — Localization Platform](https://crowdin.com/)
- [Weblate — Open Source TMS](https://openalternative.co/weblate)
- [Tolgee — Open Source Translation](https://openalternative.co/tolgee)
- [Crowdin vs Weblate — StackShare](https://stackshare.io/stackups/crowdin-vs-weblate)
- [Best Translation Management Tools 2025 — SimpleLocalize](https://simplelocalize.io/blog/posts/best-translation-management-software-for-saas/)

### JSON локализация

- [How to translate JSON files — Lokalise](https://lokalise.com/blog/json-l10n/)
- [JSON Localization — Lingohub](https://lingohub.com/integrations/json-localization)
- [i18n and localization for JSON — Localazy](https://localazy.com/json)

### SEO и мультиязычные URL

- [Google — Tell Google about localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions) — hreflang, canonical, sitemap
- [Google — Managing multi-regional sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites) — URL-структуры, субдомены, подпапки
- [Astro Sitemap integration](https://docs.astro.build/en/guides/integrations-guide/sitemap/) — генерация sitemap с xhtml:link

### Общие ресурсы

- [Awesome Translations — GitHub](https://github.com/mbiesiad/awesome-translations) — курируемый список i18n/l10n ресурсов
- [The Turing Way — Translation of Open Source Projects](https://book.the-turing-way.org/community-handbook/translation/translation-localisation/)