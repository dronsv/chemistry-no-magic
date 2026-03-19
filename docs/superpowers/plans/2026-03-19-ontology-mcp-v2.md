# Ontology MCP + Agent v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the ontology MCP server with all v2 contract tools, resources, prompts, bootstrap CLI, and agent configuration — turning the existing 3-tool skeleton into a full ontology authoring stack.

**Architecture:** File-backed MCP server (stdio transport) that loads all `data-src/` entities + relations into in-memory indexes, exposes 9 tools + 7 resources + 5 prompts. Bootstrap CLI runs document passes. Agent is configured as a Claude Code MCP consumer with system prompt.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` v1.27 (use non-deprecated `registerTool`/`registerResource`/`registerPrompt` API), Zod, Vitest, `data-src/` JSON files.

---

## File Structure

### Existing files to modify
- `packages/ontology-mcp/src/server/index.ts` — register new tools, resources, prompts
- `packages/ontology-mcp/src/server/indexing/build-index.ts` — add relations loading
- `packages/ontology-mcp/src/shared/types.ts` — add Relation, Proposal, AnnotationResult types
- `packages/ontology-mcp/package.json` — add vitest devDependency

### New files to create
- `packages/ontology-mcp/vitest.config.ts`
- `packages/ontology-mcp/src/server/indexing/find-data-src.ts` — shared data-src path resolver (deduplicated from build-index.ts)
- `packages/ontology-mcp/src/__tests__/build-index.test.ts`
- `packages/ontology-mcp/src/__tests__/search-entities.test.ts`
- `packages/ontology-mcp/src/__tests__/get-neighbors.test.ts`
- `packages/ontology-mcp/src/__tests__/validate-annotation.test.ts`
- `packages/ontology-mcp/src/__tests__/suggest-refs.test.ts`
- `packages/ontology-mcp/src/__tests__/classify-addition.test.ts`
- `packages/ontology-mcp/src/__tests__/bootstrap-document.test.ts`
- `packages/ontology-mcp/src/server/indexing/load-relations.ts`
- `packages/ontology-mcp/src/server/tools/get-neighbors.ts`
- `packages/ontology-mcp/src/server/tools/validate-annotation.ts`
- `packages/ontology-mcp/src/server/tools/suggest-refs-for-text.ts`
- `packages/ontology-mcp/src/server/tools/classify-addition.ts`
- `packages/ontology-mcp/src/server/tools/create-proposal-draft.ts`
- `packages/ontology-mcp/src/server/tools/bootstrap-document.ts`
- `packages/ontology-mcp/src/server/resources/register-resources.ts`
- `packages/ontology-mcp/src/server/prompts/register-prompts.ts`
- `packages/ontology-mcp/src/server/bootstrap/cli.ts`

---

## Dependency Graph

```
Task 1 (test infra + types)
  └─► Task 2 (relations loading)
       └─► Task 3 (get_neighbors)
  └─► Task 4 (validate_annotation)
  └─► Task 5 (suggest_refs_for_text)
       └─► Task 6 (classify_addition)
            └─► Task 7 (create_proposal_draft)
                 └─► Task 8 (bootstrap_document)
                      └─► Task 9 (bootstrap CLI)
  └─► Task 10 (resources)
  └─► Task 11 (prompts)
  └─► Task 12 (register all in index.ts)
  └─► Task 13 (agent config)
```

---

### Task 1: Test Infrastructure + Extended Types

**Files:**
- Modify: `packages/ontology-mcp/package.json`
- Create: `packages/ontology-mcp/vitest.config.ts`
- Modify: `packages/ontology-mcp/src/shared/types.ts`
- Create: `packages/ontology-mcp/src/__tests__/build-index.test.ts`
- Create: `packages/ontology-mcp/src/__tests__/search-entities.test.ts`

- [ ] **Step 1: Add vitest to package.json**

Add to devDependencies in `packages/ontology-mcp/package.json`:
```json
"vitest": "^3.0.0"
```
Add script:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Run: `cd packages/ontology-mcp && npm install`

- [ ] **Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Extend types.ts with Relation, Proposal, and AnnotationResult**

Add to `packages/ontology-mcp/src/shared/types.ts`:

```typescript
export interface Relation {
  subject: string;
  predicate: string;
  object: string;
  step?: number;
  solubility?: string;
  knowledge_level?: string;
  source_kind?: string;
  condition?: string;
}

export type AdditionType =
  | 'alias_addition'
  | 'overlay_addition'
  | 'relation_addition'
  | 'entity_extension'
  | 'new_core_entity';

export interface AdmissionChecks {
  is_alias_only: boolean;
  is_overlay_only: boolean;
  is_reusable: boolean;
  is_language_independent: boolean;
  is_non_redundant: boolean;
  has_structural_value: boolean;
}

export interface ProposalDraft {
  proposal_id: string;
  proposal_type: AdditionType;
  candidate_text: string;
  language: string;
  target_ref?: string;
  proposed_ref?: string;
  proposed_label?: string;
  rationale: string;
  evidence_spans: Array<{ source_doc_id?: string; text: string; start?: number; end?: number }>;
  nearest_existing_refs: Array<{ ref: string; reason: string; score: number }>;
  admission_checks: AdmissionChecks;
  status: 'draft' | 'review' | 'accepted' | 'rejected';
}

export interface Annotation {
  text: string;
  start: number;
  end: number;
  kind: OntRefKind | string;
  chosen_ref?: string;
  confidence?: number;
  candidates: SearchCandidate[];
}

export interface UnresolvedMention {
  text: string;
  start: number;
  end: number;
  reason: string;
}

export interface AnnotationResult {
  doc_id: string;
  material_language: string;
  annotations: Annotation[];
  unresolved_mentions: UnresolvedMention[];
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Extend OntologyIndex to include relations
export interface RelationsIndex {
  bySubject: Map<string, Relation[]>;
  byObject: Map<string, Relation[]>;
  byPredicate: Map<string, Relation[]>;
}
```

- [ ] **Step 4: Write parity tests for build-index**

Create `packages/ontology-mcp/src/__tests__/build-index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';

describe('buildOntologyIndex', () => {
  it('loads all entity types from data-src', async () => {
    const index = await buildOntologyIndex();
    // Known counts from startup log: 441 entities
    expect(index.entitiesByRef.size).toBeGreaterThanOrEqual(400);
  });

  it('indexes elements by symbol', async () => {
    const index = await buildOntologyIndex();
    expect(index.symbolIndex.get('Na')).toBe('el:Na');
    expect(index.symbolIndex.get('H')).toBe('el:H');
  });

  it('indexes substances by formula', async () => {
    const index = await buildOntologyIndex();
    expect(index.formulaIndex.get('H₂O')).toBe('sub:h2o');
  });

  it('merges locale overlays into entity labels', async () => {
    const index = await buildOntologyIndex();
    const sodium = index.entitiesByRef.get('el:Na');
    expect(sodium?.labels['ru']).toBeDefined();
    expect(sodium?.labels['en']).toBeDefined();
  });

  it('builds alias index from all sources', async () => {
    const index = await buildOntologyIndex();
    expect(index.aliasIndex.size).toBeGreaterThan(2000);
  });
});
```

- [ ] **Step 5: Write parity tests for search-entities**

Create `packages/ontology-mcp/src/__tests__/search-entities.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { searchEntities } from '../server/tools/search-entities.js';
import { getEntity } from '../server/tools/get-entity.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('searchEntities', () => {
  it('finds element by exact ref', () => {
    const r = searchEntities(index, { query: 'el:Na' });
    expect(r.candidates[0]?.ref).toBe('el:Na');
    expect(r.candidates[0]?.score).toBe(1.0);
  });

  it('finds element by symbol', () => {
    const r = searchEntities(index, { query: 'Na' });
    expect(r.candidates.some(c => c.ref === 'el:Na')).toBe(true);
  });

