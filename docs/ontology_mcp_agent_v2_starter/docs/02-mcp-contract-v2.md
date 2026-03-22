# MCP Contract v2

This package assumes a modern MCP server that exposes tools, resources, and prompts.

## Server capabilities

### Tools

#### `search_entities`
Search ontology entities by text, alias, symbol, formula, and optionally by kind.

Input:
- `query: string`
- `kinds?: OntRefKind[]`
- `languages?: string[]`
- `limit?: number`

Output:
- ranked candidates with `ref`, `kind`, `score`, `match_reason`

#### `get_entity`
Return a normalized entity card.

Input:
- `ref: string`
- `languages?: string[]`

Output:
- canonical fields
- overlay text for requested languages
- selected related refs

#### `get_neighbors`
Return graph neighbors by relation type.

Input:
- `ref: string`
- `relation_types?: string[]`
- `limit?: number`

#### `resolve_mention`
Resolve one span in context.

Input:
- `mention: string`
- `left_context?: string`
- `right_context?: string`
- `material_language: string`
- `kinds?: OntRefKind[]`

Output:
- `best_candidate?`
- `candidates[]`
- `ambiguity?`
- `proposed_action`

#### `suggest_refs_for_text`
Analyze a text block and return candidate bindings.

Input:
- `text: string`
- `material_language: string`
- `mode: 'didactic' | 'definition' | 'task' | 'explanation'`

Output:
- mention spans
- candidate refs
- unresolved spans
- overlay suggestions
- proposal suggestions

#### `validate_annotation`
Validate annotation against ontology and policy.

Input:
- `material_language: string`
- `text: string`
- `annotations: Annotation[]`

Output:
- `valid`
- `errors[]`
- `warnings[]`
- `repair_suggestions[]`

#### `classify_addition`
Determine what kind of change is needed.

Input:
- `candidate_text: string`
- `material_language: string`
- `context?: string`
- `nearest_refs?: string[]`

Output:
- `addition_type`
- confidence
- rationale
- recommended target layer

#### `create_proposal_draft`
Build a proposal object without committing.

Input:
- candidate content plus evidence and nearest refs

Output:
- proposal JSON

#### `bootstrap_document`
Run a complete document pass.

Input:
- `doc_id: string`
- `material_language: string`
- `text: string`
- `mode`

Output:
- annotation result
- coverage metrics
- unresolved list
- proposal drafts

## Resources

- `ontology://schema/kinds`
- `ontology://schema/relations`
- `ontology://entity/{ref}`
- `ontology://policy/admission`
- `ontology://policy/lookup/{material_language}`
- `ontology://fewshot/authoring`
- `ontology://fewshot/review`

## Prompts

- `author_didactic_block`
- `annotate_existing_text`
- `review_annotation`
- `propose_missing_entity`
- `repair_annotation`

## Notes for implementation

- list operations should support pagination where result volume can grow;
- server responses should carry machine-readable reasons for ranking and validation;
- proposal creation must be side-effect free by default;
- mutation should remain outside the first MVP.
