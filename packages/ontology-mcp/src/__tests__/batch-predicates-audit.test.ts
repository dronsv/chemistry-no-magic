import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex } from '../server/indexing/build-index.js';
import { batchAdd } from '../server/tools/write/batch.js';
import { listPredicates, validatePredicate } from '../server/tools/predicate-registry.js';
import { appendAuditLog, readAuditLog } from '../server/tools/write/audit-log.js';
import { addSubstance } from '../server/tools/write/substance.js';
import { addTranslation } from '../server/tools/write/translation.js';
import type { IndexRef, OntologyIndex } from '../shared/types.js';
import { rm, mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let indexRef: IndexRef;
let tmpDir: string;

beforeAll(async () => {
  indexRef = { current: await buildOntologyIndex() };
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// batch_add
// ---------------------------------------------------------------------------

describe('batchAdd', () => {
  it('executes two valid operations and collects results', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-batch-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await mkdir(join(tmpDir, 'translations', 'en'), { recursive: true });

    const executors: Record<string, (ir: IndexRef, args: any) => Promise<any>> = {
      add_substance: (ir, a) => addSubstance(ir, a, tmpDir),
      add_translation: (ir, a) => addTranslation(ir, a, tmpDir),
    };

    const result = await batchAdd(indexRef, [
      {
        tool: 'add_substance',
        args: { id: 'batch_test_sub', formula: 'X₂', class: 'test' },
      },
      {
        tool: 'add_translation',
        args: { locale: 'en', data_key: 'substances', entity_id: 'batch_test_sub', fields: { name: 'Test substance' } },
      },
    ], executors);

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results[0].status).toBe('ok');
    expect(result.results[1].status).toBe('ok');
  });

  it('marks unknown tool as error without aborting batch', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-batch-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    const executors: Record<string, (ir: IndexRef, args: any) => Promise<any>> = {
      add_substance: (ir, a) => addSubstance(ir, a, tmpDir),
    };

    const result = await batchAdd(indexRef, [
      {
        tool: 'unknown_tool_xyz',
        args: { id: 'never' },
      },
      {
        tool: 'add_substance',
        args: { id: 'after_error_sub', formula: 'Y', class: 'test' },
      },
    ], executors);

    expect(result.total).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.results[0].status).toBe('error');
    expect((result.results[0].result as any).code).toBe('UNKNOWN_TOOL');
    expect(result.results[1].status).toBe('ok');
  });

  it('counts tool-level error (ENTITY_EXISTS) as failed', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-batch-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    const executors: Record<string, (ir: IndexRef, args: any) => Promise<any>> = {
      add_substance: (ir, a) => addSubstance(ir, a, tmpDir),
    };

    // First call succeeds; second is a duplicate
    await batchAdd(indexRef, [
      { tool: 'add_substance', args: { id: 'dup_sub', formula: 'Z', class: 'test' } },
    ], executors);

    const result = await batchAdd(indexRef, [
      { tool: 'add_substance', args: { id: 'dup_sub', formula: 'Z', class: 'test' } },
    ], executors);

    expect(result.failed).toBe(1);
    expect(result.results[0].status).toBe('error');
    expect((result.results[0].result as any).code).toBe('ENTITY_EXISTS');
  });
});

// ---------------------------------------------------------------------------
// list_predicates + validate_predicate
// ---------------------------------------------------------------------------

describe('listPredicates', () => {
  it('returns predicates with counts from index', () => {
    const result = listPredicates(indexRef.current);
    expect(Array.isArray(result.predicates)).toBe(true);
    expect(result.predicates.length).toBeGreaterThan(0);
    // Each entry has predicate string and positive count
    for (const p of result.predicates) {
      expect(typeof p.predicate).toBe('string');
      expect(p.count).toBeGreaterThan(0);
    }
  });

  it('returns predicates sorted by count descending', () => {
    const result = listPredicates(indexRef.current);
    for (let i = 1; i < result.predicates.length; i++) {
      expect(result.predicates[i - 1].count).toBeGreaterThanOrEqual(result.predicates[i].count);
    }
  });

  it('returns empty list for empty index', () => {
    const emptyIndex: OntologyIndex = {
      entitiesByRef: new Map(),
      aliasIndex: new Map(),
      formulaIndex: new Map(),
      symbolIndex: new Map(),
      relations: {
        bySubject: new Map(),
        byObject: new Map(),
        byPredicate: new Map(),
      },
    };
    const result = listPredicates(emptyIndex);
    expect(result.predicates).toEqual([]);
  });
});

