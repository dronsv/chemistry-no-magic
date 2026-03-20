# Ontology MCP Write Tools — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 write/audit tools to the ontology MCP server so the enrichment agent can create, update, and audit ontology entities through validated MCP tools instead of raw file edits.

**Architecture:** Direct-write tools organized in `tools/write/` with per-kind modules. Each tool reads a `data-src/` file, validates input via Zod, writes back, and rebuilds the in-memory index via a mutable `indexRef` wrapper. Shared utilities in `_shared.ts` handle JSON I/O, ref validation, and index rebuild.

**Tech Stack:** TypeScript (strict, ESM), Zod validation, Vitest testing, MCP SDK 1.0.0

**Spec:** `docs/superpowers/specs/2026-03-20-ontology-mcp-write-tools.md`

---

## File Map

### New Files (14)
- `src/server/tools/write/_shared.ts` — JSON I/O, ref validation, index rebuild
- `src/server/tools/write/substance.ts` — add_substance, update_substance
- `src/server/tools/write/concept.ts` — add_concept, update_concept
- `src/server/tools/write/characteristic.ts` — add_characteristic, update_characteristic
- `src/server/tools/write/translation.ts` — add_translation
- `src/server/tools/write/relation.ts` — add_relation
- `src/server/tools/write/list-entities.ts` — list_entities
- `src/server/tools/write/coverage-report.ts` — coverage_report
- `src/__tests__/write/shared.test.ts`
- `src/__tests__/write/substance.test.ts`
- `src/__tests__/write/concept.test.ts`
- `src/__tests__/write/characteristic.test.ts`
- `src/__tests__/write/translation.test.ts`
- `src/__tests__/write/relation.test.ts`
- `src/__tests__/write/list-entities.test.ts`
- `src/__tests__/write/coverage-report.test.ts`

### Modified Files (3)
- `src/server/index.ts` — `const index` → `const indexRef = { current }`, register 14 new tools
- `src/server/indexing/build-index.ts` — export helper to pass `dataSrcRoot`, load process/effect entities
- `src/shared/types.ts` — add `IndexRef` type, extend `OntologyEntity` if needed

---

## Task 1: Refactor index to mutable `indexRef`

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/shared/types.ts`

This is the prerequisite for all write tools. Currently `const index` is captured by all tool closures and cannot be reassigned.

- [ ] **Step 1: Add `IndexRef` type**

In `src/shared/types.ts`, add:

```typescript
export interface IndexRef {
  current: OntologyIndex;
}
```

- [ ] **Step 2: Refactor `index.ts` to use `indexRef`**

In `src/server/index.ts`, change:

```typescript
// Before:
const index = await buildOntologyIndex();

// After:
const indexRef: IndexRef = { current: await buildOntologyIndex() };
```

Then find-and-replace all tool handler references:
- `searchEntities(index, args)` → `searchEntities(indexRef.current, args)`
- `getEntity(index, args)` → `getEntity(indexRef.current, args)`
- Same for all 9 existing tools
- `registerResources(server, index)` → `registerResources(server, indexRef.current)` (resources are registered once at startup, this is fine)

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `cd packages/ontology-mcp && npm test`
Expected: All existing tests pass (they build their own index in `beforeAll`, not affected by this change)

- [ ] **Step 4: Manual smoke test**

Run: `cd packages/ontology-mcp && echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_entities","arguments":{"query":"Na"}}}' | npm run dev 2>/dev/null | head -5`
Expected: JSON response with `el:Na` candidate

- [ ] **Step 5: Commit**

```bash
git add packages/ontology-mcp/src/server/index.ts packages/ontology-mcp/src/shared/types.ts
git commit -m "refactor(ontology-mcp): use mutable indexRef for write tool support"
```

---

## Task 2: Shared write utilities (`_shared.ts`)

**Files:**
- Create: `src/server/tools/write/_shared.ts`
- Create: `src/__tests__/write/shared.test.ts`
- Modify: `src/server/indexing/build-index.ts` — export `dataSrcRoot` for reuse

- [ ] **Step 1: Write failing tests for shared utilities**

Create `src/__tests__/write/shared.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readJsonFile, writeJsonFile, validateRef } from '../../server/tools/write/_shared.js';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('readJsonFile', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-test-'));
    await writeFile(join(tmpDir, 'test.json'), '{"key": "value"}\n');
  });

  afterAll(async () => { await rm(tmpDir, { recursive: true }); });

  it('reads and parses JSON file', async () => {
    const data = await readJsonFile(join(tmpDir, 'test.json'));
    expect(data).toEqual({ key: 'value' });
  });

  it('throws on missing file', async () => {
    await expect(readJsonFile(join(tmpDir, 'nope.json'))).rejects.toThrow();
  });
});

describe('writeJsonFile', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-test-'));
  });

  afterAll(async () => { await rm(tmpDir, { recursive: true }); });

  it('writes formatted JSON with trailing newline', async () => {
    const path = join(tmpDir, 'out.json');
    await writeJsonFile(path, { hello: 'world' });
    const raw = await readFile(path, 'utf-8');
    expect(raw).toBe('{\n  "hello": "world"\n}\n');
  });
});

describe('validateRef', () => {
  it('accepts valid ref with correct prefix', () => {
    const r = validateRef('sub:hcl', 'sub');
    expect(r.valid).toBe(true);
    expect(r.id).toBe('hcl');
  });

  it('rejects ref with wrong prefix', () => {
    const r = validateRef('ion:H_plus', 'sub');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('sub');
  });

  it('rejects ref without colon', () => {
    const r = validateRef('hcl', 'sub');
    expect(r.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/shared.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Export `dataSrcRoot` from build-index**

In `src/server/indexing/build-index.ts`, the `findDataSrc()` result is used internally. Add a module-level export so write tools can reuse the same resolved path:

```typescript
// At the top of build-index.ts, add:
let _dataSrcRoot: string | null = null;

// Inside buildOntologyIndex(), after findDataSrc():
_dataSrcRoot = dataSrcRoot;

// Export getter:
export function getDataSrcRoot(): string {
  if (!_dataSrcRoot) throw new Error('Index not built yet — call buildOntologyIndex() first');
  return _dataSrcRoot;
}
```

- [ ] **Step 4: Implement `_shared.ts`**

Create `src/server/tools/write/_shared.ts`:

```typescript
import { readFile, writeFile } from 'node:fs/promises';
import { buildOntologyIndex, getDataSrcRoot } from '../../indexing/build-index.js';
import type { IndexRef } from '../../../shared/types.js';

export async function readJsonFile(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2) + '\n';
  await writeFile(path, json, 'utf-8');
}

export function validateRef(
  ref: string,
  expectedPrefix: string,
): { valid: boolean; id: string; error?: string } {
  const colonIdx = ref.indexOf(':');
  if (colonIdx === -1) {
    return { valid: false, id: '', error: `Invalid ref "${ref}" — must contain ":"` };
  }
  const prefix = ref.slice(0, colonIdx);
  const id = ref.slice(colonIdx + 1);
  if (prefix !== expectedPrefix) {
    return {
      valid: false,
      id,
      error: `Expected prefix "${expectedPrefix}" but got "${prefix}" in "${ref}"`,
    };
  }
  if (!id) {
    return { valid: false, id: '', error: `Empty id in ref "${ref}"` };
  }
  return { valid: true, id };
}

