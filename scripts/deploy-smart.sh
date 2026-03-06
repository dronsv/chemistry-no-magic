#!/usr/bin/env bash
# Deploy script. By default skips build:data if data-src/ is unchanged.
# Usage:
#   npm run deploy         — smart (skip data rebuild if unchanged)
#   npm run deploy:all     — always rebuild everything
set -euo pipefail

FULL="${1:-}"
DATA_CHANGED=false

# ── Data build ──────────────────────────────────────────────────────────────
if [ "$FULL" = "--all" ]; then
  echo "=== Full rebuild ==="
  node scripts/build-data.mjs
  DATA_CHANGED=true
else
  STATE_FILE=".deploy-data-hash"
  current_hash() {
    find data-src -type f | sort | xargs sha256sum 2>/dev/null | sha256sum | cut -c1-16
  }
  CURRENT=$(current_hash)
  LAST=$(cat "$STATE_FILE" 2>/dev/null || echo "")

  if [ "$CURRENT" != "$LAST" ]; then
    echo "data-src changed — rebuilding data bundle..."
    node scripts/build-data.mjs
    echo "$CURRENT" > "$STATE_FILE"
    DATA_CHANGED=true
  else
    echo "data-src unchanged — skipping build:data"
  fi
fi

# ── llms-full.txt ────────────────────────────────────────────────────────────
node scripts/generate-llms-full.mjs

# ── Astro build ─────────────────────────────────────────────────────────────
echo "Building Astro..."
astro build
cp dist/sitemap-index.xml dist/sitemap.xml

# ── Upload to S3 ─────────────────────────────────────────────────────────────
echo "Deploying to S3..."
bash scripts/deploy.sh

# ── IndexNow (submit section pages on data changes) ──────────────────────────
if [ "$DATA_CHANGED" = "true" ]; then
  node scripts/indexnow-submit.mjs || echo "IndexNow: skipped (no key or network error)"
fi