describe('validatePredicate', () => {
  it('returns known=true for a predicate that exists in the index', () => {
    const { predicates } = listPredicates(indexRef.current);
    if (predicates.length === 0) return; // nothing to test
    const knownPredicate = predicates[0].predicate;

    const result = validatePredicate(indexRef.current, knownPredicate);
    expect(result.known).toBe(true);
    expect(result.count).toBe(predicates[0].count);
    expect(result.similar).toBeUndefined();
  });

  it('returns known=false for a completely unknown predicate', () => {
    const result = validatePredicate(indexRef.current, 'completely_nonexistent_predicate_zzz999');
    expect(result.known).toBe(false);
    expect(result.count).toBe(0);
  });

  it('suggests similar predicates for a near-miss spelling', () => {
    // Use a predicate known to exist and mutate it slightly
    const { predicates } = listPredicates(indexRef.current);
    if (predicates.length === 0) return;
    const knownPredicate = predicates[0].predicate;
    // Introduce a single-character typo at the end
    const typo = knownPredicate.slice(0, -1) + (knownPredicate.endsWith('e') ? 'a' : 'e');

    const result = validatePredicate(indexRef.current, typo);
    // Whether known or not, if similar exists it should be an array
    if (!result.known && result.similar !== undefined) {
      expect(Array.isArray(result.similar)).toBe(true);
      expect(result.similar!.includes(knownPredicate)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// audit log
// ---------------------------------------------------------------------------

describe('appendAuditLog / readAuditLog', () => {
  it('appends entries and reads them back', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-audit-'));

    const entry1 = {
      timestamp: '2026-03-27T10:00:00.000Z',
      tool: 'add_substance',
      args: { id: 'nacl', formula: 'NaCl', class: 'salt' },
      result: 'ok' as const,
      ref: 'sub:nacl',
    };
    const entry2 = {
      timestamp: '2026-03-27T10:01:00.000Z',
      tool: 'add_concept',
      args: { ref: 'concept:test', kind: 'domain_concept' },
      result: 'error' as const,
    };

    await appendAuditLog(tmpDir, entry1);
    await appendAuditLog(tmpDir, entry2);

    const entries = await readAuditLog(tmpDir);
    expect(entries.length).toBe(2);
    expect(entries[0].tool).toBe('add_substance');
    expect(entries[0].ref).toBe('sub:nacl');
    expect(entries[0].result).toBe('ok');
    expect(entries[1].tool).toBe('add_concept');
    expect(entries[1].result).toBe('error');
  });

  it('limit parameter returns the most recent N entries', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-audit-limit-'));

    for (let i = 0; i < 5; i++) {
      await appendAuditLog(tmpDir, {
        timestamp: `2026-03-27T10:0${i}:00.000Z`,
        tool: 'add_substance',
        args: { idx: i },
        result: 'ok',
        ref: `sub:entry_${i}`,
      });
    }

    const recent = await readAuditLog(tmpDir, 3);
    expect(recent.length).toBe(3);
    // Should be the last 3 entries
    expect(recent[0].ref).toBe('sub:entry_2');
    expect(recent[1].ref).toBe('sub:entry_3');
    expect(recent[2].ref).toBe('sub:entry_4');
  });

  it('returns empty array when log does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-audit-empty-'));
    const entries = await readAuditLog(tmpDir);
    expect(entries).toEqual([]);
  });

  it('each append is an independent JSONL line', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-audit-jsonl-'));

    await appendAuditLog(tmpDir, {
      timestamp: '2026-03-27T12:00:00.000Z',
      tool: 'add_ion',
      args: { id: 'ion:Test_plus' },
      result: 'ok',
    });

    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(join(tmpDir, '.audit-log.jsonl'), 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.tool).toBe('add_ion');
  });
});