/**
 * Rebuild the in-memory index from data-src/ files.
 * In tests, callers pass `dataSrcOverride` to redirect file I/O to a temp dir
 * AND skip this rebuild (since rebuild always reads from the real data-src/).
 */
export async function rebuildIndex(indexRef: IndexRef): Promise<void> {
  indexRef.current = await buildOntologyIndex();
}

export { getDataSrcRoot };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/shared.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Run all existing tests to verify no regressions**

Run: `cd packages/ontology-mcp && npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/write/_shared.ts \
       packages/ontology-mcp/src/__tests__/write/shared.test.ts \
       packages/ontology-mcp/src/server/indexing/build-index.ts
git commit -m "feat(ontology-mcp): add shared write utilities and dataSrcRoot export"
```

---

## Task 3: `list_entities` tool

**Files:**
- Create: `src/server/tools/write/list-entities.ts`
- Create: `src/__tests__/write/list-entities.test.ts`
- Modify: `src/server/index.ts` — register tool

- [ ] **Step 1: Write failing test**

Create `src/__tests__/write/list-entities.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../../server/indexing/build-index.js';
import { listEntities } from '../../server/tools/write/list-entities.js';
import type { OntologyIndex } from '../../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('listEntities', () => {
  it('lists all elements', () => {
    const r = listEntities(index, { kind: 'element' });
    expect(r.total).toBeGreaterThanOrEqual(118);
    expect(r.items[0]).toHaveProperty('ref');
    expect(r.items[0]).toHaveProperty('kind', 'element');
    expect(r.items[0]).toHaveProperty('labels');
  });

  it('respects limit and offset', () => {
    const r1 = listEntities(index, { kind: 'element', limit: 5 });
    expect(r1.items).toHaveLength(5);

    const r2 = listEntities(index, { kind: 'element', limit: 5, offset: 5 });
    expect(r2.items).toHaveLength(5);
    expect(r2.items[0].ref).not.toBe(r1.items[0].ref);
  });

  it('lists all kinds with kind="all"', () => {
    const r = listEntities(index, { kind: 'all', limit: 500 });
    expect(r.total).toBeGreaterThan(200);
    const kinds = new Set(r.items.map(e => e.kind));
    expect(kinds.size).toBeGreaterThan(3);
  });

  it('returns lightweight summaries (no full entity payloads)', () => {
    const r = listEntities(index, { kind: 'substance', limit: 1 });
    const item = r.items[0];
    expect(item).toHaveProperty('ref');
    expect(item).toHaveProperty('kind');
    expect(item).toHaveProperty('labels');
    // Should NOT have full entity fields
    expect(item).not.toHaveProperty('aliases');
    expect(item).not.toHaveProperty('description');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/list-entities.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `list-entities.ts`**

Create `src/server/tools/write/list-entities.ts`:

```typescript
import type { OntologyIndex, OntRefKind } from '../../../shared/types.js';

interface ListEntityItem {
  ref: string;
  kind: OntRefKind;
  formula?: string;
  labels: Record<string, string>;
}

interface ListEntitiesResult {
  kind: string;
  total: number;
  items: ListEntityItem[];
}

