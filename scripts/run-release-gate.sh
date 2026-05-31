#!/usr/bin/env bash

set -euo pipefail

echo "[release-gate] validate data"
npm run validate:data

echo "[release-gate] root unit tests"
npm test

echo "[release-gate] ontology-mcp tests"
npm --prefix packages/ontology-mcp test

echo "[release-gate] e2e"
npm run test:e2e
