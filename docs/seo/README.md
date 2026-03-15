# SEO & AI-Agent Optimization Docs

Source packages analyzed:
- `chemistry_taskgen_seo_ai_architecture.zip` — Full architecture: ontology → SEO → AI agents
- `chemistry_seo_ai_package.zip` — Core SEO package: internal links, schema, IndexNow, AI optimization
- `chemistry_ontology_seo_graph.zip` — Knowledge graph approach: entities, clusters, link generation
- `chemistry_seo_scale_policy.zip` — Indexing tiers (A/B/C), growth strategy, lightweight architecture

## Documents

| File | Status | Topic |
|------|--------|-------|
| `01-architecture.md` | ✅ Reviewed | System architecture: ontology → pages → SEO → AI; Tier A/B/C; Sitemap admission policy |
| `02-internal-link-graph.md` | ✅ Reviewed | Ontology-driven internal linking + link count limits |
| `03-schema-strategy.md` | ✅ Reviewed | Schema.org types + semantic match rule (anti-inflation) |
| `04-ai-agent-discovery.md` | ✅ Reviewed | llms.txt, llms-full.txt (strict anti-duplication), robots.txt |
| `05-indexnow-and-crawl.md` | ✅ Reviewed | IndexNow setup for Yandex + Bing (phase 1 scope) |
| `06-page-templates.md` | ✅ Reviewed | Full templates: element, theory, ion, reaction (all 8 blocks), substance, concept |

## Architecture Invariants (Non-Negotiable)

1. **One ontology, four outputs** — learning runtime, task generation, SEO pages, AI discovery
2. **Derived semantic layer** — integration point; no logic duplication across outputs
3. **Tier C is UX-only** — group/period/filter pages never become SEO targets
4. **Static shell + lazy islands** — indexable HTML always server-rendered
5. **Internal links as primary SEO lever** — graph before page expansion

## Key Policy Rules

- **Sitemap admission:** ≥4 semantic blocks + ≥3 incoming links + unique intent + canonical URL
- **llms-full.txt:** pointer index only, no content reproduction, target 50–80 KB
- **Schema:** apply only when page semantically matches the schema type
- **Tier B:** start with 5–10 ions + 5 concept pages; measure before expanding
- **Reaction pages:** require all 8 template blocks before indexing

## Phase 1 Implementation

See plan: `/home/andrey/.claude/plans/pure-beaming-parasol.md`

1. `public/llms.txt` — static AI entry point
2. `public/robots.txt` — AI bot directives (allow search bots, block training crawlers)
3. `scripts/generate-llms-full.mjs` — build-time pointer index
4. `scripts/indexnow-submit.mjs` — deploy hook (~40 section URLs)
5. `BaseLayout.astro` — Organization schema (global) + Dataset schema (/periodic-table/)
6. Section pages — Course schema (bonds, calculations, oxidation-states × 4 locales)
7. `BaseLayout.astro` — preconnect storage.yandexcloud.net + RSS feed link