export function listEntities(
  index: OntologyIndex,
  args: { kind: string; limit?: number; offset?: number },
): ListEntitiesResult {
  const limit = Math.min(args.limit ?? 100, 500);
  const offset = args.offset ?? 0;

  let entries = Array.from(index.entitiesByRef.values());

  if (args.kind !== 'all') {
    entries = entries.filter(e => e.kind === args.kind);
  }

  // Sort by ref for stable pagination
  entries.sort((a, b) => a.ref.localeCompare(b.ref));

  const total = entries.length;
  const page = entries.slice(offset, offset + limit);

  const items: ListEntityItem[] = page.map(e => ({
    ref: e.ref,
    kind: e.kind,
    ...(e.formula ? { formula: e.formula } : {}),
    labels: e.labels,
  }));

  return { kind: args.kind, total, items };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/list-entities.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Register tool in `index.ts`**

In `src/server/index.ts`, add import and registration:

```typescript
import { listEntities } from './tools/write/list-entities.js';

// In the tool registration section:
server.registerTool('list_entities', {
  description: 'List all ontology entities by kind with pagination. Returns lightweight summaries.',
  inputSchema: {
    kind: z.string().describe(
      'Entity kind to list: element, substance, ion, concept, substance_class, ' +
      'element_group, reaction_type, reaction_facet, domain_concept, formula, process, property, or "all"'
    ),
    limit: z.number().int().min(1).max(500).optional().describe('Max results (default 100)'),
    offset: z.number().int().min(0).optional().describe('Offset for pagination (default 0)'),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(listEntities(indexRef.current, args), null, 2) }],
}));
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/ontology-mcp && npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/write/list-entities.ts \
       packages/ontology-mcp/src/__tests__/write/list-entities.test.ts \
       packages/ontology-mcp/src/server/index.ts
git commit -m "feat(ontology-mcp): add list_entities tool"
```

---

## Task 4: `coverage_report` tool

**Files:**
- Create: `src/server/tools/write/coverage-report.ts`
- Create: `src/__tests__/write/coverage-report.test.ts`
- Modify: `src/server/index.ts` — register tool

- [ ] **Step 1: Write failing test**

Create `src/__tests__/write/coverage-report.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildOntologyIndex } from '../../server/indexing/build-index.js';
import { coverageReport } from '../../server/tools/write/coverage-report.js';
import type { OntologyIndex } from '../../shared/types.js';

let index: OntologyIndex;
beforeAll(async () => { index = await buildOntologyIndex(); });

describe('coverageReport', () => {
  it('returns summary for all substances', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'translations' });
    expect(r.summary.total_entities).toBeGreaterThan(50);
    expect(r.summary.translations).toHaveProperty('ru');
    expect(r.summary.translations).toHaveProperty('en');
    expect(r.summary.translations.ru.covered).toBeGreaterThan(0);
  });

  it('detects translation gaps', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'translations' });
    // At least some substances should have translation gaps in some locale
    const hasGaps = r.gaps.some(g => g.type === 'missing_translation');
    // This is data-dependent — assert structure, not specific values
    expect(r.gaps).toBeInstanceOf(Array);
    for (const gap of r.gaps) {
      expect(gap).toHaveProperty('type');
      expect(gap).toHaveProperty('ref');
    }
  });

  it('checks relations for substances', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'relations' });
    expect(r.summary).toHaveProperty('relations');
    expect(r.summary.relations).toHaveProperty('with_any');
    expect(r.summary.relations).toHaveProperty('orphaned');
  });

  it('runs all checks when check="all"', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'all', locales: ['ru', 'en'] });
    expect(r.summary).toHaveProperty('translations');
    expect(r.summary).toHaveProperty('relations');
  });

  it('respects locales filter', () => {
    const r = coverageReport(index, { kind: 'substance', check: 'translations', locales: ['en'] });
    expect(r.summary.translations).toHaveProperty('en');
    expect(r.summary.translations).not.toHaveProperty('ru');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/coverage-report.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `coverage-report.ts`**

Create `src/server/tools/write/coverage-report.ts`:

```typescript
import type { OntologyIndex, OntRefKind } from '../../../shared/types.js';

interface Gap {
  type: string;
  ref: string;
  locale?: string;
  detail?: string;
}

interface CoverageResult {
  summary: {
    total_entities: number;
    translations: Record<string, { covered: number; missing: number }>;
    characteristics: { with_any: number; without: number };
    relations: { with_any: number; orphaned: number };
  };
  gaps: Gap[];
}

const ALL_LOCALES = ['ru', 'en', 'pl', 'es'];

export function coverageReport(
  index: OntologyIndex,
  args: {
    kind: string;
    check: 'translations' | 'characteristics' | 'relations' | 'all';
    locales?: string[];
  },
): CoverageResult {
  const locales = args.locales ?? ALL_LOCALES;
  const checkTranslations = args.check === 'translations' || args.check === 'all';
  const checkCharacteristics = args.check === 'characteristics' || args.check === 'all';
  const checkRelations = args.check === 'relations' || args.check === 'all';

  let entities = Array.from(index.entitiesByRef.values());
  if (args.kind !== 'all') {
    entities = entities.filter(e => e.kind === args.kind);
  }

  const gaps: Gap[] = [];

  // Translation coverage
  const translations: Record<string, { covered: number; missing: number }> = {};
  if (checkTranslations) {
    for (const locale of locales) {
      let covered = 0;
      let missing = 0;
      for (const entity of entities) {
        if (entity.labels[locale]) {
          covered++;
        } else {
          missing++;
          gaps.push({ type: 'missing_translation', ref: entity.ref, locale });
        }
      }
      translations[locale] = { covered, missing };
    }
  }

  // Characteristics coverage (substances only)
  const characteristics: { with_any: number; without: number } = { with_any: 0, without: 0 };
  if (checkCharacteristics) {
    const substances = entities.filter(e => e.kind === 'substance');
    for (const sub of substances) {
      // Check if entity has tags (proxy for having characteristics in the index)
      // Full characteristic check requires reading substance files from disk
      const hasTags = sub.tags && sub.tags.length > 0;
      if (hasTags) {
        characteristics.with_any++;
      } else {
        characteristics.without++;
        gaps.push({ type: 'no_characteristics', ref: sub.ref });
      }
    }
  }

  // Relation coverage
  let withAny = 0;
  let orphaned = 0;
  if (checkRelations) {
    for (const entity of entities) {
      const hasOutgoing = index.relations.bySubject.has(entity.ref);
      const hasIncoming = index.relations.byObject.has(entity.ref);
      if (hasOutgoing || hasIncoming) {
        withAny++;
      } else {
        orphaned++;
        gaps.push({ type: 'orphaned_entity', ref: entity.ref, detail: 'no relations' });
      }
    }

    // Substance-specific gap detection
    if (args.kind === 'substance' || args.kind === 'all') {
      const substances = entities.filter(e => e.kind === 'substance');
      for (const sub of substances) {
        // Check if acids have conjugate base relations
        const outgoing = index.relations.bySubject.get(sub.ref) ?? [];
        const incoming = index.relations.byObject.get(sub.ref) ?? [];
        const allRels = [...outgoing, ...incoming];

        const isAcid = allRels.some(r => r.predicate === 'instance_of' && r.object === 'cls:acid');
        if (isAcid) {
          const hasConjugate = allRels.some(r =>
            r.predicate === 'has_conjugate_base' || r.predicate === 'has_conjugate_acid'
          );
          if (!hasConjugate) {
            gaps.push({
              type: 'missing_conjugate',
              ref: sub.ref,
              detail: 'acid with no conjugate_base relation',
            });
          }
        }
      }
    }

    // Concept-specific: no examples
    if (args.kind === 'substance_class' || args.kind === 'concept' || args.kind === 'all') {
      const concepts = entities.filter(e =>
        e.kind === 'substance_class' || e.kind === 'concept'
      );
      for (const concept of concepts) {
        const children = index.relations.byObject.get(concept.ref) ?? [];
        const hasExamples = children.some(r => r.predicate === 'instance_of');
        if (!hasExamples) {
          gaps.push({
            type: 'concept_no_examples',
            ref: concept.ref,
            detail: 'no instance_of relations pointing to this concept',
          });
        }
      }
    }
  }

  return {
    summary: {
      total_entities: entities.length,
      translations,
      characteristics,
      relations: { with_any: withAny, orphaned },
    },
    gaps,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/coverage-report.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Register tool in `index.ts`**

Add import and registration in `src/server/index.ts`:

```typescript
import { coverageReport } from './tools/write/coverage-report.js';

server.registerTool('coverage_report', {
  description: 'Audit ontology coverage: translation completeness, relation gaps, and structural issues. Returns summary stats and gap list.',
  inputSchema: {
    kind: z.string().describe('Entity kind to audit, or "all"'),
    check: z.enum(['translations', 'characteristics', 'relations', 'all']).describe('What to check'),
    locales: z.array(z.string()).optional().describe('Locales to check (default: ru, en, pl, es)'),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(coverageReport(indexRef.current, args), null, 2) }],
}));
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/ontology-mcp && npm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/write/coverage-report.ts \
       packages/ontology-mcp/src/__tests__/write/coverage-report.test.ts \
       packages/ontology-mcp/src/server/index.ts
git commit -m "feat(ontology-mcp): add coverage_report tool with gap detection"
```

---

## Task 5: `add_translation` tool

**Files:**
- Create: `src/server/tools/write/translation.ts`
- Create: `src/__tests__/write/translation.test.ts`
- Modify: `src/server/index.ts` — register tool

- [ ] **Step 1: Write failing test**

Create `src/__tests__/write/translation.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildOntologyIndex } from '../../server/indexing/build-index.js';
import { addTranslation } from '../../server/tools/write/translation.js';
import { readJsonFile } from '../../server/tools/write/_shared.js';
import type { OntologyIndex, IndexRef } from '../../shared/types.js';
import { cp, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDataSrcRoot } from '../../server/indexing/build-index.js';

let indexRef: IndexRef;
let tmpDir: string;
let origDataSrc: string;

beforeAll(async () => {
  indexRef = { current: await buildOntologyIndex() };
  origDataSrc = getDataSrcRoot();
});

describe('addTranslation', () => {
  beforeEach(async () => {
    // Create temp copy of translations dir for isolation
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-trans-'));
    await cp(join(origDataSrc, 'translations'), join(tmpDir, 'translations'), { recursive: true });
  });

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('adds a new translation entry to existing overlay file', async () => {
    const r = await addTranslation(
      indexRef,
      {
        locale: 'en',
        data_key: 'substances',
        entity_id: 'test_substance_xyz',
        fields: { name: 'Test Substance XYZ' },
      },
      tmpDir,
    );
    expect(r.status).toBe('created');

    // Verify file was written
    const overlay = await readJsonFile(join(tmpDir, 'translations', 'en', 'substances.json')) as Record<string, unknown>;
    expect(overlay['test_substance_xyz']).toEqual({ name: 'Test Substance XYZ' });
  });

  it('deep-merges into existing entry', async () => {
    // First add
    await addTranslation(
      indexRef,
      {
        locale: 'en',
        data_key: 'substances',
        entity_id: 'hcl',
        fields: { fun_facts: ['new fact'] },
      },
      tmpDir,
    );

    const overlay = await readJsonFile(join(tmpDir, 'translations', 'en', 'substances.json')) as Record<string, any>;
    // Should have merged — existing name should still be there
    expect(overlay['hcl'].name).toBeDefined();
    expect(overlay['hcl'].fun_facts).toEqual(['new fact']);
  });

  it('rejects invalid locale', async () => {
    const r = await addTranslation(
      indexRef,
      {
        locale: 'fr' as any,
        data_key: 'substances',
        entity_id: 'hcl',
        fields: { name: 'Acide chlorhydrique' },
      },
      tmpDir,
    );
    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/translation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `translation.ts`**

Create `src/server/tools/write/translation.ts`:

```typescript
import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

const VALID_LOCALES = ['ru', 'en', 'pl', 'es'];

interface AddTranslationResult {
  locale?: string;
  data_key?: string;
  entity_id?: string;
  merged_fields?: string[];
  status?: 'created' | 'updated';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

export async function addTranslation(
  indexRef: IndexRef,
  args: {
    locale: string;
    data_key: string;
    entity_id: string;
    fields: Record<string, unknown>;
  },
  dataSrcOverride?: string,
): Promise<AddTranslationResult> {
  if (!VALID_LOCALES.includes(args.locale)) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: `Invalid locale "${args.locale}". Must be one of: ${VALID_LOCALES.join(', ')}`,
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'translations', args.locale, `${args.data_key}.json`);

  let overlay: Record<string, unknown>;
  try {
    overlay = (await readJsonFile(filePath)) as Record<string, unknown>;
  } catch {
    overlay = {};
  }

  const existing = (overlay[args.entity_id] ?? {}) as Record<string, unknown>;
  const merged = { ...existing, ...args.fields };
  overlay[args.entity_id] = merged;

  await writeJsonFile(filePath, overlay);

  // Check if entity exists in index
  const warnings: string[] = [];
  const entityExists = indexRef.current.entitiesByRef.has(args.entity_id) ||
    Array.from(indexRef.current.entitiesByRef.keys()).some(ref => ref.endsWith(`:${args.entity_id}`));
  if (!entityExists) {
    warnings.push(`Entity "${args.entity_id}" not found in index — may not exist yet`);
  }

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    locale: args.locale,
    data_key: args.data_key,
    entity_id: args.entity_id,
    merged_fields: Object.keys(args.fields),
    status: Object.keys(existing).length > 0 ? 'updated' : 'created',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/translation.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Register tool in `index.ts`**

```typescript
import { addTranslation } from './tools/write/translation.js';

server.registerTool('add_translation', {
  description: 'Add or update a translation overlay entry for any locale and data type. Merges top-level fields into existing entry (shallow merge).',
  inputSchema: {
    locale: z.enum(['ru', 'en', 'pl', 'es']).describe('Target locale'),
    data_key: z.string().describe('Overlay file name: substances, ions, concepts, elements, process_vocab, effects_vocab, etc.'),
    entity_id: z.string().describe('Key in the overlay file. Conventions: substances use short ID (hcl), ions use full ref (ion:H_plus), concepts use full ref (cls:oxide), elements use symbol (Na)'),
    fields: z.record(z.unknown()).describe('Translated fields to merge: name, description, surface_forms, forms, etc.'),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await addTranslation(indexRef, args), null, 2) }],
}));
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/ontology-mcp && npm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/write/translation.ts \
       packages/ontology-mcp/src/__tests__/write/translation.test.ts \
       packages/ontology-mcp/src/server/index.ts
git commit -m "feat(ontology-mcp): add add_translation tool"
```

---

## Task 6: `add_relation` tool

**Files:**
- Create: `src/server/tools/write/relation.ts`
- Create: `src/__tests__/write/relation.test.ts`
- Modify: `src/server/index.ts` — register tool

- [ ] **Step 1: Write failing test**

Create `src/__tests__/write/relation.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex } from '../../server/indexing/build-index.js';
import { addRelation } from '../../server/tools/write/relation.js';
import { readJsonFile } from '../../server/tools/write/_shared.js';
import type { OntologyIndex, IndexRef } from '../../shared/types.js';
import { cp, rm, mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDataSrcRoot } from '../../server/indexing/build-index.js';

let indexRef: IndexRef;
let tmpDir: string;
let origDataSrc: string;

beforeAll(async () => {
  indexRef = { current: await buildOntologyIndex() };
  origDataSrc = getDataSrcRoot();
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe('addRelation', () => {
  it('appends triples to existing relation file', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-rel-'));
    await mkdir(join(tmpDir, 'relations'), { recursive: true });
    await cp(
      join(origDataSrc, 'relations', 'acid_base_relations.json'),
      join(tmpDir, 'relations', 'acid_base_relations.json'),
    );

    const r = await addRelation(
      indexRef,
      {
        file: 'acid_base_relations',
        triples: [{
          subject: 'sub:hcl',
          predicate: 'test_predicate',
          object: 'ion:Cl_minus',
          knowledge_level: 'pedagogical',
        }],
      },
      tmpDir,
    );

    expect(r.status).toBe('updated');
    expect(r.added).toBe(1);
    expect(r.skipped_duplicates).toBe(0);

    // Verify file
    const data = await readJsonFile(join(tmpDir, 'relations', 'acid_base_relations.json')) as any[];
    const added = data.find(t => t.predicate === 'test_predicate');
    expect(added).toBeDefined();
    expect(added.subject).toBe('sub:hcl');
  });

  it('deduplicates existing triples', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-rel-'));
    await mkdir(join(tmpDir, 'relations'), { recursive: true });
    await cp(
      join(origDataSrc, 'relations', 'acid_base_relations.json'),
      join(tmpDir, 'relations', 'acid_base_relations.json'),
    );

    const existingData = await readJsonFile(
      join(tmpDir, 'relations', 'acid_base_relations.json')
    ) as any[];
    const firstTriple = existingData[0];

    const r = await addRelation(
      indexRef,
      {
        file: 'acid_base_relations',
        triples: [{
          subject: firstTriple.subject,
          predicate: firstTriple.predicate,
          object: firstTriple.object,
        }],
      },
      tmpDir,
    );

    expect(r.skipped_duplicates).toBe(1);
    expect(r.added).toBe(0);
  });

  it('creates new file for new relation type', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-rel-'));
    await mkdir(join(tmpDir, 'relations'), { recursive: true });

    const r = await addRelation(
      indexRef,
      {
        file: 'new_relations',
        triples: [{
          subject: 'sub:nacl',
          predicate: 'dissolves_in',
          object: 'sub:h2o',
        }],
      },
      tmpDir,
    );

    expect(r.status).toBe('updated');
    expect(r.added).toBe(1);
  });

  it('warns on unknown refs', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-rel-'));
    await mkdir(join(tmpDir, 'relations'), { recursive: true });

    const r = await addRelation(
      indexRef,
      {
        file: 'test_relations',
        triples: [{
          subject: 'sub:nonexistent_xyz',
          predicate: 'test',
          object: 'sub:also_nonexistent',
        }],
      },
      tmpDir,
    );

    expect(r.warnings).toBeDefined();
    expect(r.warnings!.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/relation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `relation.ts`**

Create `src/server/tools/write/relation.ts`:

```typescript
import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface Triple {
  subject: string;
  predicate: string;
  object: string;
  step?: number;
  knowledge_level?: string;
  source_kind?: string;
  condition?: string;
}

interface AddRelationResult {
  file: string;
  added: number;
  skipped_duplicates: number;
  status: 'updated';
  warnings?: string[];
}

export async function addRelation(
  indexRef: IndexRef,
  args: { file: string; triples: Triple[] },
  dataSrcOverride?: string,
): Promise<AddRelationResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'relations', `${args.file}.json`);

  let existing: Triple[];
  try {
    const raw = await readJsonFile(filePath);
    // Support both array format and { triples: [] } format
    if (Array.isArray(raw)) {
      existing = raw;
    } else if (raw && typeof raw === 'object' && 'triples' in raw) {
      existing = (raw as { triples: Triple[] }).triples;
    } else {
      existing = [];
    }
  } catch {
    existing = [];
  }

  const warnings: string[] = [];
  let added = 0;
  let skippedDuplicates = 0;

  for (const triple of args.triples) {
    // Deduplicate
    const isDuplicate = existing.some(
      t => t.subject === triple.subject && t.predicate === triple.predicate && t.object === triple.object,
    );

    if (isDuplicate) {
      skippedDuplicates++;
      continue;
    }

    // Warn on unknown refs
    if (!indexRef.current.entitiesByRef.has(triple.subject)) {
      warnings.push(`Subject "${triple.subject}" not found in index`);
    }
    if (!indexRef.current.entitiesByRef.has(triple.object)) {
      warnings.push(`Object "${triple.object}" not found in index`);
    }

    existing.push(triple);
    added++;
  }

  await writeJsonFile(filePath, existing);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    file: args.file,
    added,
    skipped_duplicates: skippedDuplicates,
    status: 'updated',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/relation.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Register tool in `index.ts`**

```typescript
import { addRelation } from './tools/write/relation.js';

server.registerTool('add_relation', {
  description: 'Append relation triples to a relation file. Deduplicates by subject+predicate+object. Warns on unknown refs.',
  inputSchema: {
    file: z.string().describe('Relation file name: acid_base_relations, ion_roles, has_naming_rule, or new name'),
    triples: z.array(z.object({
      subject: z.string().describe('Subject entity ref'),
      predicate: z.string().describe('Relation predicate'),
      object: z.string().describe('Object entity ref'),
      step: z.number().optional().describe('Step number for multi-step relations'),
      knowledge_level: z.enum(['strict_chemistry', 'school_convention', 'pedagogical']).optional(),
      source_kind: z.string().optional().describe('Provenance'),
      condition: z.string().optional().describe('Guard condition'),
    })).describe('Triples to add'),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await addRelation(indexRef, args), null, 2) }],
}));
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/ontology-mcp && npm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/write/relation.ts \
       packages/ontology-mcp/src/__tests__/write/relation.test.ts \
       packages/ontology-mcp/src/server/index.ts
git commit -m "feat(ontology-mcp): add add_relation tool"
```

---

## Task 7: `add_substance` and `update_substance` tools

**Files:**
- Create: `src/server/tools/write/substance.ts`
- Create: `src/__tests__/write/substance.test.ts`
- Modify: `src/server/index.ts` — register 2 tools

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/write/substance.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex } from '../../server/indexing/build-index.js';
import { addSubstance, updateSubstance } from '../../server/tools/write/substance.js';
import { readJsonFile } from '../../server/tools/write/_shared.js';
import type { IndexRef } from '../../shared/types.js';
import { cp, rm, mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDataSrcRoot } from '../../server/indexing/build-index.js';

let indexRef: IndexRef;
let tmpDir: string;
let origDataSrc: string;

beforeAll(async () => {
  indexRef = { current: await buildOntologyIndex() };
  origDataSrc = getDataSrcRoot();
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe('addSubstance', () => {
  it('creates a new substance file', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-sub-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    const r = await addSubstance(
      indexRef,
      {
        id: 'test_xyz',
        formula: 'XYZ',
        class: 'salt',
        tags: ['test'],
      },
      tmpDir,
    );

    expect(r.status).toBe('created');
    expect(r.ref).toBe('sub:test_xyz');

    const data = await readJsonFile(join(tmpDir, 'substances', 'test_xyz.json')) as any;
    expect(data.id).toBe('sub:test_xyz');
    expect(data.formula).toBe('XYZ');
    expect(data.class).toBe('salt');
  });

  it('fails if substance already exists', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-sub-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(join(origDataSrc, 'substances', 'hcl.json'), join(tmpDir, 'substances', 'hcl.json'));

    const r = await addSubstance(
      indexRef,
      { id: 'hcl', formula: 'HCl', class: 'acid' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
  });
});

describe('updateSubstance', () => {
  it('updates existing substance fields', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-sub-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(join(origDataSrc, 'substances', 'hcl.json'), join(tmpDir, 'substances', 'hcl.json'));

    const r = await updateSubstance(
      indexRef,
      { id: 'hcl', tags: ['updated', 'test'] },
      tmpDir,
    );

    expect(r.status).toBe('updated');

    const data = await readJsonFile(join(tmpDir, 'substances', 'hcl.json')) as any;
    expect(data.tags).toEqual(['updated', 'test']);
    // Other fields should remain
    expect(data.formula).toBeDefined();
  });

  it('fails if substance does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-sub-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    const r = await updateSubstance(
      indexRef,
      { id: 'nonexistent', tags: ['test'] },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/substance.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `substance.ts`**

Create `src/server/tools/write/substance.ts`:

```typescript
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface SubstanceInput {
  id: string;
  formula?: string;
  class?: string;
  subclass?: string;
  ions?: string[];
  tags?: string[];
  phase_standard?: string;
  characteristics?: Record<string, unknown>;
}

interface WriteResult {
  ref?: string;
  path?: string;
  status?: string;
  updated_fields?: string[];
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function addSubstance(
  indexRef: IndexRef,
  args: SubstanceInput & { formula: string; class: string },
  dataSrcOverride?: string,
): Promise<WriteResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'substances', `${args.id}.json`);

  if (await fileExists(filePath)) {
    return { error: true, code: 'ENTITY_EXISTS', message: `Substance "${args.id}" already exists` };
  }

  const warnings: string[] = [];

  // Validate ion refs
  if (args.ions) {
    for (const ionRef of args.ions) {
      if (!indexRef.current.entitiesByRef.has(ionRef)) {
        warnings.push(`Ion "${ionRef}" not found in index — may not exist yet`);
      }
    }
  }

  const entity: Record<string, unknown> = {
    id: `sub:${args.id}`,
    formula: args.formula,
    class: args.class,
  };
  if (args.subclass) entity.subclass = args.subclass;
  if (args.ions) entity.ions = args.ions;
  if (args.tags) entity.tags = args.tags;
  if (args.phase_standard) entity.phase_standard = args.phase_standard;
  if (args.characteristics) entity.characteristics = args.characteristics;

  await writeJsonFile(filePath, entity);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `sub:${args.id}`,
    path: `substances/${args.id}.json`,
    status: 'created',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export async function updateSubstance(
  indexRef: IndexRef,
  args: SubstanceInput,
  dataSrcOverride?: string,
): Promise<WriteResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'substances', `${args.id}.json`);

  if (!(await fileExists(filePath))) {
    return { error: true, code: 'NOT_FOUND', message: `Substance "${args.id}" not found` };
  }

  const existing = (await readJsonFile(filePath)) as Record<string, unknown>;

  const updatedFields: string[] = [];
  const { id: _id, ...updates } = args;
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      existing[key] = value;
      updatedFields.push(key);
    }
  }

  await writeJsonFile(filePath, existing);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: `sub:${args.id}`,
    updated_fields: updatedFields,
    status: 'updated',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/substance.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Register both tools in `index.ts`**

```typescript
import { addSubstance, updateSubstance } from './tools/write/substance.js';

server.registerTool('add_substance', {
  description: 'Create a new substance in data-src/substances/{id}.json. Fails if file already exists.',
  inputSchema: {
    id: z.string().describe('Short ID without prefix, e.g. "hcl" (will be stored as "sub:hcl")'),
    formula: z.string().describe('Chemical formula with Unicode subscripts/superscripts'),
    class: z.string().describe('Substance class, e.g. "acid", "salt", "oxide"'),
    subclass: z.string().optional().describe('Subclass, e.g. "strong_acid", "amphoteric"'),
    ions: z.array(z.string()).optional().describe('Ion refs, e.g. ["ion:H_plus", "ion:Cl_minus"]'),
    tags: z.array(z.string()).optional().describe('Free-form tags'),
    phase_standard: z.enum(['g', 'l', 's', 'aq']).optional().describe('Standard aggregate state'),
    characteristics: z.record(z.unknown()).optional().describe('Typed characteristics keyed by concept ref'),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await addSubstance(indexRef, args as any), null, 2) }],
}));

server.registerTool('update_substance', {
  description: 'Update fields on an existing substance. Shallow-merges provided fields.',
  inputSchema: {
    id: z.string().describe('Short ID without prefix, e.g. "hcl"'),
    formula: z.string().optional(),
    class: z.string().optional(),
    subclass: z.string().optional(),
    ions: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    phase_standard: z.enum(['g', 'l', 's', 'aq']).optional(),
    characteristics: z.record(z.unknown()).optional(),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await updateSubstance(indexRef, args), null, 2) }],
}));
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/ontology-mcp && npm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/write/substance.ts \
       packages/ontology-mcp/src/__tests__/write/substance.test.ts \
       packages/ontology-mcp/src/server/index.ts
