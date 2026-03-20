# Ontology MCP Write Tools

**Date**: 2026-03-20
**Status**: Draft (rev 2 — post-review fixes)

## Problem

The ontology MCP server (`packages/ontology-mcp/`) exposes 8 read-only tools for searching, browsing, and annotating the chemistry ontology. The enrichment agent can analyze and propose additions but cannot write to `data-src/` through MCP — it must fall back to raw file edits, losing the validation and structural guarantees the MCP provides.

## Goal

Add 24 write tools to the ontology MCP server, enabling the enrichment agent (and human MCP clients) to create, update, and audit ontology entities through a validated, type-safe API that writes directly to `data-src/` files.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary consumer | Agent-primary with human escape hatch (C) | Structured input for the agent, but validation protects against mistakes from any caller |
| Write strategy | Direct writes to disk (A) | Git provides undo; `npm run validate:data` catches structural issues; proposal layer would duplicate git |
| Tool granularity | Split by kind (B) | Storage formats differ per kind; specific schemas are clearer than union types |
| Similarity/gap detection | Rule-based in `coverage_report`; semantic similarity deferred to Phase 2 | Foundation write tools first; 80% of discovery value from structural checks |

## Architecture

### File Structure

```
packages/ontology-mcp/src/server/tools/write/
  _shared.ts           — shared read/write/validate utilities
  substance.ts         → add_substance, update_substance
  ion.ts               → add_ion, update_ion
  concept.ts           → add_concept, update_concept
  reaction.ts          → add_reaction, update_reaction
  process.ts           → add_process, update_process
  effect.ts            → add_effect, update_effect
  rule-term.ts         → add_rule_term, update_rule_term
  formula.ts           → add_formula, update_formula
  property.ts          → add_property, update_property
  characteristic.ts    → add_characteristic, update_characteristic
  translation.ts       → add_translation
  relation.ts          → add_relation
  list-entities.ts     → list_entities
  coverage-report.ts   → coverage_report
```

14 modules, 24 tools total.

### Shared Infrastructure (`_shared.ts`)

```ts
// Read + parse JSON file
readJsonFile(path: string): Promise<unknown>

// Write JSON with consistent formatting (2-space indent, trailing newline)
writeJsonFile(path: string, data: unknown): Promise<void>

// Validate ref format: "prefix:id" where prefix matches expected kind
// Valid prefixes: sub:, ion:, el:, cls:, concept:, prop:, rxtype:, rxfacet:, formula:, process:, effect:
validateRef(ref: string, expectedPrefix: string): { valid: boolean; id: string; error?: string }

// Resolve data-src path for a given kind
resolveDataPath(dataSrcRoot: string, kind: EntityKind): string

// After any write, rebuild the in-memory index so subsequent reads see changes
rebuildIndex(): Promise<OntologyIndex>
```

**Index rebuild**: The current server stores the index as `const index` in `index.ts`. To support mutable swaps, change to a wrapper: `const indexRef = { current: await buildOntologyIndex() }`. All tool closures receive `indexRef` (stable reference); `rebuildIndex()` replaces `indexRef.current`. Existing read tools change from `index` to `indexRef.current` — a mechanical find-and-replace.

**JSON formatting**: `JSON.stringify(data, null, 2) + '\n'` — matches existing file style.

### Indexer Extensions

The current `build-index.ts` does not load process vocab or effects vocab entries. Before write tools can add these kinds and have them appear in search/coverage:

- Add a step in `buildOntologyIndex()` to load `process_vocab.json` → create `process:{id}` entities
- Add a step to load `effects_vocab.json` → create `effect:{id}` entities
- Add `element_group` to KINDS_DESC (currently omitted)

## Tool Specifications

### Section A: Entity Write Tools

Each entity kind uses one of three storage strategies.

#### Strategy 1: Individual Files

**Substance** (`data-src/substances/{id}.json`)

Substance IDs in the data include the `sub:` prefix (e.g. `"sub:hcl"`). The file is named by the short ID (e.g. `hcl.json`).

`add_substance`:
- Input: `id` (string, e.g. "hcl" — without `sub:` prefix), `formula` (string), `class` (string), `subclass?`, `ions?` (string[]), `tags?` (string[]), `phase_standard?` ("g"|"l"|"s"|"aq"), `characteristics?` (object)
- Behavior: Creates `substances/{id}.json` with `"id": "sub:{id}"`. Fails if file already exists.
- Validation: `id` must be lowercase alphanumeric + underscores; `class` must match a known `cls:*` concept; `ions` refs must exist in index (warning if not).
- Returns: `{ ref: "sub:{id}", path: "substances/{id}.json", status: "created" }`

