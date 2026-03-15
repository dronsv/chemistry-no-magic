# AI Agent Discovery

> Synthesized from: chemistry_seo_ai_package.zip + chemistry_taskgen_seo_ai_architecture.zip

## What AI Agents Need

AI agents work better with **structure** than with a huge number of URLs.

1. Чистые semantic pages (cleanly structured, not JS-heavy)
2. Ясные headings (H1/H2/H3 hierarchy)
3. Stable URLs (no query params, no hash-based navigation)
4. Good internal links (помогают агенту понять граф сайта)
5. `llms.txt` — curated site map for AI
6. Schema JSON-LD — semantic type signals
7. Sitemap XML — full URL list with dates

---

## llms.txt

**File:** `public/llms.txt`

Purpose: curated entry-point map for AI agents (ChatGPT, Claude, Perplexity).
Read during RAG queries on educational chemistry topics.

Format: plain Markdown, H1 + blockquote + H2 sections with links.

**llms.txt should:**
- Lead to the strongest entry pages
- Give a curated map of the site
- NOT duplicate the full content (that's llms-full.txt)

Sample (from packages):

```md
# Chemistry Without Magic

> Ontology-driven chemistry knowledge base with theory, practice, and exam preparation.

## Periodic Table
https://chemistry.svistunov.online/periodic-table/

## Chemical Bonds
https://chemistry.svistunov.online/bonds/

## Oxidation States
https://chemistry.svistunov.online/oxidation-states/

## Reactions
https://chemistry.svistunov.online/reactions/

## Calculations
https://chemistry.svistunov.online/calculations/

## Full Reference
https://chemistry.svistunov.online/llms-full.txt

## Sitemap
https://chemistry.svistunov.online/sitemap.xml
```

Add to `BaseLayout.astro`:
```html
<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt" />
```

---

## llms-full.txt

**File:** `public/llms-full.txt` (generated at build time)

Optional reference index. **Strict content policy:**

| Allowed | Prohibited |
|---------|------------|
| symbol, name, group, period, electronegativity (1–2 values per element) | Full element descriptions |
| Rule titles + 1-line summary | Full theory module text |
| Competency IDs + names | Full competency descriptions |
| Canonical URL per entity | Reproduced page content blocks |

**Rule:** `llms-full.txt` does NOT reproduce content from pages. It is a **pointer index** — concise facts + canonical links. If a section exceeds ~2KB, it likely has content duplication.

**Target size:** 50–80 KB. If it grows beyond 150 KB, audit for duplication.

**Generated from:**
- `data-src/elements.json` → 118 elements (symbol, name_ru, name_en, group, period, electronegativity)
- `data-src/rules/periodic-table-theory.json` → section titles only
- `data-src/rules/oxidation_rules.json` → 11 rule titles + brief summaries
- `data-src/rules/bond_theory.json` → bond type names
- `data-src/rules/competencies.json` → 20 competency IDs + names

**Build script:** `scripts/generate-llms-full.mjs`

---

## robots.txt AI Bot Directives

Strategy for educational content:
- **Allow** search bots → citations in AI answers = traffic
- **Block** training crawlers → protect content from training datasets

```robots
# AI search bots — allow (citations → traffic)
User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

# Training crawlers — block
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /
```

---

## What Is Especially Valuable for AI Agents

- Glossary / concept pages with definitions + examples
- Pages with consistent terminology across locales
- Entity relations (element → ions → compounds → reactions)
- Stable, semantic URLs (not UUIDs or hash-based)
- Structured data (Schema.org) that matches page content

---

## Connection to Task Engine

The task engine can supply **canonical worked examples** for pages:
- 1–3 representative examples per concept page
- Short explanations with ontology references
- Links to related theory

Build-time derived examples = better AI comprehension + better indexation signal.