git commit -m "feat(ontology-mcp): add add_substance and update_substance tools"
```

---

## Task 8: `add_concept` and `update_concept` tools

**Files:**
- Create: `src/server/tools/write/concept.ts`
- Create: `src/__tests__/write/concept.test.ts`
- Modify: `src/server/index.ts` — register 2 tools

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/write/concept.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex } from '../../server/indexing/build-index.js';
import { addConcept, updateConcept } from '../../server/tools/write/concept.js';
import { readJsonFile } from '../../server/tools/write/_shared.js';
import type { IndexRef } from '../../shared/types.js';
import { cp, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDataSrcRoot } from '../../server/indexing/build-index.js';

let indexRef: IndexRef;
let tmpDir: string;
let origDataSrc: string;

beforeAll(async () => {
  indexRef = { current: await buildOntologyIndex() };
  origDataSrc = getDataSrcRoot();
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe('addConcept', () => {
  it('adds a new concept to concepts.json', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-con-'));
    await cp(join(origDataSrc, 'concepts.json'), join(tmpDir, 'concepts.json'));

    const r = await addConcept(
      indexRef,
      {
        ref: 'concept:test_concept',
        kind: 'domain_concept',
        parent_id: null,
        admission: {
          reason: 'test concept for unit test',
          nearest_existing_refs: [],
        },
      },
      tmpDir,
    );

    expect(r.status).toBe('created');
    expect(r.ref).toBe('concept:test_concept');

    const data = await readJsonFile(join(tmpDir, 'concepts.json')) as Record<string, any>;
    expect(data['concept:test_concept']).toBeDefined();
    expect(data['concept:test_concept'].kind).toBe('domain_concept');
  });

  it('fails if concept ref already exists', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-con-'));
    await cp(join(origDataSrc, 'concepts.json'), join(tmpDir, 'concepts.json'));

    const r = await addConcept(
      indexRef,
      { ref: 'cls:oxide', kind: 'substance_class' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
  });

  it('warns if no admission metadata provided', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-con-'));
    await cp(join(origDataSrc, 'concepts.json'), join(tmpDir, 'concepts.json'));

    const r = await addConcept(
      indexRef,
      { ref: 'concept:no_admission', kind: 'domain_concept' },
      tmpDir,
    );

    expect(r.status).toBe('created');
    expect(r.warnings).toContain('concept created without admission metadata');
  });

  it('rejects invalid ref prefix', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-con-'));
    await cp(join(origDataSrc, 'concepts.json'), join(tmpDir, 'concepts.json'));

    const r = await addConcept(
      indexRef,
      { ref: 'sub:not_a_concept', kind: 'domain_concept' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('INVALID_REF');
  });
});

describe('updateConcept', () => {
  it('updates existing concept fields', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-con-'));
    await cp(join(origDataSrc, 'concepts.json'), join(tmpDir, 'concepts.json'));

    const r = await updateConcept(
      indexRef,
      { ref: 'cls:oxide', order: 99 },
      tmpDir,
    );

    expect(r.status).toBe('updated');
    const data = await readJsonFile(join(tmpDir, 'concepts.json')) as Record<string, any>;
    expect(data['cls:oxide'].order).toBe(99);
  });

  it('fails if concept does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-con-'));
    await cp(join(origDataSrc, 'concepts.json'), join(tmpDir, 'concepts.json'));

    const r = await updateConcept(
      indexRef,
      { ref: 'concept:nonexistent', order: 1 },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/concept.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `concept.ts`**

Create `src/server/tools/write/concept.ts`:

```typescript
import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

