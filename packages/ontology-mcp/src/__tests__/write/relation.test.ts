import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex, getDataSrcRoot } from '../../server/indexing/build-index.js';
import { addRelation } from '../../server/tools/write/relation.js';
import { readJsonFile } from '../../server/tools/write/_shared.js';
import type { IndexRef } from '../../shared/types.js';
import { cp, rm, mkdtemp, mkdir } from 'node:fs/promises';
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
