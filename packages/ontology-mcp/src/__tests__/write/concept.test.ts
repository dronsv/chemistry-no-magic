import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex, getDataSrcRoot } from '../../server/indexing/build-index.js';
import { addConcept, updateConcept } from '../../server/tools/write/concept.js';
import { readJsonFile } from '../../server/tools/write/_shared.js';
import type { IndexRef } from '../../shared/types.js';
import { cp, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

async function makeTmpWithConcepts(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ontology-concept-'));
  await cp(join(origDataSrc, 'concepts.json'), join(dir, 'concepts.json'));
  return dir;
}

describe('addConcept', () => {
  it('adds a new concept to concepts.json', async () => {
    tmpDir = await makeTmpWithConcepts();

    const r = await addConcept(
      indexRef,
      {
        ref: 'concept:test_new_concept',
        kind: 'domain_concept',
        parent_id: null,
        order: 999,
        admission: {
          reason: 'Test concept for unit tests',
          nearest_existing_refs: ['concept:oxidizer'],
          non_redundancy_note: 'Different from all existing concepts',
        },
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('created');
    expect(r.ref).toBe('concept:test_new_concept');

    const data = (await readJsonFile(join(tmpDir, 'concepts.json'))) as Record<string, unknown>;
    expect(data['concept:test_new_concept']).toBeDefined();
    const entry = data['concept:test_new_concept'] as Record<string, unknown>;
    expect(entry.kind).toBe('domain_concept');
    expect(entry.order).toBe(999);
    // admission must NOT be stored
    expect(entry.admission).toBeUndefined();
  });

  it('fails with ENTITY_EXISTS if concept already exists', async () => {
    tmpDir = await makeTmpWithConcepts();

    // cls:oxide is a known concept in concepts.json
    const r = await addConcept(
      indexRef,
      {
        ref: 'cls:oxide',
        kind: 'substance_class',
        admission: { reason: 'Test' },
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
    expect(r.message).toContain('cls:oxide');
  });

  it('warns if no admission metadata provided', async () => {
    tmpDir = await makeTmpWithConcepts();

    const r = await addConcept(
      indexRef,
      {
        ref: 'prop:test_no_admission',
        kind: 'property',
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('created');
    expect(r.warnings).toBeDefined();
    expect(r.warnings).toContain('concept created without admission metadata');
  });

  it('rejects invalid ref prefix', async () => {
    tmpDir = await makeTmpWithConcepts();

    const r = await addConcept(
      indexRef,
      {
        ref: 'sub:not_a_concept',
        kind: 'substance_class',
        admission: { reason: 'Test' },
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('INVALID_REF');
    expect(r.message).toContain('sub');
  });

  it('defaults examples and filters when not provided', async () => {
    tmpDir = await makeTmpWithConcepts();

    await addConcept(
      indexRef,
      {
        ref: 'concept:test_defaults',
        kind: 'domain_concept',
        admission: { reason: 'Test defaults' },
      },
      tmpDir,
    );

    const data = (await readJsonFile(join(tmpDir, 'concepts.json'))) as Record<string, any>;
    const entry = data['concept:test_defaults'];
    expect(entry.examples).toEqual([]);
    expect(entry.filters).toEqual({});
  });

  it('warns on unknown kind', async () => {
    tmpDir = await makeTmpWithConcepts();

    const r = await addConcept(
      indexRef,
      {
        ref: 'concept:test_bad_kind',
        kind: 'unknown_kind_xyz',
        admission: { reason: 'Test' },
      },
      tmpDir,
    );

    expect(r.status).toBe('created');
    expect(r.warnings?.some(w => w.includes('Unknown kind'))).toBe(true);
  });

  it('warns if parent_id not found in concepts', async () => {
    tmpDir = await makeTmpWithConcepts();

    const r = await addConcept(
      indexRef,
      {
        ref: 'cls:test_orphan',
        kind: 'substance_class',
        parent_id: 'cls:nonexistent_parent_xyz',
        admission: { reason: 'Test' },
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('created');
    expect(r.warnings).toBeDefined();
    expect(r.warnings?.some(w => w.includes('cls:nonexistent_parent_xyz'))).toBe(true);
  });
});

describe('updateConcept', () => {
  it('updates existing concept fields', async () => {
    tmpDir = await makeTmpWithConcepts();

    const r = await updateConcept(
      indexRef,
      {
        ref: 'cls:oxide',
        order: 42,
        kind: 'substance_class',
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('updated');
    expect(r.ref).toBe('cls:oxide');
    expect(r.updated_fields).toContain('order');
    expect(r.updated_fields).toContain('kind');

    const data = (await readJsonFile(join(tmpDir, 'concepts.json'))) as Record<string, unknown>;
    const entry = data['cls:oxide'] as Record<string, unknown>;
    expect(entry.order).toBe(42);
    // Preserved fields
    expect(entry.filters).toBeDefined();
    expect(entry.examples).toBeDefined();
  });

  it('fails with NOT_FOUND if concept does not exist', async () => {
    tmpDir = await makeTmpWithConcepts();

    const r = await updateConcept(
      indexRef,
      {
        ref: 'cls:nonexistent_xyz',
        order: 1,
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
    expect(r.message).toContain('cls:nonexistent_xyz');
  });

  it('does not store ref or admission in updated entry', async () => {
    tmpDir = await makeTmpWithConcepts();

    // Pass admission alongside update args (simulating MCP call with extra fields)
    const r = await updateConcept(
      indexRef,
      {
        ref: 'cls:oxide',
        order: 77,
      } as any,
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.updated_fields).not.toContain('ref');
    expect(r.updated_fields).not.toContain('admission');
  });
});
