# Ontology MCP + Agent v2 Starter Package

Implementation-oriented starter package for a chemistry ontology authoring stack.

## Goal

Provide a working blueprint and code skeleton for:

- an MCP server that exposes ontology lookup, validation, proposal, and bootstrap tools;
- an `ontology-author` agent that uses the MCP server deterministically first, and LLM reasoning second;
- a bootstrap pass over existing course pages/explanations to bind existing text to canonical ontology refs;
- a formal admission policy for adding new ontology elements without polluting canonical core.

## Package contents

- `docs/01-architecture-v2.md`
- `docs/02-mcp-contract-v2.md`
- `docs/03-agent-runtime-v2.md`
- `docs/04-bootstrap-pass-v2.md`
- `docs/05-admission-policy-v2.md`
- `docs/06-integration-notes.md`
- `docs/07-implementation-plan.md`
- `schemas/*.json`
- `examples/*.json`
- `src/shared/*`
- `src/server/*`
- `templates/system-prompt-ontology-author.txt`
- `templates/review-checklist.md`

## Intended stack

- TypeScript
- Node.js 20+
- MCP TypeScript SDK
- file-backed ontology bundles initially
- optional vector index later

## Design principles

1. Canonical ontology is language-neutral.
2. Human text lives in overlays and didactic content.
3. Lookup uses `material_language + en`.
4. Deterministic retrieval comes before semantic retrieval.
5. New core entities are rare and go through proposal/review.
6. Existing corpus ontologization is the first production workload.

## Recommended first implementation sequence

1. Implement in-memory loader and indexes.
2. Implement MCP tools: `search_entities`, `get_entity`, `resolve_mention`, `validate_annotation`.
3. Implement bootstrap CLI against current pages.
4. Add proposal generation and review queue.
5. Add semantic retrieval as optional second-pass rerank/recall.

## Suggested repository placement

- `packages/ontology-mcp/`
- `packages/ontology-agent/`
- `content/ontology/`
- `content/locales/`
- `content/search-overlays/`
- `content/didactic/`
- `content/review-queue/`