`update_substance`:
- Input: `id` (string), plus any fields from add_substance (all optional)
- Behavior: Reads existing file, shallow-merges provided fields, writes back. Fails if file doesn't exist.
- Returns: `{ ref: "sub:{id}", updated_fields: [...], status: "updated" }`

#### Strategy 2: Array-Based Files

**Ion** (`data-src/ions.json`)

Actual ion entry format: `{ id: "ion:H_plus", formula: "H⁺", type: "cation"|"anion", tags: string[], characteristics: { "concept:ion_charge": { value: number, unit: "unit:elementary_charge" } } }`

`add_ion`:
- Input: `id` (string, e.g. "ion:H_plus" — full ref), `formula` (string), `type` ("cation"|"anion"), `tags?` (string[]), `characteristics?` (object, e.g. `{ "concept:ion_charge": { value: 1, unit: "unit:elementary_charge" } }`)
- Behavior: Reads ions array, checks no duplicate `id`, appends entry, writes back.
- Validation: `id` must start with `ion:`; `id` must be unique in array.
- Returns: `{ ref: "{id}", index: <position>, status: "created" }`

`update_ion`:
- Input: `id` (string, full ref), plus any fields from add_ion (all optional)
- Behavior: Finds entry by `id` in array, merges fields, writes back. Fails if not found.
- Returns: `{ ref: "{id}", updated_fields: [...], status: "updated" }`

**Reaction** (`data-src/reactions/reactions.json`)

Actual reaction entry format is rich and multi-layered:
```json
{
  "reaction_id": "rx_neutral_01_hcl_naoh",
  "equation": "HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l)",
  "phase": { "medium": "aq", "note_key": "aqueous" },
  "conditions": { "temperature": "room" },
  "type_tags": ["exchange", "neutralization"],
  "driving_forces": ["water_formation", "weak_electrolyte_formation"],
  "molecular": {
    "reactants": [{ "formula": "HCl", "coeff": 1 }],
    "products": [{ "formula": "NaCl", "coeff": 1 }]
  },
  "ionic": {
    "full": "...", "net": "...",
    "spectators": ["ion:Na_plus", "ion:Cl_minus"]
  },
  "observations": { ... },
  "rate_tips": { ... },
  "heat_effect": "exo"|"endo"|"neutral",
  "safety_notes": [...],
  "competencies": [...],
  "template_id": "...",
  "schema_version": 1
}
```

`add_reaction`:
- Input: `reaction_id` (string), `equation` (string), `type_tags` (string[]), `molecular` (object with `reactants` and `products` arrays of `{ formula, coeff }`), `phase?` (object), `conditions?` (object), `driving_forces?` (string[]), `ionic?` (object), `observations?` (object), `rate_tips?` (object), `heat_effect?` (string), `safety_notes?` (array), `competencies?` (Record<string, string>, e.g. `{ "reactions_exchange": "P", "reaction_energy_profile": "S" }`), `template_id?` (string), `schema_version?` (number, default 2)
- Behavior: Reads array, checks no duplicate `reaction_id`, appends, writes back.
- Validation: `reaction_id` must be unique; `molecular.reactants` and `molecular.products` must each have at least one entry.
- Returns: `{ reaction_id, status: "created" }`

`update_reaction`:
- Input: `reaction_id`, plus any fields (all optional)
- Behavior: Find by `reaction_id`, deep-merge, write back. Fails if not found.

**Formula** (`data-src/foundations/formulas.json`)

Actual formula entries have a rich structure with AST-based expressions:
```json
{
  "id": "formula:molar_mass_from_composition",
  "kind": "definition",
  "domain": "stoichiometry",
  "school_grade": [8],
  "variables": [
    { "symbol": "M", "quantity": "q:molar_mass", "unit": "unit:g_per_mol", "role": "result" }
  ],
  "expression": { "op": "sum", "over": "i", "term": { "op": "multiply", "operands": ["Ar_i", "count_i"] } },
  "result_variable": "M",
  "invertible_for": [],
  "inversions": {},
  "constants_used": [],
  "prerequisite_formulas": [],
  "used_by_solvers": ["solver.molar_mass"]
}
```

`add_formula`:
- Input: `id` (string, e.g. "formula:ideal_gas"), `kind` (string), `domain` (string), `school_grade` (number[]), `variables` (array of `{ symbol, display_symbol?, quantity, unit, role }`), `expression` (object — AST node), `result_variable` (string), `invertible_for?` (string[]), `inversions?` (object), `constants_used?` (string[]), `prerequisite_formulas?` (string[]), `used_by_solvers?` (string[])
- Behavior: Array append, duplicate check by `id`.
- Returns: `{ ref: "{id}", status: "created" }`