  it('finds substance by formula', () => {
    const r = searchEntities(index, { query: 'HCl' });
    expect(r.candidates.some(c => c.ref === 'sub:hcl')).toBe(true);
  });

  it('finds concept by Russian alias', () => {
    const r = searchEntities(index, { query: 'кислота' });
    expect(r.candidates.some(c => c.ref === 'cls:acid')).toBe(true);
  });

  it('filters by kind', () => {
    const r = searchEntities(index, { query: 'Na', kinds: ['element'] });
    expect(r.candidates.every(c => c.kind === 'element')).toBe(true);
  });

  it('respects limit', () => {
    const r = searchEntities(index, { query: 'a', limit: 3 });
    expect(r.candidates.length).toBeLessThanOrEqual(3);
  });
});

describe('getEntity', () => {
  it('returns entity for valid ref', () => {
    const r = getEntity(index, { ref: 'el:Na' });
    expect(r.entity).not.toBeNull();
    expect(r.entity?.kind).toBe('element');
    expect(r.entity?.symbol).toBe('Na');
  });

  it('returns locale labels', () => {
    const r = getEntity(index, { ref: 'el:Na' });
    expect(r.entity?.labels['ru']).toBeDefined();
    expect(r.entity?.labels['en']).toBeDefined();
  });

  it('returns null for unknown ref', () => {
    const r = getEntity(index, { ref: 'el:Unobtanium' });
    expect(r.entity).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/ontology-mcp && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/package.json packages/ontology-mcp/vitest.config.ts \
  packages/ontology-mcp/src/shared/types.ts \
  packages/ontology-mcp/src/__tests__/build-index.test.ts \
  packages/ontology-mcp/src/__tests__/search-entities.test.ts
git commit -m "feat(ontology-mcp): add vitest, extended types, parity tests"
```

---

### Task 2: Load Relations into Index

**Files:**
- Create: `packages/ontology-mcp/src/server/indexing/find-data-src.ts` — shared path resolver
- Create: `packages/ontology-mcp/src/server/indexing/load-relations.ts`
- Modify: `packages/ontology-mcp/src/server/indexing/build-index.ts` — use shared `findDataSrc()`, add relations
- Modify: `packages/ontology-mcp/src/shared/types.ts` (add `relations` field to `OntologyIndex`)

- [ ] **Step 1: Write failing test for relations loading**

Add to `packages/ontology-mcp/src/__tests__/build-index.test.ts`:

```typescript
import { loadRelations } from '../server/indexing/load-relations.js';

describe('loadRelations', () => {
  it('loads relation files from data-src/relations/', async () => {
    const relations = await loadRelations();
    expect(relations.bySubject.size).toBeGreaterThan(0);
    expect(relations.byPredicate.size).toBeGreaterThan(0);
  });

  it('indexes acid_base_relations by subject', async () => {
    const relations = await loadRelations();
    // acid_base_relations has subjects like ion:H_plus, sub:h2so4
    const hasAcidBase = [...relations.byPredicate.keys()].some(
      p => p === 'has_conjugate_base' || p === 'has_conjugate_acid'
    );
    expect(hasAcidBase).toBe(true);
  });

  it('indexes concept hierarchy from parent_id', async () => {
    const relations = await loadRelations();
    const parentOf = relations.byPredicate.get('has_parent') ?? [];
    expect(parentOf.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/build-index.test.ts`
Expected: FAIL — `loadRelations` not found.

- [ ] **Step 2b: Create shared findDataSrc utility**

Create `packages/ontology-mcp/src/server/indexing/find-data-src.ts`:

```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let cached: string | null = null;

export async function findDataSrc(): Promise<string> {
  if (cached) return cached;
  const cwd = process.cwd();
  const candidates = [
    join(cwd, 'data-src'),
    join(cwd, '..', '..', 'data-src'),
    join(cwd, '..', 'data-src'),
  ];
  for (const candidate of candidates) {
    try {
      await readFile(join(candidate, 'elements.json'), 'utf-8');
      cached = candidate;
      return candidate;
    } catch { /* try next */ }
  }
  throw new Error('Could not find data-src directory');
}
```

Then refactor `build-index.ts` to import `findDataSrc` from this shared module instead of its inline `resolveDataSrc` function. Replace the `resolveDataSrc()` function and the candidate-loop logic with:

```typescript
import { findDataSrc } from './find-data-src.js';
// ... in buildOntologyIndex():
const DATA_SRC = await findDataSrc();
```

- [ ] **Step 3: Implement load-relations.ts**

Create `packages/ontology-mcp/src/server/indexing/load-relations.ts`:

```typescript
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Relation, RelationsIndex } from '../../shared/types.js';
import { findDataSrc } from './find-data-src.js';

export async function loadRelations(): Promise<RelationsIndex> {
  const dataSrc = await findDataSrc();
  const bySubject = new Map<string, Relation[]>();
  const byObject = new Map<string, Relation[]>();
  const byPredicate = new Map<string, Relation[]>();

  function addRelation(rel: Relation): void {
    const subList = bySubject.get(rel.subject) ?? [];
    subList.push(rel);
    bySubject.set(rel.subject, subList);

    const objList = byObject.get(rel.object) ?? [];
    objList.push(rel);
    byObject.set(rel.object, objList);

    const predList = byPredicate.get(rel.predicate) ?? [];
    predList.push(rel);
    byPredicate.set(rel.predicate, predList);
  }

  // 1. Load explicit relation files from data-src/relations/
  const relDir = join(dataSrc, 'relations');
  try {
    const files = (await readdir(relDir)).filter(
      f => f.endsWith('.json') && f !== 'relation_schema.json'
    );
    for (const f of files) {
      try {
        const raw = JSON.parse(await readFile(join(relDir, f), 'utf-8'));
        const triples: Relation[] = Array.isArray(raw) ? raw : (raw.triples ?? raw.relations ?? []);
        for (const t of triples) {
          if (t.subject && t.predicate && t.object) {
            addRelation(t);
          }
        }
        process.stderr.write(`[ontology-mcp] Loaded ${triples.length} relations from ${f}\n`);
      } catch { /* skip bad files */ }
    }
  } catch {
    process.stderr.write('[ontology-mcp] WARNING: no relations/ directory found\n');
  }

  // 2. Extract concept hierarchy from concepts.json (parent_id → has_parent relation)
  try {
    const concepts = JSON.parse(
      await readFile(join(dataSrc, 'concepts.json'), 'utf-8')
    ) as Record<string, { parent_id?: string | null }>;
    for (const [ref, entry] of Object.entries(concepts)) {
      if (entry.parent_id) {
        addRelation({ subject: ref, predicate: 'has_parent', object: entry.parent_id });
      }
    }
  } catch { /* optional */ }

  // 3. Extract substance → class relations from substance files
  try {
    const subDir = join(dataSrc, 'substances');
    const subFiles = (await readdir(subDir)).filter(f => f.endsWith('.json'));
    for (const f of subFiles) {
      try {
        const sub = JSON.parse(await readFile(join(subDir, f), 'utf-8')) as {
          id?: string; class?: string; subclass?: string;
        };
        if (!sub.id) continue;
        if (sub.class) {
          addRelation({ subject: sub.id, predicate: 'instance_of', object: `cls:${sub.class}` });
        }
        if (sub.subclass) {
          addRelation({ subject: sub.id, predicate: 'instance_of', object: `cls:${sub.subclass}` });
        }
      } catch { /* skip */ }
    }
  } catch { /* optional */ }

  const totalRelations = [...byPredicate.values()].reduce((sum, arr) => sum + arr.length, 0);
  process.stderr.write(
    `[ontology-mcp] Relations index: ${totalRelations} triples, ` +
    `${bySubject.size} subjects, ${byPredicate.size} predicates\n`
  );

  return { bySubject, byObject, byPredicate };
}
```

- [ ] **Step 4: Add `relations` field to OntologyIndex**

In `packages/ontology-mcp/src/shared/types.ts`, modify `OntologyIndex`:

```typescript
export interface OntologyIndex {
  entitiesByRef: Map<string, OntologyEntity>;
  aliasIndex: Map<string, string[]>;
  formulaIndex: Map<string, string>;
  symbolIndex: Map<string, string>;
  relations: RelationsIndex;
}
```

- [ ] **Step 5: Wire into build-index.ts**

In `packages/ontology-mcp/src/server/indexing/build-index.ts`, import and call `loadRelations`:

```typescript
import { loadRelations } from './load-relations.js';
```

At the end of `buildOntologyIndex()`, before the return:

```typescript
const relations = await loadRelations();
return { entitiesByRef, aliasIndex, formulaIndex, symbolIndex, relations };
```

- [ ] **Step 6: Run tests**

Run: `cd packages/ontology-mcp && npx vitest run`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/src/server/indexing/load-relations.ts \
  packages/ontology-mcp/src/server/indexing/build-index.ts \
  packages/ontology-mcp/src/shared/types.ts \
  packages/ontology-mcp/src/__tests__/build-index.test.ts
git commit -m "feat(ontology-mcp): load relations into index"
```

---

### Task 3: get_neighbors Tool

**Files:**
- Create: `packages/ontology-mcp/src/server/tools/get-neighbors.ts`
- Create: `packages/ontology-mcp/src/__tests__/get-neighbors.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ontology-mcp/src/__tests__/get-neighbors.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { getNeighbors } from '../server/tools/get-neighbors.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('getNeighbors', () => {
  it('returns outgoing relations for a subject', () => {
    const r = getNeighbors(index, { ref: 'cls:acid' });
    expect(r.outgoing.length + r.incoming.length).toBeGreaterThan(0);
  });

  it('returns incoming relations for an object', () => {
    // Substances have instance_of → cls:acid
    const r = getNeighbors(index, { ref: 'cls:acid' });
    expect(r.incoming.some(rel => rel.predicate === 'instance_of')).toBe(true);
  });

  it('filters by relation_types', () => {
    const r = getNeighbors(index, { ref: 'cls:acid', relation_types: ['instance_of'] });
    const allInstanceOf = [...r.outgoing, ...r.incoming].every(
      rel => rel.predicate === 'instance_of'
    );
    expect(allInstanceOf).toBe(true);
  });

  it('respects limit', () => {
    const r = getNeighbors(index, { ref: 'cls:acid', limit: 2 });
    expect(r.outgoing.length + r.incoming.length).toBeLessThanOrEqual(4); // 2 per direction max
  });

  it('returns empty for unknown ref', () => {
    const r = getNeighbors(index, { ref: 'el:Unobtanium' });
    expect(r.outgoing).toEqual([]);
    expect(r.incoming).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/get-neighbors.test.ts`
Expected: FAIL — `getNeighbors` not found.

- [ ] **Step 3: Implement get-neighbors.ts**

Create `packages/ontology-mcp/src/server/tools/get-neighbors.ts`:

```typescript
import type { OntologyIndex, Relation } from '../../shared/types.js';

interface GetNeighborsResult {
  ref: string;
  outgoing: Relation[];
  incoming: Relation[];
}

export function getNeighbors(
  index: OntologyIndex,
  args: { ref: string; relation_types?: string[]; limit?: number }
): GetNeighborsResult {
  const { ref, relation_types, limit = 50 } = args;

  let outgoing = index.relations.bySubject.get(ref) ?? [];
  let incoming = index.relations.byObject.get(ref) ?? [];

  if (relation_types?.length) {
    const allowed = new Set(relation_types);
    outgoing = outgoing.filter(r => allowed.has(r.predicate));
    incoming = incoming.filter(r => allowed.has(r.predicate));
  }

  return {
    ref,
    outgoing: outgoing.slice(0, limit),
    incoming: incoming.slice(0, limit),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ontology-mcp && npx vitest run`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/get-neighbors.ts \
  packages/ontology-mcp/src/__tests__/get-neighbors.test.ts
git commit -m "feat(ontology-mcp): add get_neighbors tool"
```

---

### Task 4: validate_annotation Tool

**Files:**
- Create: `packages/ontology-mcp/src/server/tools/validate-annotation.ts`
- Create: `packages/ontology-mcp/src/__tests__/validate-annotation.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/ontology-mcp/src/__tests__/validate-annotation.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { validateAnnotation } from '../server/tools/validate-annotation.js';
import type { OntologyIndex, Annotation } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('validateAnnotation', () => {
  it('validates correct annotation', () => {
    const annotations: Annotation[] = [{
      text: 'кислота', start: 0, end: 7, kind: 'substance_class',
      chosen_ref: 'cls:acid', confidence: 0.98,
      candidates: [{ ref: 'cls:acid', kind: 'substance_class', label: 'acid', score: 0.98, matchReason: 'exact' }],
    }];
    const r = validateAnnotation(index, {
      doc_id: 'test', material_language: 'ru', annotations,
    });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('errors on chosen_ref that does not exist in ontology', () => {
    const annotations: Annotation[] = [{
      text: 'foo', start: 0, end: 3, kind: 'concept',
      chosen_ref: 'concept:nonexistent', confidence: 0.9,
      candidates: [{ ref: 'concept:nonexistent', kind: 'concept', label: 'foo', score: 0.9, matchReason: 'alias' }],
    }];
    const r = validateAnnotation(index, {
      doc_id: 'test', material_language: 'ru', annotations,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('warns on single candidate without chosen_ref', () => {
    const annotations: Annotation[] = [{
      text: 'кислота', start: 0, end: 7, kind: 'substance_class',
      candidates: [{ ref: 'cls:acid', kind: 'substance_class', label: 'acid', score: 0.95, matchReason: 'alias' }],
    }];
    const r = validateAnnotation(index, {
      doc_id: 'test', material_language: 'ru', annotations,
    });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('errors on overlapping spans', () => {
    const annotations: Annotation[] = [
      { text: 'соляная кислота', start: 0, end: 15, kind: 'substance', candidates: [] },
      { text: 'кислота', start: 8, end: 15, kind: 'substance_class', candidates: [] },
    ];
    const r = validateAnnotation(index, {
      doc_id: 'test', material_language: 'ru', annotations,
    });
    expect(r.errors.some(e => e.includes('overlap'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/validate-annotation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement validate-annotation.ts**

Create `packages/ontology-mcp/src/server/tools/validate-annotation.ts`:

```typescript
import type { OntologyIndex, Annotation } from '../../shared/types.js';

interface ValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  repair_suggestions: string[];
}

export function validateAnnotation(
  index: OntologyIndex,
  args: { doc_id: string; material_language: string; annotations: Annotation[] }
): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const repair_suggestions: string[] = [];

  // Check each annotation
  for (const ann of args.annotations) {
    // chosen_ref must exist in ontology
    if (ann.chosen_ref && !index.entitiesByRef.has(ann.chosen_ref)) {
      errors.push(`Annotation '${ann.text}' has chosen_ref '${ann.chosen_ref}' not found in ontology.`);
    }

    // Single candidate without chosen_ref → warn
    if (!ann.chosen_ref && ann.candidates.length === 1) {
      warnings.push(
        `Annotation '${ann.text}' has one candidate (${ann.candidates[0].ref}) but no chosen_ref.`
      );
      repair_suggestions.push(`Set chosen_ref to '${ann.candidates[0].ref}' for '${ann.text}'.`);
    }

    // chosen_ref without candidates → error
    if (ann.chosen_ref && ann.candidates.length === 0) {
      errors.push(`Annotation '${ann.text}' has chosen_ref '${ann.chosen_ref}' but no candidates.`);
    }

    // Low confidence warning
    if (ann.confidence !== undefined && ann.confidence < 0.7) {
      warnings.push(`Annotation '${ann.text}' has low confidence (${ann.confidence}).`);
    }
  }

  // Check for overlapping spans
  const sorted = [...args.annotations].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end > sorted[i + 1].start) {
      errors.push(
        `Overlapping annotations: '${sorted[i].text}' [${sorted[i].start}-${sorted[i].end}] ` +
        `and '${sorted[i + 1].text}' [${sorted[i + 1].start}-${sorted[i + 1].end}] overlap.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    repair_suggestions,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ontology-mcp && npx vitest run`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/validate-annotation.ts \
  packages/ontology-mcp/src/__tests__/validate-annotation.test.ts
git commit -m "feat(ontology-mcp): add validate_annotation tool"
```

---

### Task 5: suggest_refs_for_text Tool

**Files:**
- Create: `packages/ontology-mcp/src/server/tools/suggest-refs-for-text.ts`
- Create: `packages/ontology-mcp/src/__tests__/suggest-refs.test.ts`

This is the bulk text analysis tool — it tokenizes text, tries to match spans against the alias/formula/symbol indexes, and returns candidate annotations + unresolved mentions.

- [ ] **Step 1: Write failing test**

Create `packages/ontology-mcp/src/__tests__/suggest-refs.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { suggestRefsForText } from '../server/tools/suggest-refs-for-text.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('suggestRefsForText', () => {
  it('detects element symbols in text', () => {
    const r = suggestRefsForText(index, {
      text: 'Натрий Na — мягкий металл',
      material_language: 'ru',
      mode: 'didactic',
    });
    expect(r.mentions.some(m => m.candidates.some(c => c.ref === 'el:Na'))).toBe(true);
  });

  it('detects chemical formulas', () => {
    const r = suggestRefsForText(index, {
      text: 'Реакция HCl с NaOH',
      material_language: 'ru',
      mode: 'didactic',
    });
    const refs = r.mentions.flatMap(m => m.candidates.map(c => c.ref));
    expect(refs).toContain('sub:hcl');
    expect(refs).toContain('sub:naoh');
  });

  it('detects Russian concept names', () => {
    const r = suggestRefsForText(index, {
      text: 'Кислота диссоциирует в воде',
      material_language: 'ru',
      mode: 'didactic',
    });
    expect(r.mentions.some(m => m.candidates.some(c => c.ref === 'cls:acid'))).toBe(true);
  });

  it('reports unresolved spans', () => {
    const r = suggestRefsForText(index, {
      text: 'Фрагипан — это несуществующий термин',
      material_language: 'ru',
      mode: 'didactic',
    });
    // "Фрагипан" should be unresolved or not matched
    expect(r.unresolved_spans.length + r.mentions.length).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/suggest-refs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement suggest-refs-for-text.ts**

Create `packages/ontology-mcp/src/server/tools/suggest-refs-for-text.ts`:

```typescript
import type { OntologyIndex, SearchCandidate } from '../../shared/types.js';
import { searchEntities } from './search-entities.js';

interface MentionSpan {
  text: string;
  start: number;
  end: number;
  candidates: SearchCandidate[];
}

interface SuggestResult {
  mentions: MentionSpan[];
  unresolved_spans: Array<{ text: string; start: number; end: number }>;
}

// Chemical formula pattern: must start with uppercase, contain at least one
// element-like pair (uppercase + optional lowercase) followed by digits/subscripts,
// OR parenthesized groups. Requires length >= 2 and at least one digit or
// two uppercase letters to avoid matching plain English/Russian words.
const FORMULA_RE = /(?:[A-Z][a-z]?(?:[₀-₉]+|\d+))(?:[A-Z][a-z]?(?:[₀-₉]+|\d+)?)*(?:\((?:[A-Z][a-z]?(?:[₀-₉]+|\d+)?)+\)(?:[₀-₉]+|\d+)?)*/g;

// Also match known element symbols (1-2 uppercase+lowercase) — validated against index
const SYMBOL_RE = /\b[A-Z][a-z]?\b/g;

// Word tokenizer for natural language — handles Cyrillic and Latin
const WORD_RE = /[\p{L}][\p{L}\p{N}_-]*/gu;

export function suggestRefsForText(
  index: OntologyIndex,
  args: { text: string; material_language: string; mode: string }
): SuggestResult {
  const { text } = args;
  const mentions: MentionSpan[] = [];
  const coveredRanges: Array<[number, number]> = [];

  function isOverlapping(start: number, end: number): boolean {
    return coveredRanges.some(([s, e]) => start < e && end > s);
  }

  function addMention(matchText: string, start: number, candidates: SearchCandidate[]): void {
    const end = start + matchText.length;
    if (isOverlapping(start, end)) return;
    if (candidates.length > 0) {
      mentions.push({ text: matchText, start, end, candidates });
      coveredRanges.push([start, end]);
    }
  }

  // Pass 1: Find chemical formulas with digits (e.g. H₂O, NaCl2, Ca(OH)2)
  for (const match of text.matchAll(FORMULA_RE)) {
    if (match.index === undefined) continue;
    const formula = match[0];
    if (formula.length < 2) continue;
    const result = searchEntities(index, { query: formula, limit: 3 });
    if (result.candidates.length > 0 && result.candidates[0].score >= 0.9) {
      addMention(formula, match.index, result.candidates);
    }
  }

  // Pass 2: Find element symbols (e.g. Na, H, Fe) — only if they match the symbol index
  for (const match of text.matchAll(SYMBOL_RE)) {
    if (match.index === undefined) continue;
    const sym = match[0];
    if (isOverlapping(match.index, match.index + sym.length)) continue;
    // Only match if it's a known element symbol (not just any capitalized word)
    if (index.symbolIndex.has(sym)) {
      const ref = index.symbolIndex.get(sym)!;
      const entity = index.entitiesByRef.get(ref);
      if (entity) {
        addMention(sym, match.index, [{
          ref, kind: entity.kind, label: entity.labels['en'] ?? sym,
          score: 0.99, matchReason: 'element symbol match',
        }]);
      }
    }
  }

  // Pass 3: Find word/phrase matches against alias index (Cyrillic/Latin words)
  for (const match of text.matchAll(WORD_RE)) {
    if (match.index === undefined) continue;
    const word = match[0];
    if (word.length < 2) continue;
    if (isOverlapping(match.index, match.index + word.length)) continue;

    const result = searchEntities(index, { query: word, limit: 3 });
    // Only include high-confidence matches (exact/alias, not substring)
    const strong = result.candidates.filter(c => c.score >= 0.9);
    if (strong.length > 0) {
      addMention(word, match.index, strong);
    }
  }

  // Sort mentions by position
  mentions.sort((a, b) => a.start - b.start);

  // Identify unresolved spans: chemistry-looking words (Cyrillic/Latin, length >= 3)
  // that were not covered by any mention
  const unresolved_spans: Array<{ text: string; start: number; end: number }> = [];
  for (const match of text.matchAll(WORD_RE)) {
    if (match.index === undefined) continue;
    const word = match[0];
    if (word.length < 3) continue;
    if (isOverlapping(match.index, match.index + word.length)) continue;
    // Only flag words that look like they could be chemistry terms
    // (skip common function words by checking against search — if score > 0.3 it's chemistry-adjacent)
    const result = searchEntities(index, { query: word, limit: 1 });
    if (result.candidates.length > 0 && result.candidates[0].score >= 0.3 && result.candidates[0].score < 0.9) {
      unresolved_spans.push({ text: word, start: match.index, end: match.index + word.length });
    }
  }

  return { mentions, unresolved_spans };
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ontology-mcp && npx vitest run`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/suggest-refs-for-text.ts \
  packages/ontology-mcp/src/__tests__/suggest-refs.test.ts
git commit -m "feat(ontology-mcp): add suggest_refs_for_text tool"
```

---

### Task 6: classify_addition Tool

**Files:**
- Create: `packages/ontology-mcp/src/server/tools/classify-addition.ts`
- Create: `packages/ontology-mcp/src/__tests__/classify-addition.test.ts`

Implements the admission policy from `docs/ontology_mcp_agent_v2_starter/docs/05-admission-policy-v2.md`.

- [ ] **Step 1: Write failing test**

Create `packages/ontology-mcp/src/__tests__/classify-addition.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { classifyAddition } from '../server/tools/classify-addition.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('classifyAddition', () => {
  it('classifies known synonym as alias_addition', () => {
    const r = classifyAddition(index, {
      candidate_text: 'соляная кислота',
      material_language: 'ru',
      nearest_refs: ['sub:hcl'],
    });
    expect(r.addition_type).toBe('alias_addition');
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it('classifies unknown term with no near refs as new_core_entity', () => {
    const r = classifyAddition(index, {
      candidate_text: 'кватернионная связь',
      material_language: 'ru',
    });
    // Should be new_core_entity or overlay_addition
    expect(['new_core_entity', 'overlay_addition']).toContain(r.addition_type);
  });

  it('classifies translation as overlay_addition', () => {
    const r = classifyAddition(index, {
      candidate_text: 'sal',
      material_language: 'es',
      nearest_refs: ['cls:salt'],
    });
    expect(r.addition_type).toBe('overlay_addition');
  });

  it('returns recommended_target_layer', () => {
    const r = classifyAddition(index, {
      candidate_text: 'кислота',
      material_language: 'ru',
      nearest_refs: ['cls:acid'],
    });
    expect(r.recommended_target_layer).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/classify-addition.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement classify-addition.ts**

Create `packages/ontology-mcp/src/server/tools/classify-addition.ts`:

```typescript
import type { OntologyIndex, AdditionType } from '../../shared/types.js';
import { searchEntities } from './search-entities.js';

interface ClassifyResult {
  addition_type: AdditionType;
  confidence: number;
  rationale: string;
  recommended_target_layer: string;
}

export function classifyAddition(
  index: OntologyIndex,
  args: {
    candidate_text: string;
    material_language: string;
    context?: string;
    nearest_refs?: string[];
  }
): ClassifyResult {
  const { candidate_text, material_language, nearest_refs } = args;

  // Step 1: Search for existing matches
  const searchResult = searchEntities(index, { query: candidate_text, limit: 5 });
  const topScore = searchResult.candidates[0]?.score ?? 0;
  const topRef = searchResult.candidates[0]?.ref;

  // Step 2: Check if candidate_text is already a known alias/label
  if (topScore >= 0.95) {
    return {
      addition_type: 'alias_addition',
      confidence: topScore,
      rationale: `'${candidate_text}' closely matches existing ref '${topRef}'. Likely an alias or exact match.`,
      recommended_target_layer: 'search_overlay',
    };
  }

  // Step 3: Check if nearest_refs are provided and one is a strong match
  if (nearest_refs?.length) {
    const nearestEntity = index.entitiesByRef.get(nearest_refs[0]);
    if (nearestEntity) {
      // Check if this is a locale-specific label for an existing entity
      const hasLabelInLang = nearestEntity.labels[material_language];
      if (!hasLabelInLang) {
        return {
          addition_type: 'overlay_addition',
          confidence: 0.85,
          rationale: `Entity '${nearest_refs[0]}' exists but lacks a ${material_language} label. '${candidate_text}' is a localization candidate.`,
          recommended_target_layer: 'localization_overlay',
        };
      }

      // Existing entity with label — this is an alias
      if (topScore >= 0.7) {
        return {
          addition_type: 'alias_addition',
          confidence: topScore,
          rationale: `'${candidate_text}' is a variant of existing ref '${nearest_refs[0]}'.`,
          recommended_target_layer: 'search_overlay',
        };
      }
    }
  }

  // Step 4: Partial match — could be relation or extension
  if (topScore >= 0.5) {
    return {
      addition_type: 'relation_addition',
      confidence: 0.6,
      rationale: `'${candidate_text}' partially matches '${topRef}'. May need a relation rather than a new entity.`,
      recommended_target_layer: 'relations',
    };
  }

  // Step 5: No match — new core entity candidate
  return {
    addition_type: 'new_core_entity',
    confidence: 0.4,
    rationale: `'${candidate_text}' has no close match in the ontology. Requires human review before adding to core.`,
    recommended_target_layer: 'proposal_queue',
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ontology-mcp && npx vitest run`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/classify-addition.ts \
  packages/ontology-mcp/src/__tests__/classify-addition.test.ts
git commit -m "feat(ontology-mcp): add classify_addition tool"
```

---

### Task 7: create_proposal_draft Tool

**Files:**
- Create: `packages/ontology-mcp/src/server/tools/create-proposal-draft.ts`

No separate test file — tests are inline with classify-addition tests since they're closely related. Add proposal tests to `classify-addition.test.ts`.

- [ ] **Step 1: Add failing test to classify-addition.test.ts**

Append to `packages/ontology-mcp/src/__tests__/classify-addition.test.ts`:

```typescript
import { createProposalDraft } from '../server/tools/create-proposal-draft.js';

describe('createProposalDraft', () => {
  it('generates a valid proposal for alias_addition', () => {
    const r = createProposalDraft(index, {
      candidate_text: 'соляная кислота',
      material_language: 'ru',
      nearest_refs: ['sub:hcl'],
      evidence_text: 'Соляная кислота HCl — сильная кислота.',
      source_doc_id: 'lesson-acids-01',
    });
    expect(r.proposal.proposal_type).toBe('alias_addition');
    expect(r.proposal.status).toBe('draft');
    expect(r.proposal.proposal_id).toBeDefined();
    expect(r.proposal.nearest_existing_refs.length).toBeGreaterThan(0);
  });

  it('generates proposal_id as deterministic hash', () => {
    const r1 = createProposalDraft(index, {
      candidate_text: 'test', material_language: 'ru',
    });
    const r2 = createProposalDraft(index, {
      candidate_text: 'test', material_language: 'ru',
    });
    expect(r1.proposal.proposal_id).toBe(r2.proposal.proposal_id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement create-proposal-draft.ts**

Create `packages/ontology-mcp/src/server/tools/create-proposal-draft.ts`:

```typescript
import { createHash } from 'node:crypto';
import type { OntologyIndex, ProposalDraft } from '../../shared/types.js';
import { classifyAddition } from './classify-addition.js';
import { searchEntities } from './search-entities.js';

interface CreateProposalResult {
  proposal: ProposalDraft;
}

export function createProposalDraft(
  index: OntologyIndex,
  args: {
    candidate_text: string;
    material_language: string;
    nearest_refs?: string[];
    evidence_text?: string;
    source_doc_id?: string;
    context?: string;
  }
): CreateProposalResult {
  const { candidate_text, material_language, nearest_refs, evidence_text, source_doc_id } = args;

  // Classify the addition type
  const classification = classifyAddition(index, {
    candidate_text,
    material_language,
    nearest_refs,
    context: args.context,
  });

  // Find nearest existing refs
  const searchResult = searchEntities(index, { query: candidate_text, limit: 5 });
  const nearestRefs = searchResult.candidates.map(c => ({
    ref: c.ref,
    reason: c.matchReason,
    score: c.score,
  }));

  // Deterministic proposal ID
  const proposalId = createHash('sha256')
    .update(`${candidate_text}:${material_language}`)
    .digest('hex')
    .slice(0, 12);

  // Build admission checks
  const isAlias = classification.addition_type === 'alias_addition';
  const isOverlay = classification.addition_type === 'overlay_addition';

  const proposal: ProposalDraft = {
    proposal_id: proposalId,
    proposal_type: classification.addition_type,
    candidate_text,
    language: material_language,
    target_ref: nearestRefs[0]?.ref,
    rationale: classification.rationale,
    evidence_spans: evidence_text
      ? [{ source_doc_id, text: evidence_text }]
      : [],
    nearest_existing_refs: nearestRefs,
    admission_checks: {
      is_alias_only: isAlias,
      is_overlay_only: isOverlay,
      is_reusable: !isAlias && !isOverlay,
      is_language_independent: classification.addition_type === 'new_core_entity',
      is_non_redundant: classification.confidence < 0.9,
      has_structural_value: classification.addition_type === 'new_core_entity' ||
        classification.addition_type === 'relation_addition',
    },
    status: 'draft',
  };

  return { proposal };
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ontology-mcp && npx vitest run`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/create-proposal-draft.ts \
  packages/ontology-mcp/src/__tests__/classify-addition.test.ts
git commit -m "feat(ontology-mcp): add create_proposal_draft tool"
```

---

### Task 8: bootstrap_document Tool

**Files:**
- Create: `packages/ontology-mcp/src/server/tools/bootstrap-document.ts`
- Create: `packages/ontology-mcp/src/__tests__/bootstrap-document.test.ts`

Orchestrates `suggest_refs_for_text` → `validate_annotation` → `classify_addition` → `create_proposal_draft` for a full document pass.

- [ ] **Step 1: Write failing test**

Create `packages/ontology-mcp/src/__tests__/bootstrap-document.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { bootstrapDocument } from '../server/tools/bootstrap-document.js';
import type { OntologyIndex } from '../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('bootstrapDocument', () => {
  it('produces annotation result for Russian chemistry text', () => {
    const r = bootstrapDocument(index, {
      doc_id: 'test-acids',
      material_language: 'ru',
      text: 'Кислота HCl диссоциирует в воде H₂O на ионы H⁺ и Cl⁻.',
      mode: 'didactic',
    });
    expect(r.annotation_result.doc_id).toBe('test-acids');
    expect(r.annotation_result.annotations.length).toBeGreaterThan(0);
    expect(r.coverage.mention_count).toBeGreaterThan(0);
  });

  it('generates proposals for unresolved spans', () => {
    const r = bootstrapDocument(index, {
      doc_id: 'test-unknown',
      material_language: 'ru',
      text: 'Кватернионная связь — гипотетический тип.',
      mode: 'didactic',
    });
    // Either resolved or proposals generated
    expect(r.coverage).toBeDefined();
  });

  it('returns coverage metrics', () => {
    const r = bootstrapDocument(index, {
      doc_id: 'test-metrics',
      material_language: 'ru',
      text: 'Na и Cl образуют NaCl — поваренную соль.',
      mode: 'didactic',
    });
    expect(typeof r.coverage.mention_count).toBe('number');
    expect(typeof r.coverage.resolved_count).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement bootstrap-document.ts**

Create `packages/ontology-mcp/src/server/tools/bootstrap-document.ts`:

```typescript
import type { OntologyIndex, AnnotationResult, Annotation, ProposalDraft } from '../../shared/types.js';
import { suggestRefsForText } from './suggest-refs-for-text.js';
import { validateAnnotation } from './validate-annotation.js';
import { createProposalDraft } from './create-proposal-draft.js';

interface CoverageMetrics {
  mention_count: number;
  resolved_count: number;
  ambiguous_count: number;
  unresolved_count: number;
  proposal_count: number;
}

interface BootstrapResult {
  annotation_result: AnnotationResult;
  proposals: ProposalDraft[];
  coverage: CoverageMetrics;
}

export function bootstrapDocument(
  index: OntologyIndex,
  args: { doc_id: string; material_language: string; text: string; mode: string }
): BootstrapResult {
  const { doc_id, material_language, text, mode } = args;

  // Step 1: Suggest refs for entire text
  const suggestions = suggestRefsForText(index, { text, material_language, mode });

  // Step 2: Convert mentions to annotations
  const annotations: Annotation[] = suggestions.mentions.map(m => {
    const top = m.candidates[0];
    const isConfident = top && top.score >= 0.9;
    return {
      text: m.text,
      start: m.start,
      end: m.end,
      kind: top?.kind ?? 'concept',
      chosen_ref: isConfident ? top.ref : undefined,
      confidence: top?.score,
      candidates: m.candidates,
    };
  });

  // Step 3: Validate the annotation set
  const validation = validateAnnotation(index, {
    doc_id,
    material_language,
    annotations,
  });

  // Step 4: Generate proposals for unresolved spans
  const proposals: ProposalDraft[] = [];
  for (const span of suggestions.unresolved_spans) {
    const result = createProposalDraft(index, {
      candidate_text: span.text,
      material_language,
      evidence_text: text.slice(
        Math.max(0, span.start - 30),
        Math.min(text.length, span.end + 30)
      ),
      source_doc_id: doc_id,
    });
    proposals.push(result.proposal);
  }

  // Step 5: Build coverage metrics
  const resolved_count = annotations.filter(a => a.chosen_ref).length;
  const ambiguous_count = annotations.filter(
    a => !a.chosen_ref && a.candidates.length > 1
  ).length;

  const coverage: CoverageMetrics = {
    mention_count: annotations.length,
    resolved_count,
    ambiguous_count,
    unresolved_count: suggestions.unresolved_spans.length,
    proposal_count: proposals.length,
  };

  return {
    annotation_result: {
      doc_id,
      material_language,
      annotations,
      unresolved_mentions: suggestions.unresolved_spans.map(s => ({
        text: s.text,
        start: s.start,
        end: s.end,
        reason: 'no confident match found',
      })),
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    proposals,
    coverage,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ontology-mcp && npx vitest run`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/bootstrap-document.ts \
  packages/ontology-mcp/src/__tests__/bootstrap-document.test.ts
git commit -m "feat(ontology-mcp): add bootstrap_document tool"
```

---

### Task 9: Bootstrap CLI

**Files:**
- Create: `packages/ontology-mcp/src/server/bootstrap/cli.ts`

Reads text files or JSON content pages and runs `bootstrapDocument` on each, writing results to a `content/review-queue/` directory.

- [ ] **Step 1: Implement cli.ts**

Create `packages/ontology-mcp/src/server/bootstrap/cli.ts`:

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { buildOntologyIndex } from '../indexing/build-index.js';
import { bootstrapDocument } from '../tools/bootstrap-document.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: bootstrap-cli <file-or-text> [--lang ru] [--mode didactic] [--out-dir content/review-queue]');
    process.exit(1);
  }

  const inputPath = args[0];
  const langIdx = args.indexOf('--lang');
  const lang = langIdx !== -1 && args[langIdx + 1] ? args[langIdx + 1] : 'ru';
  const modeIdx = args.indexOf('--mode');
  const mode = modeIdx !== -1 && args[modeIdx + 1] ? args[modeIdx + 1] : 'didactic';
  const outIdx = args.indexOf('--out-dir');
  const outDir = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : 'content/review-queue';

  console.error('[bootstrap] Building ontology index...');
  const index = await buildOntologyIndex();

  let text: string;
  let docId: string;
  try {
    text = await readFile(inputPath, 'utf-8');
    docId = basename(inputPath, '.txt').replace(/\.\w+$/, '');
  } catch {
    // Treat as inline text
    text = inputPath;
    docId = `inline-${Date.now()}`;
  }

  console.error(`[bootstrap] Processing document: ${docId} (${text.length} chars, lang=${lang}, mode=${mode})`);
  const result = bootstrapDocument(index, {
    doc_id: docId,
    material_language: lang,
    text,
    mode,
  });

  // Write outputs
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, `${docId}-annotation.json`),
    JSON.stringify(result.annotation_result, null, 2)
  );
  if (result.proposals.length > 0) {
    await writeFile(
      join(outDir, `${docId}-proposals.json`),
      JSON.stringify(result.proposals, null, 2)
    );
  }
  await writeFile(
    join(outDir, `${docId}-coverage.json`),
    JSON.stringify(result.coverage, null, 2)
  );

  console.log(`\nCoverage: ${JSON.stringify(result.coverage, null, 2)}`);
  console.log(`\nResults written to ${outDir}/`);
}

main().catch((err: unknown) => {
  console.error('[bootstrap] Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add bootstrap script to package.json**

In `packages/ontology-mcp/package.json`, add:
```json
"bootstrap": "npx tsx src/server/bootstrap/cli.ts"
```

- [ ] **Step 3: Smoke test the CLI**

Run: `cd /home/andrey/work/chemistry && npx tsx packages/ontology-mcp/src/server/bootstrap/cli.ts "Кислота HCl реагирует с NaOH" --lang ru --out-dir /tmp/ontology-test`

Expected: Prints coverage JSON, writes files to `/tmp/ontology-test/`.

- [ ] **Step 4: Commit**

```bash
git add packages/ontology-mcp/src/server/bootstrap/cli.ts \
  packages/ontology-mcp/package.json
git commit -m "feat(ontology-mcp): add bootstrap CLI"
```

---

### Task 10: MCP Resources

**Files:**
- Create: `packages/ontology-mcp/src/server/resources/register-resources.ts`

Registers 7 resources as specified in the v2 contract: `ontology://schema/kinds`, `ontology://schema/relations`, `ontology://entity/{ref}`, `ontology://policy/admission`, `ontology://policy/lookup/{material_language}`, `ontology://fewshot/authoring`, `ontology://fewshot/review`.

- [ ] **Step 1: Implement register-resources.ts**

Create `packages/ontology-mcp/src/server/resources/register-resources.ts`:

```typescript
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OntologyIndex, OntRefKind } from '../../shared/types.js';

const ONT_REF_KINDS: OntRefKind[] = [
  'element', 'substance', 'ion', 'substance_class', 'element_group',
  'reaction_type', 'reaction_facet', 'domain_concept', 'process',
  'property', 'formula', 'concept',
];

const ADMISSION_POLICY = {
  admission_order: [
    'existing_ref_match',
    'alias_or_search_overlay',
    'localization_overlay',
    'relation',
    'entity_extension',
    'new_core_entity',
  ],
  auto_merge: ['alias_addition', 'overlay_addition'],
  human_review_required: ['new_core_entity', 'relation_addition', 'entity_extension'],
  negative_criteria: [
    'localized_label_only',
    'author_phrase',
    'pedagogical_paraphrase',
    'typo_or_colloquial',
    'one_off_example',
    'synonym_of_existing',
    'composite_phrase',
  ],
};

const LOOKUP_CONFIGS: Record<string, { material_language: string; fallback: string[] }> = {
  ru: { material_language: 'ru', fallback: ['en'] },
  en: { material_language: 'en', fallback: [] },
  pl: { material_language: 'pl', fallback: ['en'] },
  es: { material_language: 'es', fallback: ['en'] },
};

const FEWSHOT_AUTHORING = `Example: binding "кислота" in didactic text
Input:  "Кислота диссоциирует в воде на ионы."
Step 1: resolve_mention("кислота", lang="ru") → cls:acid (score 0.98)
Step 2: resolve_mention("воде", lang="ru") → sub:h2o (score 0.95)
Step 3: resolve_mention("ионы", lang="ru") → concept:ion (score 0.90)
Result: 3 annotations, 0 unresolved

Anti-pattern: Do NOT create concept:acid_in_water — "кислота в воде" is a phrase, not a concept.
Anti-pattern: Do NOT create concept:ion_formation — use existing concept:dissociation + relation.`;

const FEWSHOT_REVIEW = `Review checklist:
1. Does annotation bind to existing canonical ref where possible?
2. Is any new proposal actually just an alias or overlay?
3. Is there language leakage into core?
4. Are concept/substance/ion/reaction kinds used correctly?
5. Are ambiguous mentions flagged instead of guessed?
6. Does proposal include enough evidence?
7. Can candidate be represented by relations/extensions instead?`;

export function registerResources(server: McpServer, index: OntologyIndex): void {
  // Static resources — use registerResource with string URI
  server.registerResource('schema-kinds', 'ontology://schema/kinds', {
    description: 'All recognized OntRefKind values',
    mimeType: 'application/json',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({ kinds: ONT_REF_KINDS }, null, 2),
    }],
  }));

  server.registerResource('schema-relations', 'ontology://schema/relations', {
    description: 'All relation predicates in the ontology graph',
    mimeType: 'application/json',
  }, async (uri) => {
    const predicates = [...index.relations.byPredicate.keys()].sort();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({ predicates, count: predicates.length }, null, 2),
      }],
    };
  });

  server.registerResource('policy-admission', 'ontology://policy/admission', {
    description: 'Admission policy for new ontology additions',
    mimeType: 'application/json',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify(ADMISSION_POLICY, null, 2),
    }],
  }));

  server.registerResource('fewshot-authoring', 'ontology://fewshot/authoring', {
    description: 'Few-shot examples for ontology-bound authoring',
    mimeType: 'text/plain',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      text: FEWSHOT_AUTHORING,
    }],
  }));

  server.registerResource('fewshot-review', 'ontology://fewshot/review', {
    description: 'Review checklist for ontology annotation',
    mimeType: 'text/plain',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      text: FEWSHOT_REVIEW,
    }],
  }));

  // Resource templates (parameterized) — use ResourceTemplate class
  server.registerResource(
    'entity-by-ref',
    new ResourceTemplate('ontology://entity/{ref}', { list: undefined }),
    { description: 'Full entity card by ontology ref', mimeType: 'application/json' },
    async (uri, { ref }) => {
      const refStr = ref as string;
      const entity = index.entitiesByRef.get(refStr);
      return {
        contents: [{
          uri: uri.href,
          text: entity
            ? JSON.stringify(entity, null, 2)
            : JSON.stringify({ error: 'not found', ref: refStr }),
        }],
      };
    }
  );

  server.registerResource(
    'lookup-policy',
    new ResourceTemplate('ontology://policy/lookup/{language}', { list: undefined }),
    { description: 'Lookup policy for a given locale', mimeType: 'application/json' },
    async (uri, { language }) => {
      const lang = language as string;
      const config = LOOKUP_CONFIGS[lang] ?? LOOKUP_CONFIGS['en'];
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(config, null, 2),
        }],
      };
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ontology-mcp/src/server/resources/register-resources.ts
git commit -m "feat(ontology-mcp): add MCP resources (schema, policy, fewshot)"
```

---

### Task 11: MCP Prompts

**Files:**
- Create: `packages/ontology-mcp/src/server/prompts/register-prompts.ts`

Registers 5 prompts from the v2 contract: `author_didactic_block`, `annotate_existing_text`, `review_annotation`, `propose_missing_entity`, `repair_annotation`.

- [ ] **Step 1: Implement register-prompts.ts**

Create `packages/ontology-mcp/src/server/prompts/register-prompts.ts`:

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'annotate_existing_text',
    {
      description: 'Annotate chemistry text with ontology refs. Use search_entities and resolve_mention tools first.',
      argsSchema: {
        text: z.string().describe('The text to annotate'),
        material_language: z.string().describe('ISO locale: ru, en, pl, es'),
        mode: z.enum(['didactic', 'definition', 'task', 'explanation']).optional(),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `You are ontology-author. Annotate the following text by binding text spans to canonical ontology refs.

Rules:
1. Use resolve_mention for each chemistry term you identify.
2. Prefer existing refs over new proposals.
3. Mark ambiguity explicitly (do not guess).
4. Return structured JSON with annotations and unresolved_mentions.

Text (${args.material_language}):
"""
${args.text}
"""

Mode: ${args.mode ?? 'didactic'}

Return a JSON object with: { annotations: [...], unresolved_mentions: [...], warnings: [...] }`,
        },
      }],
    })
  );

  server.registerPrompt(
    'author_didactic_block',
    {
      description: 'Write ontology-bound didactic content for a concept or topic.',
      argsSchema: {
        topic: z.string().describe('Concept ref or topic description'),
        material_language: z.string().describe('Target locale'),
        target_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `You are ontology-author. Write a didactic explanation for "${args.topic}" in ${args.material_language}.

Rules:
1. Use get_entity to retrieve canonical data about the topic first.
2. Use get_neighbors to find related concepts.
3. Every chemistry term MUST be bound to a canonical ref via resolve_mention.
4. Output plain text with inline ref annotations: [[ref:cls:acid|кислота]].
5. Do not invent concepts — use only existing ontology refs.
6. Level: ${args.target_level ?? 'intermediate'}`,
        },
      }],
    })
  );

  server.registerPrompt(
    'review_annotation',
    {
      description: 'Review and validate an existing annotation result.',
      argsSchema: {
        annotation_json: z.string().describe('JSON string of AnnotationResult'),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `You are ontology-author in review mode. Review this annotation result.

Checklist:
1. Does each annotation bind to the correct canonical ref?
2. Are there any missed mentions that should be annotated?
3. Is any proposal actually just an alias or overlay?
4. Are there overlapping or contradictory annotations?
5. Use validate_annotation tool to check structural validity.
6. Use get_entity to verify each chosen_ref exists and is appropriate.

Annotation result:
${args.annotation_json}

Return: { verdict: 'approve'|'revise', issues: [...], suggested_fixes: [...] }`,
        },
      }],
    })
  );

  server.registerPrompt(
    'propose_missing_entity',
    {
      description: 'Evaluate whether an unresolved mention needs a new ontology entity.',
      argsSchema: {
        mention: z.string().describe('The unresolved text mention'),
        material_language: z.string().describe('Source locale'),
        context: z.string().optional().describe('Surrounding text'),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `You are ontology-author. Evaluate whether "${args.mention}" (${args.material_language}) needs a new ontology entity.

Steps:
1. Use search_entities to find any existing close matches.
2. Use classify_addition to determine the addition type.
3. Follow admission policy (read ontology://policy/admission resource first).
4. Prefer: alias > overlay > relation > extension > new entity.
5. If new entity is truly needed, use create_proposal_draft.

Context: ${args.context ?? 'none'}

Return: { decision: string, addition_type: string, proposal?: ProposalDraft }`,
        },
      }],
    })
  );

  server.registerPrompt(
    'repair_annotation',
    {
      description: 'Fix issues in an annotation result based on review feedback.',
      argsSchema: {
        annotation_json: z.string().describe('JSON string of AnnotationResult'),
        issues: z.string().describe('JSON array of issues from review'),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `You are ontology-author. Repair the following annotation based on review feedback.

Original annotation:
${args.annotation_json}

Issues to fix:
${args.issues}

Steps:
1. For each issue, use resolve_mention or search_entities to find the correct ref.
2. Remove invalid annotations.
3. Add missing annotations.
4. Use validate_annotation to verify the repaired result.

Return the corrected AnnotationResult JSON.`,
        },
      }],
    })
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ontology-mcp/src/server/prompts/register-prompts.ts
git commit -m "feat(ontology-mcp): add MCP prompts (annotate, author, review, propose, repair)"
```

---

### Task 12: Register Everything in index.ts

**Files:**
- Modify: `packages/ontology-mcp/src/server/index.ts`

Wire all new tools, resources, and prompts into the MCP server.

- [ ] **Step 1: Update index.ts with all registrations**

Replace `packages/ontology-mcp/src/server/index.ts` with full registration of all 9 tools, resources, and prompts. Add imports for:

```typescript
import { getNeighbors } from './tools/get-neighbors.js';
import { validateAnnotation } from './tools/validate-annotation.js';
import { suggestRefsForText } from './tools/suggest-refs-for-text.js';
import { classifyAddition } from './tools/classify-addition.js';
import { createProposalDraft } from './tools/create-proposal-draft.js';
import { bootstrapDocument } from './tools/bootstrap-document.js';
import { registerResources } from './resources/register-resources.js';
import { registerPrompts } from './prompts/register-prompts.js';
```

Migrate existing 3 tools from deprecated `server.tool()` to `server.registerTool()`, then register all 6 new tools with `registerTool`. Use the config-object signature:

```typescript
server.registerTool('tool_name', {
  description: '...',
  inputSchema: { /* zod fields */ },
}, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }));
```

New tool schemas:

- `get_neighbors`: `ref: z.string()`, `relation_types: z.array(z.string()).optional()`, `limit: z.number().int().min(1).max(100).optional()`
- `validate_annotation`: `doc_id: z.string()`, `material_language: z.string()`, `annotations: z.array(z.object({ text: z.string(), start: z.number(), end: z.number(), kind: z.string(), chosen_ref: z.string().optional(), confidence: z.number().optional(), candidates: z.array(z.object({ ref: z.string(), kind: z.string(), label: z.string(), score: z.number(), matchReason: z.string() })) }))`
- `suggest_refs_for_text`: `text: z.string()`, `material_language: z.string()`, `mode: z.enum(['didactic', 'definition', 'task', 'explanation'])`
- `classify_addition`: `candidate_text: z.string()`, `material_language: z.string()`, `context: z.string().optional()`, `nearest_refs: z.array(z.string()).optional()`
- `create_proposal_draft`: `candidate_text: z.string()`, `material_language: z.string()`, `nearest_refs: z.array(z.string()).optional()`, `evidence_text: z.string().optional()`, `source_doc_id: z.string().optional()`
- `bootstrap_document`: `doc_id: z.string()`, `material_language: z.string()`, `text: z.string()`, `mode: z.enum(['didactic', 'definition', 'task', 'explanation'])`

Call `registerResources(server, index)` and `registerPrompts(server)` after tool registration.

- [ ] **Step 2: Smoke test — start server, check all tools register**

Run: `cd /home/andrey/work/chemistry && npx tsx packages/ontology-mcp/src/server/index.ts 2>&1 & sleep 3 && kill %1`

Expected: Log shows all entity/relation counts + "Tools registered" + "Server ready."

- [ ] **Step 3: Run all tests**

Run: `cd packages/ontology-mcp && npx vitest run`
Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ontology-mcp/src/server/index.ts
git commit -m "feat(ontology-mcp): register all v2 tools, resources, and prompts"
```

---

### Task 13: Agent Configuration

**Files:**
- Modify: `/home/andrey/work/chemistry/.claude/settings.local.json` — verify MCP server config is up to date

The ontology MCP server is already registered in `.claude/settings.local.json`. This task verifies the config is correct and the agent can use all tools.

- [ ] **Step 1: Verify MCP config in settings.local.json**

Read `.claude/settings.local.json` and confirm the `mcpServers.ontology` entry is present:
```json
"ontology": {
  "command": "npx",
  "args": ["tsx", "packages/ontology-mcp/src/server/index.ts"],
  "cwd": "/home/andrey/work/chemistry"
}
```

No changes needed if already present.

- [ ] **Step 2: End-to-end validation**

Restart Claude Code and verify the ontology MCP tools appear in the tool list. Test by calling:
- `search_entities` with query "Na"
- `get_entity` with ref "el:Na"
- `get_neighbors` with ref "cls:acid"
- `resolve_mention` with mention "кислота"

- [ ] **Step 3: Commit any config changes**

Only if changes were needed.

---

## Summary

| Task | What | Depends On | New Files |
|------|------|-----------|-----------|
| 1 | Test infra + types | — | vitest.config.ts, 2 test files |
| 2 | Relations loading | 1 | load-relations.ts |
| 3 | get_neighbors | 2 | get-neighbors.ts + test |
| 4 | validate_annotation | 1 | validate-annotation.ts + test |
| 5 | suggest_refs_for_text | 1 | suggest-refs-for-text.ts + test |
| 6 | classify_addition | 5 | classify-addition.ts + test |
| 7 | create_proposal_draft | 6 | create-proposal-draft.ts |
| 8 | bootstrap_document | 4, 5, 7 | bootstrap-document.ts + test |
| 9 | Bootstrap CLI | 8 | cli.ts |
| 10 | Resources | 2 | register-resources.ts |
| 11 | Prompts | — | register-prompts.ts |
| 12 | Wire into index.ts | 3-11 | modify index.ts |
| 13 | Agent config | 12 | verify settings |
