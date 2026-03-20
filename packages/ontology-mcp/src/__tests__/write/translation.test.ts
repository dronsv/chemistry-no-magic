import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';
import { buildOntologyIndex, getDataSrcRoot } from '../../server/indexing/build-index.js';
import { addTranslation } from '../../server/tools/write/translation.js';
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

describe('addTranslation', () => {
  beforeEach(async () => {
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
    expect(r.merged_fields).toEqual(['name']);

    const overlay = (await readJsonFile(
      join(tmpDir, 'translations', 'en', 'substances.json'),
    )) as Record<string, unknown>;
    expect(overlay['test_substance_xyz']).toEqual({ name: 'Test Substance XYZ' });
  });

  it('shallow-merges into existing entry', async () => {
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

    const overlay = (await readJsonFile(
      join(tmpDir, 'translations', 'en', 'substances.json'),
    )) as Record<string, Record<string, unknown>>;
    expect(overlay['hcl'].name).toBeDefined();
    expect(overlay['hcl'].fun_facts).toEqual(['new fact']);
  });

  it('rejects invalid locale', async () => {
    const r = await addTranslation(
      indexRef,
      {
        locale: 'fr',
        data_key: 'substances',
        entity_id: 'hcl',
        fields: { name: 'test' },
      },
      tmpDir,
    );
    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
  });

  it('warns when entity_id is not in index', async () => {
    const r = await addTranslation(
      indexRef,
      {
        locale: 'en',
        data_key: 'substances',
        entity_id: 'totally_unknown_xyz',
        fields: { name: 'Unknown' },
      },
      tmpDir,
    );
    expect(r.status).toBe('created');
    expect(r.warnings).toBeDefined();
    expect(r.warnings!.length).toBeGreaterThan(0);
  });
});