`update_formula`:
- Input: `id`, plus any fields (all optional)

**Process** (`data-src/process_vocab.json`)

This is an **array** file, not an object. Actual format: `{ id, kind, params?, parent?, effects? }`

`add_process`:
- Input: `id` (string), `kind` ("chemical"|"driving_force"|"physical"|"operation"|"constraint"), `params?` (string[]), `parent?` (string), `effects?` (array of string or `{ id, when }` objects)
- Behavior: Reads array, checks no duplicate `id`, appends entry, writes back.
- Returns: `{ ref: "process:{id}", status: "created" }`

`update_process`:
- Input: `id`, plus any fields (all optional)

**Effect** (`data-src/effects_vocab.json`)

This is an **array** file. Actual format: `{ id, category }`

`add_effect`:
- Input: `id` (string), `category` ("kinetic"|"thermodynamic"|"mass_transfer"|"phase")
- Behavior: Reads array, checks no duplicate `id`, appends entry, writes back.
- Returns: `{ ref: "effect:{id}", status: "created" }`

`update_effect`:
- Input: `id`, `category?`

**Rule Term** (`data-src/vocab/rule_terms.json`)

This is a **flat string array** (e.g. `["condition:heating", "product:precipitate", ...]`), not an object or array of objects.

`add_rule_term`:
- Input: `term` (string, e.g. "condition:cooling" — namespaced string)
- Behavior: Reads string array, checks for duplicates, appends, writes back sorted.
- Returns: `{ term, status: "created" }`

`update_rule_term`:
- Input: `old_term` (string), `new_term` (string)
- Behavior: Finds and replaces the string. Fails if `old_term` not found.
- Returns: `{ old_term, new_term, status: "updated" }`

**Property** (`data-src/rules/properties.json`)

This is an **array** file. Actual format:
```json
{
  "id": "electronegativity",
  "value_field": "electronegativity",
  "object": "element",
  "unit": null,
  "trend_hint": { "period": "increases", "group": "decreases" },
  "filter": { "min_Z": 1, "max_Z": 86, "exclude_groups": [18] },
  "concept_ref": "concept:electronegativity",
  "i18n": {
    "ru": { "nom": "электроотрицательность", "gen": "электроотрицательности" },
    "en": { "name": "electronegativity" },
    "pl": { "name": "elektroujemność" },
    "es": { "name": "electronegatividad" }
  }
}
```

Note: Properties have inline `i18n` (unlike most entities which use translation overlays). This is a legacy pattern that may be migrated later.

`add_property`:
- Input: `id` (string), `value_field` (string), `object` ("element"|"substance"|"ion"), `unit` (string|null), `concept_ref` (string), `trend_hint?` (object), `filter?` (object), `i18n` (object with per-locale name/forms), `explanation_concept_ref?` (string), `conditions_schema?` (object)
- Behavior: Reads array, checks no duplicate `id`, appends, writes back.
- Returns: `{ ref: "prop:{id}", status: "created" }`

`update_property`:
- Input: `id`, plus any fields (all optional)

#### Strategy 3: Object-Based Files

**Concept** (`data-src/concepts.json`)

`add_concept`:
- Input: `ref` (string, e.g. "cls:oxide_basic" or "concept:electronegativity"), `kind` ("substance_class"|"element_group"|"reaction_type"|"reaction_facet"|"domain_concept"|"process"|"property"), `parent_id?` (string), `order?` (number), `filters?` (object), `examples?` (object[]), `children_order?` (string[]), `classification_facets?` (array of `{ facet_ref, children }`), `admission?` (object, see below)
- Behavior: Reads concepts object, checks key doesn't exist, adds entry, writes back.
- Validation: `ref` must have valid prefix (`cls:`, `concept:`, `prop:`, `rxtype:`, `rxfacet:`); `parent_id` if provided must exist in concepts.
- **Semantic guards** (medium-risk tool): `admission` block is optional but recommended:
  ```json
  {
    "admission": {
      "reason": "new reusable domain concept",
      "nearest_existing_refs": ["concept:acid_dissociation"],
      "non_redundancy_note": "no existing concept covers proton affinity"
    }
  }
  ```
  If `admission` is omitted, a warning is returned: `"concept created without admission metadata"`.
- Returns: `{ ref, status: "created", warnings?: [...] }`

