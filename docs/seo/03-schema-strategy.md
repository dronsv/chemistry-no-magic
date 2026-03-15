# Schema.org Strategy

> Synthesized from: chemistry_seo_ai_package.zip + chemistry_taskgen_seo_ai_architecture.zip

## Schema Types to Implement

### Organization (global, in BaseLayout)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Химия без магии",
  "url": "https://chemistry.svistunov.online",
  "logo": "https://chemistry.svistunov.online/icons/icon-512.png",
  "sameAs": ["https://github.com/dronsv/chemistry-no-magic"]
}
```

**Status:** Not yet implemented → add to `src/layouts/BaseLayout.astro`

---

### Dataset (periodic table page — very powerful for science sites)

```json
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "Таблица Менделеева",
  "description": "Машиночитаемые данные о 118 химических элементах: свойства, электронные конфигурации, степени окисления",
  "url": "https://chemistry.svistunov.online/periodic-table/",
  "creator": {
    "@type": "Organization",
    "name": "Химия без магии"
  },
  "inLanguage": ["ru", "en", "pl", "es"]
}
```

**Status:** Not yet implemented → add to periodic-table index page
**Note:** `Dataset` schema дает strong topical authority signal для science/educational sites.

---

### Course (section pages)

```json
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "Химические связи и кристаллические решётки",
  "provider": {
    "@type": "Organization",
    "name": "Химия без магии",
    "url": "https://chemistry.svistunov.online"
  },
  "educationalLevel": "9–11 класс",
  "inLanguage": "ru",
  "teaches": ["ковалентная связь", "ионная связь", "металлическая связь", "водородная связь"],
  "availableLanguage": ["ru", "en", "pl", "es"]
}
```

**Pages:** bonds, calculations, oxidation-states (×4 locales each)
**Status:** Not yet implemented

---

### LearningResource (existing, on periodic-table page)

Already implemented: `LearningResource` on periodic-table pages.
Extend to: substance pages, reaction pages when Tier B is built.

---

### Quiz (exam/diagnostic pages)

Already implemented on exam pages.

```json
{
  "@context": "https://schema.org",
  "@type": "Quiz",
  "about": "Oxidation states",
  "educationalLevel": "Grade 9-11"
}
```

---

## Priority Order

| Schema Type | Page | Priority |
|-------------|------|----------|
| `Organization` | All pages (BaseLayout) | **High** — missing |
| `Dataset` | `/periodic-table/` | **High** — strong science signal |
| `Course` | bonds, calculations, oxidation-states (×4 locales) | **Medium** |
| `LearningResource` | substance/reaction pages (future) | Low (Tier B) |

---

---

## Semantic Match Rule (Anti-Inflation)

**Schema type is applied ONLY when the page actually matches the type.**

| Schema | Apply only when |
|--------|-----------------|
| `Course` | Page is a full topic/section page with theory content and practice |
| `Dataset` | Page presents actual data reference (elements, ions, etc.), not just browse |
| `LearningResource` | Page contains real exercises or interactive learning content |
| `Quiz` | Page is an actual assessment with questions and scoring |
| `Organization` | Homepage or globally — once |

**Prohibited uses:**
- `Course` on a browse/filter page
- `LearningResource` on a static section hub with no exercises
- `Dataset` on a list page with minimal content

---

## Implementation Notes

- Use Astro's `<slot name="head">` in BaseLayout for page-specific schema
- Locale-aware: Course schema uses translated `name`, `teaches` array, `inLanguage`
- Organization schema: inject once globally in BaseLayout (all locales share)
- Always verify schema in Google Rich Results Test before shipping
