import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex, getDataSrcRoot } from '../../server/indexing/build-index.js';
import { addSubstance, updateSubstance } from '../../server/tools/write/substance.js';
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

describe('addSubstance', () => {
  it('creates a new substance file with correct structure', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-sub-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    const r = await addSubstance(
      indexRef,
      {
        id: 'test_nacl',
        formula: 'NaCl',
        class: 'salt',
        subclass: 'chloride',
        ions: ['ion:Na_plus', 'ion:Cl_minus'],
        tags: ['soluble', 'strong_electrolyte'],
        phase_standard: 's',
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('created');
    expect(r.ref).toBe('sub:test_nacl');
    expect(r.path).toBe(join(tmpDir, 'substances', 'test_nacl.json'));

    const data = await readJsonFile(join(tmpDir, 'substances', 'test_nacl.json')) as any;
    expect(data.id).toBe('sub:test_nacl');
    expect(data.formula).toBe('NaCl');
    expect(data.class).toBe('salt');
    expect(data.subclass).toBe('chloride');
    expect(data.ions).toEqual(['ion:Na_plus', 'ion:Cl_minus']);
    expect(data.tags).toEqual(['soluble', 'strong_electrolyte']);
    expect(data.phase_standard).toBe('s');
  });

  it('fails with ENTITY_EXISTS if substance already exists', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-sub-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(
      join(origDataSrc, 'substances', 'hcl.json'),
      join(tmpDir, 'substances', 'hcl.json'),
    );

    const r = await addSubstance(
      indexRef,
      {
        id: 'hcl',
        formula: 'HCl',
        class: 'acid',
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
    expect(r.message).toContain('hcl');
  });
});

describe('updateSubstance', () => {
  it('updates existing substance fields while preserving others', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-sub-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(
      join(origDataSrc, 'substances', 'hcl.json'),
      join(tmpDir, 'substances', 'hcl.json'),
    );

    const r = await updateSubstance(
      indexRef,
      {
        id: 'hcl',
        tags: ['soluble', 'strong_electrolyte', 'strong_acid', 'test_tag'],
        phase_standard: 'aq',
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('updated');
    expect(r.ref).toBe('sub:hcl');
    expect(r.updated_fields).toContain('tags');
    expect(r.updated_fields).toContain('phase_standard');
    expect(r.updated_fields).not.toContain('id');

    const data = await readJsonFile(join(tmpDir, 'substances', 'hcl.json')) as any;
    // Updated fields
    expect(data.tags).toContain('test_tag');
    expect(data.phase_standard).toBe('aq');
    // Preserved fields
    expect(data.id).toBe('sub:hcl');
    expect(data.formula).toBe('HCl');
    expect(data.class).toBe('acid');
    expect(data.characteristics).toBeDefined();
  });

  it('fails with NOT_FOUND if substance does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-sub-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    const r = await updateSubstance(
      indexRef,
      {
        id: 'nonexistent_xyz',
        formula: 'XYZ',
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
    expect(r.message).toContain('nonexistent_xyz');
  });
});
