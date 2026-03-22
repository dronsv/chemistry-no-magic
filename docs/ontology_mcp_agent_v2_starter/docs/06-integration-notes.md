# Integration Notes

## Suggested package layout in your repository

- `packages/ontology-mcp/`
- `packages/ontology-agent/`
- `packages/ontology-types/`
- `content/ontology/`
- `content/locales/`
- `content/search-overlays/`
- `content/didactic/`
- `content/review-queue/`

## Runtime dependencies

Recommended initial dependencies:

- `typescript`
- `zod`
- `fast-glob`
- `minisearch` or similar lightweight lexical index
- official MCP TypeScript SDK

Optional later:

- vector DB client
- sentence embedding pipeline
- reranker

## Storage recommendation for MVP

Use file-backed JSON bundles first.

Reason:
- easy diffing
- easy review in Git
- deterministic bootstrap outputs
- low implementation friction

## Mutation policy

First MVP should generate artifacts and review drafts, not mutate ontology core automatically.