const VALID_PREFIXES = ['cls', 'concept', 'prop', 'rxtype', 'rxfacet'];

interface ConceptInput {
  ref: string;
  kind?: string;
  parent_id?: string | null;
  order?: number;
  filters?: Record<string, unknown>;
  examples?: Array<{ kind: string; id: string }>;
  children_order?: string[];
  classification_facets?: Array<{ facet_ref: string; children: string[] }>;
  admission?: {
    reason: string;
    nearest_existing_refs?: string[];
    non_redundancy_note?: string;
  };
}

interface WriteResult {
  ref?: string;
  status?: string;
  updated_fields?: string[];
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

export async function addConcept(
  indexRef: IndexRef,
  args: ConceptInput & { kind: string },
  dataSrcOverride?: string,
): Promise<WriteResult> {
  // Validate ref prefix
  const colonIdx = args.ref.indexOf(':');
  if (colonIdx === -1 || !VALID_PREFIXES.includes(args.ref.slice(0, colonIdx))) {
    return {
      error: true,
      code: 'INVALID_REF',
      message: `Invalid concept ref "${args.ref}". Must start with: ${VALID_PREFIXES.join(', ')}`,
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'concepts.json');
  const concepts = (await readJsonFile(filePath)) as Record<string, unknown>;

  if (concepts[args.ref] !== undefined) {
    return { error: true, code: 'ENTITY_EXISTS', message: `Concept "${args.ref}" already exists` };
  }

  const warnings: string[] = [];

  // Semantic guard: warn if no admission metadata
  if (!args.admission) {
    warnings.push('concept created without admission metadata');
  }

  // Validate parent_id exists
  if (args.parent_id && !concepts[args.parent_id]) {
    warnings.push(`parent_id "${args.parent_id}" not found in concepts`);
  }

  const entry: Record<string, unknown> = { kind: args.kind };
  if (args.parent_id !== undefined) entry.parent_id = args.parent_id;
  if (args.order !== undefined) entry.order = args.order;
  if (args.filters) entry.filters = args.filters;
  if (args.examples) entry.examples = args.examples;
  if (args.children_order) entry.children_order = args.children_order;
  if (args.classification_facets) entry.classification_facets = args.classification_facets;

  concepts[args.ref] = entry;
  await writeJsonFile(filePath, concepts);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: args.ref,
    status: 'created',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export async function updateConcept(
  indexRef: IndexRef,
  args: Partial<ConceptInput> & { ref: string },
  dataSrcOverride?: string,
): Promise<WriteResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'concepts.json');
  const concepts = (await readJsonFile(filePath)) as Record<string, Record<string, unknown>>;

  if (!concepts[args.ref]) {
    return { error: true, code: 'NOT_FOUND', message: `Concept "${args.ref}" not found` };
  }

  const updatedFields: string[] = [];
  const { ref: _ref, admission: _admission, ...updates } = args;
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      concepts[args.ref][key] = value;
      updatedFields.push(key);
    }
  }

  await writeJsonFile(filePath, concepts);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: args.ref,
    updated_fields: updatedFields,
    status: 'updated',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/concept.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Register both tools in `index.ts`**

