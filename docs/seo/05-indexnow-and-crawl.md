# IndexNow + Crawl Acceleration

> Synthesized from: chemistry_seo_ai_package.zip

## IndexNow Protocol

Notifies Yandex + Bing immediately when pages change.
No delay waiting for crawl — instant re-index signal.

### Setup Steps

1. **Generate key** (random UUID-like string, e.g. `a1b2c3d4e5f6`)

2. **Create key file** at: `public/indexnow-{KEY}.txt`
   Content = the key string itself.

3. **Store key** in `.env`:
   ```
   INDEXNOW_KEY=a1b2c3d4e5f6
   ```
   Add `.env` to `.gitignore`.

4. **Submit on deploy** via `scripts/indexnow-submit.mjs`:

```js
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    host: 'chemistry.svistunov.online',
    key: process.env.INDEXNOW_KEY,
    keyLocation: `https://chemistry.svistunov.online/indexnow-${process.env.INDEXNOW_KEY}.txt`,
    urlList: [
      'https://chemistry.svistunov.online/',
      'https://chemistry.svistunov.online/periodic-table/',
      'https://chemistry.svistunov.online/bonds/',
      // ... all section pages × 4 locales (~40 URLs)
    ]
  })
});
```

### When to Submit

Recommended strategy:
- Submit **section pages** (not all 118 element pages — limit: 10k URL/day)
- Trigger on **data changes** (when `data-src/` hash changes)
- Hook into `scripts/deploy-smart.sh` after deploy

```bash
# In deploy-smart.sh:
DATA_CHANGED=false
if [ "$CURRENT" != "$LAST" ]; then
  node scripts/build-data.mjs
  DATA_CHANGED=true
fi
# ... astro build + deploy ...
if [ "$DATA_CHANGED" = "true" ]; then
  node scripts/indexnow-submit.mjs || echo "IndexNow: skipped (no key)"
fi
```

---

## URL List to Submit (~40 URLs)

Section pages per locale (ru/en/pl/es):
- `/` (homepage, all 4 locales)
- `/periodic-table/`, `/en/periodic-table/`, `/pl/tablica-okresowa/`, `/es/tabla-periodica/`
- `/bonds/`, `/en/bonds/`, `/pl/wiazania/`, `/es/enlaces/`
- `/oxidation-states/`, `/en/oxidation-states/`, `/pl/stopnie-utlenienia/`, `/es/estados-oxidacion/`
- `/reactions/`, `/en/reactions/`, `/pl/reakcje/`, `/es/reacciones/`
- `/calculations/`, `/en/calculations/`, `/pl/obliczenia/`, `/es/calculos/`
- `/ions/`, `/en/ions/`, `/pl/jony/`, `/es/iones/`
- `/substances/`, `/en/substances/`, `/pl/substancje/`, `/es/sustancias/`
- `/competencies/`, `/en/competencies/`, `/pl/kompetencje/`, `/es/competencias/`

Total: ~40 URLs. Well within 10k/day limit.