`update_concept`:
- Input: `ref`, plus any fields (all optional)
- Behavior: Find by key, merge, write back. Fails if not found.

#### Embedded Kind

**Characteristic** (inside `data-src/substances/{substance_id}.json`)

`add_characteristic`:
- Input: `substance_id` (string, short ID without `sub:` prefix), `concept_ref` (string), `value` (number|string), `unit` (string), `conditions?` (object), `source?` (string), `explanation?` (string)
- Behavior: Reads substance file, adds to `characteristics[concept_ref]`. Fails if that characteristic already exists on the substance.
- Validation: substance file must exist; `concept_ref` should be a known property/concept (warning if not).
- Returns: `{ substance_ref: "sub:{substance_id}", concept_ref, status: "created" }`

`update_characteristic`:
- Input: same as add, but overwrites existing. Fails if characteristic not found.
- Returns: `{ substance_ref, concept_ref, updated_fields: [...], status: "updated" }`

### Section B: Cross-Cutting Tools

#### `add_translation`

Writes to `data-src/translations/{locale}/{data_key}.json`.

Input:
- `locale`: `"ru"` | `"en"` | `"pl"` | `"es"`
- `data_key`: overlay file name — `"substances"`, `"ions"`, `"concepts"`, `"elements"`, `"process_vocab"`, `"effects_vocab"`, `"competencies"`, `"rule_terms"`, `"properties"`, etc.
- `entity_id`: the key within the overlay file. **Key conventions vary by kind:**
  - Substances: short ID without prefix (e.g. `"hcl"`)
  - Ions: full ref (e.g. `"ion:H_plus"`)
  - Concepts: full ref (e.g. `"cls:oxide"`)
  - Elements: bare symbol (e.g. `"Na"`)
- `fields`: object with translated fields (`name`, `description`, `surface_forms?`, `forms?`, etc.)

