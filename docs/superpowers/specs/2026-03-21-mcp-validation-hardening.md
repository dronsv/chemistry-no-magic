# MCP Validation Hardening — Post-Enrichment Findings

**Date**: 2026-03-21
**Status**: Proposal
**Trigger**: Two build failures after ontology enrichment via MCP write tools + agents

## Incidents

### Incident 1: `surface_forms is not iterable`
**Root cause**: The enrichment agent called `add_translation` with `surface_forms` as an object `{nom: "...", gen: "..."}` instead of an array `["form1", "form2"]`. The agent confused `surface_forms` (array of search strings) with `forms` (morphological declension object).

**Why it passed**: `add_translation` accepts `fields: Record<string, unknown>` — zero validation on field values. Any shape is accepted.

### Incident 2: `entry.examples is not iterable`
**Root cause**: `add_concept` created 16 concepts without an `examples` field. The build pipeline's `getConceptDetailPaths()` iterates `entry.examples` with a bare `for...of` (no null guard), causing a crash.

**Why it passed**: `add_concept` only writes fields explicitly provided. `examples` is typed as optional (`examples?: ConceptExample[]`) but is de-facto required — 100% of existing concepts (123/123) have it.

## Proposed Fixes

### Fix 1: `add_concept` — defaults for required-in-practice fields

In `packages/ontology-mcp/src/server/tools/write/concept.ts`, after building the entry object:

```typescript
// Default required-in-practice fields
if (!entry.examples) entry.examples = [];
if (!entry.filters) entry.filters = {};
```

**Rationale**: Every existing concept has `examples` and `filters`. The build pipeline and SSG assume them. Making the tool add sensible defaults prevents silent breakage.

### Fix 2: `add_translation` — validate known field shapes

In `packages/ontology-mcp/src/server/tools/write/translation.ts`, add validation before merge:

```typescript
const warnings: string[] = [];

// Validate known field shapes
if (args.fields.surface_forms !== undefined) {
  if (!Array.isArray(args.fields.surface_forms)) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: `surface_forms must be an array of strings, got ${typeof args.fields.surface_forms}`,
    };
  }
  for (const form of args.fields.surface_forms) {
    if (typeof form !== 'string') {
      return {
        error: true,
        code: 'VALIDATION_FAILED',
        message: `surface_forms entries must be strings, got ${typeof form}`,
      };
    }
  }
}

if (args.fields.forms !== undefined && typeof args.fields.forms !== 'object') {
  return {
    error: true,
    code: 'VALIDATION_FAILED',
    message: `forms must be an object (morphological declensions), got ${typeof args.fields.forms}`,
  };
}
```

**Rationale**: `surface_forms` and `forms` are the two fields most likely to be confused. Strict shape checks catch the error at write time, not at build time.

### Fix 3: `add_concept` — validate `kind` enum

Currently any string is accepted for `kind`. Add validation:

```typescript
const VALID_KINDS = [
  'substance_class', 'element_group', 'reaction_type', 'reaction_facet',
  'domain_concept', 'process', 'property',
] as const;

if (!VALID_KINDS.includes(args.kind as any)) {
  warnings.push(`Unknown kind "${args.kind}". Expected: ${VALID_KINDS.join(', ')}`);
}
```

**Rationale**: Warning (not error) because new kinds may be legitimate, but catches typos.

### Fix 4: Agent prompt — distinguish `surface_forms` vs `forms`

Add to `ontology-localizer.md` and `ontology-enrichment.md`:

```markdown
### CRITICAL: surface_forms vs forms
- `surface_forms`: ARRAY of strings — flat list of searchable text forms for the alias index
  Example: `["ионная связь", "ионной связи", "ионных связей"]`
- `forms`: OBJECT with grammatical cases — morphological declension forms
  Example: `{"nom": "ионная связь", "gen": "ионной связи", "dat": "ионной связи"}`

These are DIFFERENT fields. Never write an object to `surface_forms` or an array to `forms`.
```

### Fix 5: Agent prompt — required concept fields

Add to `ontology-enrichment.md`:

```markdown
### Required-in-practice concept fields
When using `add_concept`, always provide:
- `examples: []` (even if empty — build pipeline iterates this field)
- `filters: {}` (even if empty — used by concept detail pages)
```

### Fix 6: `add_substance` — validate `id` format

Currently no check that `id` is lowercase alphanumeric + underscores. Add:

```typescript
if (!/^[a-z][a-z0-9_]*$/.test(args.id)) {
  return {
    error: true,
    code: 'VALIDATION_FAILED',
    message: `Substance id "${args.id}" must be lowercase alphanumeric with underscores`,
  };
}
```

### Fix 7: Post-write build validation hook (future)

Consider adding a lightweight post-write check that runs a subset of `npm run validate:data` checks inline after each write. This would catch schema violations before the next full build. Not urgent for Phase 1 but valuable long-term.

## Summary

| # | Where | What | Severity | Effort |
|---|-------|------|----------|--------|
| 1 | `concept.ts` | Default `examples: []`, `filters: {}` | Critical | 2 lines |
| 2 | `translation.ts` | Validate `surface_forms` is array, `forms` is object | Critical | 15 lines |
| 3 | `concept.ts` | Warn on unknown `kind` | Low | 5 lines |
| 4 | Agent prompts | Distinguish `surface_forms` vs `forms` | Medium | Prompt text |
| 5 | Agent prompts | Required concept fields | Medium | Prompt text |
| 6 | `substance.ts` | Validate `id` format | Low | 5 lines |
| 7 | Future | Post-write validation hook | Low | Separate spec |

## Recommended execution order

1. Fixes 1+2 (critical, prevents repeat build failures)
2. Fixes 4+5 (agent prompts, prevents agent mistakes)
3. Fixes 3+6 (nice-to-have validation)
4. Fix 7 (future phase)