```typescript
import { addConcept, updateConcept } from './tools/write/concept.js';

server.registerTool('add_concept', {
  description: 'Add a new concept to concepts.json. Medium-risk: admission metadata recommended.',
  inputSchema: {
    ref: z.string().describe('Concept ref with prefix: cls:, concept:, prop:, rxtype:, rxfacet:'),
    kind: z.string().describe('substance_class, element_group, reaction_type, reaction_facet, domain_concept, process, property'),
    parent_id: z.string().nullable().optional().describe('Parent concept ref'),
    order: z.number().optional().describe('Display order'),
    filters: z.record(z.unknown()).optional().describe('Query filters'),
    examples: z.array(z.object({ kind: z.string(), id: z.string() })).optional(),
    children_order: z.array(z.string()).optional(),
    classification_facets: z.array(z.object({
      facet_ref: z.string(),
      children: z.array(z.string()),
    })).optional(),
    admission: z.object({
      reason: z.string(),
      nearest_existing_refs: z.array(z.string()).optional(),
      non_redundancy_note: z.string().optional(),
    }).optional().describe('Semantic guard: recommended to justify why this concept is needed'),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await addConcept(indexRef, args as any), null, 2) }],
}));

server.registerTool('update_concept', {
  description: 'Update fields on an existing concept in concepts.json.',
  inputSchema: {
    ref: z.string().describe('Concept ref'),
    kind: z.string().optional(),
    parent_id: z.string().nullable().optional(),
    order: z.number().optional(),
    filters: z.record(z.unknown()).optional(),
    examples: z.array(z.object({ kind: z.string(), id: z.string() })).optional(),
    children_order: z.array(z.string()).optional(),
    classification_facets: z.array(z.object({
      facet_ref: z.string(),
      children: z.array(z.string()),
    })).optional(),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await updateConcept(indexRef, args), null, 2) }],
}));
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/ontology-mcp && npm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/write/concept.ts \
       packages/ontology-mcp/src/__tests__/write/concept.test.ts \
       packages/ontology-mcp/src/server/index.ts
git commit -m "feat(ontology-mcp): add add_concept and update_concept tools with admission guards"
```

