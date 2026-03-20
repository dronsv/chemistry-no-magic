# Ontology MCP Write Tools

**Date**: 2026-03-20
**Status**: Draft

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
validateRef(ref: string, expectedPrefix: string): { valid: boolean; id: string; error?: string }

// Resolve data-src path for a given kind
resolveDataPath(dataSrcRoot: string, kind: EntityKind): string

// After any write, rebuild the in-memory index so subsequent reads see changes
rebuildIndex(): Promise<OntologyIndex>
```

**Index rebuild**: After each write, `buildOntologyIndex()` is called and the reference swapped. All files are local so this is fast. Prevents stale cache bugs.

**JSON formatting**: `JSON.stringify(data, null, 2) + '\n'` — matches existing file style.

## Tool Specifications

### Section A: Entity Write Tools

Each entity kind uses one of three storage strategies.

#### Strategy 1: Individual Files

**Substance** (`data-src/substances/{id}.json`)

`add_substance`:
- Input: `id` (string), `formula` (string), `class` (string), `subclass?`, `ions?` (string[]), `tags?` (string[]), `phase_standard?` ("g"|"l"|"s"|"aq"), `characteristics?` (object)
- Behavior: Creates `substances/{id}.json`. Fails if file already exists.
- Validation: `id` must be lowercase alphanumeric + underscores; `class` must match a known `cls:*` concept; `ions` refs must exist in index.
- Returns: `{ ref: "sub:{id}", path: "substances/{id}.json", status: "created" }`

`update_substance`:
- Input: `id` (string), plus any fields from add_substance (all optional)
- Behavior: Reads existing file, shallow-merges provided fields, writes back. Fails if file doesn't exist.
- Returns: `{ ref: "sub:{id}", updated_fields: [...], status: "updated" }`

#### Strategy 2: Array-Based Files

**Ion** (`data-src/ions.json`)

`add_ion`:
- Input: `id` (string, e.g. "Na_plus"), `formula` (string), `charge` (number), `type` ("cation"|"anion"), `elements?` (string[])
- Behavior: Reads ions array, checks no duplicate `id`, appends entry, writes back.
- Validation: `id` must be unique; `charge` must match `type` (positive→cation, negative→anion).
- Returns: `{ ref: "ion:{id}", index: <position>, status: "created" }`

`update_ion`:
- Input: `id` (string), plus any fields from add_ion (all optional)
- Behavior: Finds entry by `id` in array, merges fields, writes back. Fails if not found.
- Returns: `{ ref: "ion:{id}", updated_fields: [...], status: "updated" }`

**Reaction** (`data-src/reactions/reactions.json`)

`add_reaction`:
- Input: `id` (string), `equation` (string), `type` ("exchange"|"redox"|"decomposition"|"synthesis"|"combustion"), `reactants` (string[]), `products` (string[]), `conditions?`, `tags?`
- Behavior: Reads array, checks no duplicate `id`, appends, writes back.
- Validation: `reactants` and `products` refs should exist in index (warning if not, not hard fail — substance may be added later).
- Returns: `{ ref: "rxn:{id}", status: "created" }`

`update_reaction`:
- Input: `id`, plus any fields (all optional)
- Behavior: Find by `id`, merge, write back.

**Formula** (`data-src/foundations/formulas.json`)

`add_formula`:
- Input: `id` (string), `expression` (string), `concept_refs?` (string[]), `variables?` (object[])
- Behavior: Array append, duplicate check by `id`.
- Returns: `{ ref: "formula:{id}", status: "created" }`

`update_formula`:
- Input: `id`, plus any fields (all optional)

#### Strategy 3: Object-Based Files

**Concept** (`data-src/concepts.json`)

`add_concept`:
- Input: `ref` (string, e.g. "cls:oxide_basic" or "concept:electronegativity"), `kind` ("substance_class"|"element_group"|"reaction_type"|"reaction_facet"|"domain_concept"|"process"|"property"), `parent_id?` (string), `order?` (number), `filters?` (object), `examples?` (object[]), `children_order?` (string[])
- Behavior: Reads concepts object, checks key doesn't exist, adds entry, writes back.
- Validation: `ref` must have valid prefix; `parent_id` if provided must exist in concepts.
- Returns: `{ ref, status: "created" }`

`update_concept`:
- Input: `ref`, plus any fields (all optional)
- Behavior: Find by key, merge, write back. Fails if not found.

**Process** (`data-src/process_vocab.json`)

`add_process`:
- Input: `id` (string), `kind` ("chemical"|"driving_force"|"physical"|"operation"|"constraint")
- Behavior: Reads object, checks key doesn't exist, adds entry.
- Returns: `{ ref: "process:{id}", status: "created" }`

`update_process`:
- Input: `id`, `kind?`

**Effect** (`data-src/effects_vocab.json`)

`add_effect`:
- Input: `id` (string), `category` ("kinetic"|"thermodynamic"|"mass_transfer"|"phase")
- Behavior: Object insert, duplicate check.
- Returns: `{ ref: "effect:{id}", status: "created" }`

`update_effect`:
- Input: `id`, `category?`

**Rule Term** (`data-src/vocab/rule_terms.json`)

`add_rule_term`:
- Input: `id` (string), `namespace` (string), `concept_ref?` (string)
- Behavior: Object insert, duplicate check.
- Returns: `{ id, status: "created" }`

`update_rule_term`:
- Input: `id`, plus any fields (all optional)

**Property** (`data-src/rules/properties.json`)

`add_property`:
- Input: `id` (string), `concept_ref` (string), `default_unit` (string), `value_type` ("number"|"string"|"boolean"), `conditions?` (object)
- Behavior: Object/array insert (depending on file format), duplicate check.
- Returns: `{ ref: "prop:{id}", status: "created" }`

`update_property`:
- Input: `id`, plus any fields (all optional)

#### Embedded Kind

**Characteristic** (inside `data-src/substances/{substance_id}.json`)

`add_characteristic`:
- Input: `substance_id` (string), `concept_ref` (string), `value` (number|string), `unit` (string), `conditions?` (object), `source?` (string), `explanation?` (string)
- Behavior: Reads substance file, adds to `characteristics[concept_ref]`. Fails if that characteristic already exists on the substance.
- Validation: substance file must exist; `concept_ref` should be a known property/concept.
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
- `entity_id`: the key within the overlay file (e.g. `"hcl"` for substances, `"ion:H_plus"` for ions, `"cls:oxide"` for concepts)
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
- `predicate` should match known predicates from `relation_schema.json` (warning if new predicate).

Returns: `{ file, added: <count>, skipped_duplicates: <count>, status: "updated" }`

#### `list_entities`

Input:
- `kind`: one of the 12 OntRefKind values, or `"all"`
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
    { type: "concept_no_examples", ref: "cls:amphoteric_oxide" }
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
  → call rebuildIndex()
  → return result
```

The `rebuildIndex()` call after each write ensures the in-memory `OntologyIndex` stays consistent. All existing read tools (search, get_entity, get_neighbors, etc.) immediately see the new data.

## Error Handling

All tools return structured errors:

```
{ error: true, code: "ENTITY_EXISTS" | "NOT_FOUND" | "INVALID_REF" | "VALIDATION_FAILED", message: string }
```

Warnings (non-fatal) are returned alongside success:

```
{ status: "created", warnings: ["ion:XY_plus not found in index — may not exist yet"] }
```

## Testing Strategy

Per-module unit tests in `packages/ontology-mcp/src/__tests__/write/`:
- Each test creates a temp copy of relevant `data-src/` files
- Tests add/update operations and verify file output
- Tests verify index rebuild picks up changes
- Tests verify validation rejects bad input

## Future Work (Phase 2)

- `find_similar` — semantic similarity across entity pairs (structural + label + graph signals)
- `suggest_relations` — propose missing relations based on shared characteristics, common ions, class patterns
- Batch operations — `add_substances` (plural) for bulk enrichment
