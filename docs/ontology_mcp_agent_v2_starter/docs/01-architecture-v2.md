# Architecture v2

## System boundary

The system consists of four layers:

1. **Canonical ontology core**
2. **Localization/search overlays**
3. **MCP server**
4. **Ontology-author agent**

## Layer 1: Canonical ontology core

Canonical ontology contains only language-independent entities and relations.

Examples:

- `concept:*`
- `substance:*`
- `ion:*`
- `element:*`
- `reaction:*`
- `reaction_type:*`
- typed relations and structural properties

This layer must not contain locale-suffixed text fields.

## Layer 2: Overlays

### Localization overlays

Used for display and authoring context:

- labels
- aliases
- short definitions
- optional pedagogical notes

### Search overlays

Used for reverse search and mention resolution:

- aliases
- author phrases
- paraphrases
- morphology variants
- common learner wording
- import synonyms from external corpora

Lookup policy is:

- primary: `material_language`
- fallback: `en`

## Layer 3: MCP server

The MCP server is the operational interface to ontology data.

### Responsibilities

- load ontology core and overlays into memory;
- build deterministic indexes;
- expose tools/resources/prompts;
- validate annotations;
- classify addition type;
- emit proposals instead of mutating core directly;
- support bootstrap passes over current pages.

### Retrieval order

1. exact ref/formula/symbol lookup
2. normalized label/alias lookup
3. token/ngram lookup
4. contextual mention resolution
5. optional semantic recall/rerank
6. graph-based consistency checks

## Layer 4: Agent

The agent is not the source of truth. It is a guided orchestrator.

### Responsibilities

- parse text into candidate mentions;
- call MCP tools;
- pick the best canonical ref or mark ambiguity;
- produce annotated output;
- propose missing elements only after admission checks;
- generate review-ready proposal cards.

## First production workflow

The first real workflow is **bootstrap ontologization of existing pages**.

This should produce:

- annotations;
- unresolved mentions;
- alias suggestions;
- proposal drafts;
- coverage reports.

## Deployment shape

### Phase 1

- local file-backed ontology bundles
- stdio MCP transport
- CLI bootstrap pipeline
- JSON output artifacts

### Phase 2

- review queue storage
- server-side caching
- optional HTTP transport
- optional vector retrieval layer

### Phase 3

- CI validation
- authoring UI
- preview cards
- integrated didactic ingestion