Behavior:
- Reads overlay file (or creates empty object if file doesn't exist).
- Deep-merges `fields` into `entity_id` entry.
- Writes back.

Validation:
- `locale` must be one of the 4 supported locales.
- `data_key` must match a known overlay file pattern.
- Warning (not error) if `entity_id` doesn't match a known entity in the index.

Returns: `{ locale, data_key, entity_id, merged_fields: [...], status: "updated"|"created" }`

#### `add_relation`

Appends triples to `data-src/relations/{file}.json`.

Input:
- `file`: relation file name — `"acid_base_relations"`, `"ion_roles"`, `"has_naming_rule"`, or a new filename
- `triples`: array of objects:
  ```
  {
    subject: string,      // entity ref
    predicate: string,    // relation type
    object: string,       // entity ref
    step?: number,
    knowledge_level?: "strict_chemistry" | "school_convention" | "pedagogical",
    source_kind?: string,
    condition?: string
  }
  ```

Behavior:
- Reads existing array (or creates empty array if new file).
- Deduplicates: skips triples where subject+predicate+object already exist.
- Appends new triples, writes back.

Validation:
- `subject` and `object` refs should exist in the index (warning if not).
- `predicate` is checked against predicates found in existing relation files (warning if new predicate — not a hard error, since new predicates are valid).

Returns: `{ file, added: <count>, skipped_duplicates: <count>, status: "updated" }`

#### `list_entities`

Input:
- `kind`: one of the OntRefKind values (`element`, `substance`, `ion`, `concept`, `substance_class`, `element_group`, `reaction_type`, `reaction_facet`, `domain_concept`, `formula`, `process`, `property`), or `"all"`
- `limit?`: max results (default 100, max 500)
- `offset?`: for pagination (default 0)

Returns: `{ kind, total, items: [{ ref, kind, formula?, labels }] }`

Lightweight summaries — no full entity payloads.

#### `coverage_report`

Input:
- `kind`: entity kind to audit, or `"all"`
- `locales?`: which locales to check (default: all 4)
- `check`: `"translations"` | `"characteristics"` | `"relations"` | `"all"`

Returns:
```
{
  summary: {
    total_entities: number,
    translations: { [locale]: { covered: number, missing: number } },
    characteristics: { with_any: number, without: number },
    relations: { with_any: number, orphaned: number }
  },
  gaps: [
    // Rule-based gap detection:
    { type: "missing_translation", ref: "sub:hcl", locale: "es" },
    { type: "missing_conjugate", ref: "sub:hcl", detail: "acid with no conjugate_base relation" },
    { type: "dangling_ion_ref", ref: "sub:nacl", detail: "references ion:Na_plus which is missing" },
    { type: "no_characteristics", ref: "sub:h2o2" },
    { type: "concept_no_examples", ref: "cls:amphoteric_oxide" },
    { type: "orphaned_ion", ref: "ion:XY_minus", detail: "not referenced by any substance" }
  ]
}
```

Rule-based gap detection checks:
- Entities missing translations per locale
- Substances with `class: "acid"` but no conjugate base relation
- Substances referencing ions not in `ions.json`
- Substances with no characteristics
- Concepts with no examples
- Ions not referenced by any substance

## Index Lifecycle

```
Tool call received
  → validate input (Zod schema)
  → read file from data-src/
  → modify in memory
  → write file back to data-src/
  → call rebuildIndex() → replaces indexRef.current
  → return result
```

The `rebuildIndex()` call after each write ensures the in-memory `OntologyIndex` stays consistent. All existing read tools (search, get_entity, get_neighbors, etc.) immediately see the new data via `indexRef.current`.

**Prerequisite**: Refactor `index.ts` from `const index = await buildOntologyIndex()` to `const indexRef = { current: await buildOntologyIndex() }`. All tool closures switch from `index` to `indexRef.current`. This is a mechanical change.

## Error Handling

All tools return structured errors:

```
{ error: true, code: "ENTITY_EXISTS" | "NOT_FOUND" | "INVALID_REF" | "VALIDATION_FAILED", message: string }
```

Warnings (non-fatal) are returned alongside success:

```
{ status: "created", warnings: ["ion:XY_plus not found in index — may not exist yet"] }
```

## Concurrency

Single-user scenario expected. If concurrent tool calls modify the same file, last-write-wins. For safety, each write tool reads the file immediately before modification (no caching). If concurrent writes become an issue, a simple per-file advisory lock can be added later.

## Risk Tiers

Tools are classified by the potential for ontology pollution or structural damage:

| Tier | Tools | Governance |
|------|-------|------------|
| **Low risk** | `add_translation`, `add_characteristic`, `update_characteristic`, `list_entities`, `coverage_report` | Direct write, standard validation |
| **Medium risk** | `add_substance`, `update_substance`, `add_concept`, `update_concept`, `add_ion`, `update_ion`, `add_property`, `update_property`, `add_relation` | Direct write + validation warnings + optional `admission` metadata |
| **High risk** | `add_reaction`, `update_reaction`, `add_formula`, `update_formula`, `add_process`, `update_process`, `add_effect`, `update_effect`, `add_rule_term`, `update_rule_term` | Direct write + validation warnings; these tools affect solver semantics or have complex schemas |

All tiers write directly — the tier system adds progressively richer validation feedback, not access control. High-risk tools return `requires_review: true` in the response to signal that the enrichment agent should flag the change for human review.

## Phased Rollout

Not all 24 tools ship at once. Implementation proceeds in three phases.

### Phase 1: Core Enrichment Loop (14 tools)
Infrastructure + the tools that cover the majority of enrichment workflow:
1. `indexRef` refactor (prerequisite)
2. Indexer extensions (process/effect entity loading)
3. `_shared.ts` utilities
4. `list_entities`
5. `coverage_report`
6. `add_translation`
7. `add_relation`
8. `add_characteristic`, `update_characteristic`
9. `add_substance`, `update_substance`
10. `add_concept`, `update_concept`

### Phase 2: Extended Entity Types (8 tools)
- `add_ion`, `update_ion`
- `add_property`, `update_property`
- `add_process`, `update_process`
- `add_effect`, `update_effect`

### Phase 3: Complex Schemas (4 tools)
- `add_reaction`, `update_reaction` (richest nested schema)
- `add_formula`, `update_formula` (AST expressions)
- `add_rule_term`, `update_rule_term` (simple but last priority)

Each phase is independently shippable and testable.

## Testing Strategy

Per-module unit tests in `packages/ontology-mcp/src/__tests__/write/`:
- Each test creates a temp copy of relevant `data-src/` files
- Tests add/update operations and verify file output
- Tests verify index rebuild picks up changes
- Tests verify validation rejects bad input

## Future Work

- `find_similar` — semantic similarity across entity pairs (structural + label + graph signals)
- `suggest_relations` — propose missing relations based on shared characteristics, common ions, class patterns
- Batch operations — `add_substances` (plural) for bulk enrichment
- Migrate property `i18n` inline fields to translation overlays
- Predicate registry — transition from soft warning to two-mode system (known predicate = safe, new predicate = explicit `register_predicate` call)
- Audit log — append-only record of write operations for traceability