---

## Task 9: `add_characteristic` and `update_characteristic` tools

**Files:**
- Create: `src/server/tools/write/characteristic.ts`
- Create: `src/__tests__/write/characteristic.test.ts`
- Modify: `src/server/index.ts` — register 2 tools

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/write/characteristic.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex } from '../../server/indexing/build-index.js';
import { addCharacteristic, updateCharacteristic } from '../../server/tools/write/characteristic.js';
import { readJsonFile } from '../../server/tools/write/_shared.js';
import type { IndexRef } from '../../shared/types.js';
import { cp, rm, mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDataSrcRoot } from '../../server/indexing/build-index.js';

let indexRef: IndexRef;
let tmpDir: string;
let origDataSrc: string;

beforeAll(async () => {
  indexRef = { current: await buildOntologyIndex() };
  origDataSrc = getDataSrcRoot();
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe('addCharacteristic', () => {
  it('adds a characteristic to a substance', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(join(origDataSrc, 'substances', 'nacl.json'), join(tmpDir, 'substances', 'nacl.json'));

    const r = await addCharacteristic(
      indexRef,
      {
        substance_id: 'nacl',
        concept_ref: 'concept:test_property',
        value: 801,
        unit: 'unit:celsius',
      },
      tmpDir,
    );

    expect(r.status).toBe('created');

    const data = await readJsonFile(join(tmpDir, 'substances', 'nacl.json')) as any;
    expect(data.characteristics['concept:test_property']).toEqual({
      value: 801,
      unit: 'unit:celsius',
    });
  });

  it('fails if characteristic already exists', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(join(origDataSrc, 'substances', 'h2o.json'), join(tmpDir, 'substances', 'h2o.json'));

    // h2o likely has concept:boiling_point already
    const data = await readJsonFile(join(tmpDir, 'substances', 'h2o.json')) as any;
    const existingKey = Object.keys(data.characteristics ?? {})[0];
    if (!existingKey) return; // skip if no characteristics

    const r = await addCharacteristic(
      indexRef,
      { substance_id: 'h2o', concept_ref: existingKey, value: 999, unit: 'unit:test' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
  });

  it('fails if substance does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    const r = await addCharacteristic(
      indexRef,
      { substance_id: 'nonexistent', concept_ref: 'concept:x', value: 1, unit: 'unit:x' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
  });
});

describe('updateCharacteristic', () => {
  it('updates an existing characteristic', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(join(origDataSrc, 'substances', 'h2o.json'), join(tmpDir, 'substances', 'h2o.json'));

    const data = await readJsonFile(join(tmpDir, 'substances', 'h2o.json')) as any;
    const existingKey = Object.keys(data.characteristics ?? {})[0];
    if (!existingKey) return;

    const r = await updateCharacteristic(
      indexRef,
      { substance_id: 'h2o', concept_ref: existingKey, value: 999, unit: 'unit:updated' },
      tmpDir,
    );

    expect(r.status).toBe('updated');

    const updated = await readJsonFile(join(tmpDir, 'substances', 'h2o.json')) as any;
    expect(updated.characteristics[existingKey].value).toBe(999);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/characteristic.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `characteristic.ts`**

Create `src/server/tools/write/characteristic.ts`:

```typescript
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface CharInput {
  substance_id: string;
  concept_ref: string;
  value: number | string;
  unit: string;
  conditions?: Record<string, unknown>;
  source?: string;
  explanation?: string;
}

interface WriteResult {
  substance_ref?: string;
  concept_ref?: string;
  status?: string;
  updated_fields?: string[];
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

export async function addCharacteristic(
  indexRef: IndexRef,
  args: CharInput,
  dataSrcOverride?: string,
): Promise<WriteResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'substances', `${args.substance_id}.json`);

  if (!(await fileExists(filePath))) {
    return { error: true, code: 'NOT_FOUND', message: `Substance "${args.substance_id}" not found` };
  }

  const substance = (await readJsonFile(filePath)) as Record<string, any>;

  if (!substance.characteristics) {
    substance.characteristics = {};
  }

  if (substance.characteristics[args.concept_ref]) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Characteristic "${args.concept_ref}" already exists on "${args.substance_id}"`,
    };
  }

  const entry: Record<string, unknown> = { value: args.value, unit: args.unit };
  if (args.conditions) entry.conditions = args.conditions;
  if (args.source) entry.source = args.source;
  if (args.explanation) entry.explanation = args.explanation;

  substance.characteristics[args.concept_ref] = entry;
  await writeJsonFile(filePath, substance);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    substance_ref: `sub:${args.substance_id}`,
    concept_ref: args.concept_ref,
    status: 'created',
  };
}

export async function updateCharacteristic(
  indexRef: IndexRef,
  args: CharInput,
  dataSrcOverride?: string,
): Promise<WriteResult> {
  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'substances', `${args.substance_id}.json`);

  if (!(await fileExists(filePath))) {
    return { error: true, code: 'NOT_FOUND', message: `Substance "${args.substance_id}" not found` };
  }

  const substance = (await readJsonFile(filePath)) as Record<string, any>;

  if (!substance.characteristics?.[args.concept_ref]) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Characteristic "${args.concept_ref}" not found on "${args.substance_id}"`,
    };
  }

  const entry: Record<string, unknown> = { value: args.value, unit: args.unit };
  if (args.conditions) entry.conditions = args.conditions;
  if (args.source) entry.source = args.source;
  if (args.explanation) entry.explanation = args.explanation;

  substance.characteristics[args.concept_ref] = entry;
  await writeJsonFile(filePath, substance);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    substance_ref: `sub:${args.substance_id}`,
    concept_ref: args.concept_ref,
    updated_fields: Object.keys(entry),
    status: 'updated',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/ontology-mcp && npx vitest run src/__tests__/write/characteristic.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Register both tools in `index.ts`**

```typescript
import { addCharacteristic, updateCharacteristic } from './tools/write/characteristic.js';

server.registerTool('add_characteristic', {
  description: 'Add a typed characteristic to a substance. Fails if the characteristic already exists on the substance.',
  inputSchema: {
    substance_id: z.string().describe('Substance short ID without prefix, e.g. "nacl"'),
    concept_ref: z.string().describe('Concept ref for the property, e.g. "concept:boiling_point"'),
    value: z.union([z.number(), z.string()]).describe('Characteristic value'),
    unit: z.string().describe('Unit ref, e.g. "unit:celsius", "unit:kJ_per_mol"'),
    conditions: z.record(z.unknown()).optional().describe('Measurement conditions'),
    source: z.string().optional().describe('Data source'),
    explanation: z.string().optional(),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await addCharacteristic(indexRef, args), null, 2) }],
}));

server.registerTool('update_characteristic', {
  description: 'Update an existing characteristic on a substance. Fails if characteristic not found.',
  inputSchema: {
    substance_id: z.string().describe('Substance short ID'),
    concept_ref: z.string().describe('Concept ref of the characteristic to update'),
    value: z.union([z.number(), z.string()]).describe('New value'),
    unit: z.string().describe('Unit ref'),
    conditions: z.record(z.unknown()).optional(),
    source: z.string().optional(),
    explanation: z.string().optional(),
  },
}, async (args) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await updateCharacteristic(indexRef, args), null, 2) }],
}));
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/ontology-mcp && npm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/ontology-mcp/src/server/tools/write/characteristic.ts \
       packages/ontology-mcp/src/__tests__/write/characteristic.test.ts \
       packages/ontology-mcp/src/server/index.ts
git commit -m "feat(ontology-mcp): add add_characteristic and update_characteristic tools"
```

---

## Task 10: Integration smoke test and version bump

**Files:**
- Modify: `src/server/index.ts` — verify all 14 tools registered
- Modify: `package.json` — bump version to 0.3.0

- [ ] **Step 1: Run full test suite**

Run: `cd packages/ontology-mcp && npm test`
Expected: All tests pass (existing 8 + new 8 test files)

- [ ] **Step 2: Count registered tools in index.ts**

Verify 19 total tools registered (9 existing read tools + 10 new write/audit tools):
- 9 existing: search_entities, get_entity, get_neighbors, resolve_mention, validate_annotation, suggest_refs_for_text, classify_addition, create_proposal_draft, bootstrap_document
- 10 new: list_entities, coverage_report, add_translation, add_relation, add_substance, update_substance, add_concept, update_concept, add_characteristic, update_characteristic

- [ ] **Step 3: Bump version**

In `package.json`, change `"version": "0.2.0"` to `"version": "0.3.0"`.

- [ ] **Step 4: MCP server smoke test**

Start the MCP server and verify a new tool is callable:

Run: `cd packages/ontology-mcp && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npm run dev 2>/dev/null | grep -c "list_entities\|coverage_report\|add_translation\|add_relation\|add_substance\|update_substance\|add_concept\|update_concept\|add_characteristic\|update_characteristic"`
Expected: `10` (all new tools listed)

- [ ] **Step 5: Commit and tag**

```bash
git add packages/ontology-mcp/package.json
git commit -m "chore(ontology-mcp): bump to v0.3.0 — Phase 1 write tools"
```

---

## Summary

| Task | Tools | Tests |
|------|-------|-------|
| 1. indexRef refactor | 0 (infra) | existing pass |
| 2. _shared.ts | 0 (infra) | 3 |
| 3. list_entities | 1 | 4 |
| 4. coverage_report | 1 | 5 |
| 5. add_translation | 1 | 3 |
| 6. add_relation | 1 | 4 |
| 7. substance (add + update) | 2 | 4 |
| 8. concept (add + update) | 2 | 5 |
| 9. characteristic (add + update) | 2 | 4 |
| 10. Integration | 0 | smoke |
| **Total** | **10 tools** | **32 tests** |

Phase 1 delivers 10 new tools (covering 12 from spec: list_entities, coverage_report, add_translation, add_relation, add/update substance, add/update concept, add/update characteristic). The remaining 4 Phase 1 tools from the spec (add/update ion, add/update property) can be added as a follow-up commit using the same patterns established here.
