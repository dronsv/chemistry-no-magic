import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex, getDataSrcRoot } from '../../server/indexing/build-index.js';
import { addCharacteristic, updateCharacteristic } from '../../server/tools/write/characteristic.js';
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

describe('addCharacteristic', () => {
  it('adds a characteristic to a substance that has existing characteristics', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(
      join(origDataSrc, 'substances', 'nacl.json'),
      join(tmpDir, 'substances', 'nacl.json'),
    );

    const r = await addCharacteristic(
      indexRef,
      {
        substance_id: 'nacl',
        concept_ref: 'concept:solubility',
        value: 35.7,
        unit: 'unit:g_per_100g_water',
        conditions: { temperature_celsius: 20 },
        source: 'CRC Handbook',
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('added');
    expect(r.ref).toBe('sub:nacl');
    expect(r.concept_ref).toBe('concept:solubility');
    expect(r.path).toBe(join(tmpDir, 'substances', 'nacl.json'));

    const data = await readJsonFile(join(tmpDir, 'substances', 'nacl.json')) as any;
    expect(data.characteristics['concept:solubility']).toBeDefined();
    expect(data.characteristics['concept:solubility'].value).toBe(35.7);
    expect(data.characteristics['concept:solubility'].unit).toBe('unit:g_per_100g_water');
    expect(data.characteristics['concept:solubility'].conditions).toEqual({ temperature_celsius: 20 });
    expect(data.characteristics['concept:solubility'].source).toBe('CRC Handbook');
    // Pre-existing characteristics preserved
    expect(data.characteristics['concept:boiling_point']).toBeDefined();
    expect(data.characteristics['concept:melting_point']).toBeDefined();
  });

  it('adds a characteristic to a substance without existing characteristics', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    // Write a minimal substance with no characteristics field
    const minimalSubstance = { id: 'sub:test_bare', formula: 'XY', class: 'salt' };
    const { writeJsonFile } = await import('../../server/tools/write/_shared.js');
    await writeJsonFile(join(tmpDir, 'substances', 'test_bare.json'), minimalSubstance);

    const r = await addCharacteristic(
      indexRef,
      {
        substance_id: 'test_bare',
        concept_ref: 'concept:molar_mass',
        value: 42,
        unit: 'unit:g_per_mol',
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('added');

    const data = await readJsonFile(join(tmpDir, 'substances', 'test_bare.json')) as any;
    expect(data.characteristics).toBeDefined();
    expect(data.characteristics['concept:molar_mass'].value).toBe(42);
  });

  it('fails with ENTITY_EXISTS if characteristic already exists on substance', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(
      join(origDataSrc, 'substances', 'h2o.json'),
      join(tmpDir, 'substances', 'h2o.json'),
    );

    // h2o.json already has concept:boiling_point
    const r = await addCharacteristic(
      indexRef,
      {
        substance_id: 'h2o',
        concept_ref: 'concept:boiling_point',
        value: 100,
        unit: 'unit:celsius',
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
    expect(r.message).toContain('concept:boiling_point');
    expect(r.message).toContain('h2o');
  });

  it('fails with NOT_FOUND if substance does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    const r = await addCharacteristic(
      indexRef,
      {
        substance_id: 'nonexistent_xyz',
        concept_ref: 'concept:boiling_point',
        value: 100,
        unit: 'unit:celsius',
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
    expect(r.message).toContain('nonexistent_xyz');
  });
});

describe('updateCharacteristic', () => {
  it('updates an existing characteristic on a substance', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(
      join(origDataSrc, 'substances', 'h2o.json'),
      join(tmpDir, 'substances', 'h2o.json'),
    );

    const r = await updateCharacteristic(
      indexRef,
      {
        substance_id: 'h2o',
        concept_ref: 'concept:boiling_point',
        value: 99.974,
        unit: 'unit:celsius',
        source: 'IUPAC 2018',
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('updated');
    expect(r.ref).toBe('sub:h2o');
    expect(r.concept_ref).toBe('concept:boiling_point');
    expect(r.path).toBe(join(tmpDir, 'substances', 'h2o.json'));

    const data = await readJsonFile(join(tmpDir, 'substances', 'h2o.json')) as any;
    expect(data.characteristics['concept:boiling_point'].value).toBe(99.974);
    expect(data.characteristics['concept:boiling_point'].unit).toBe('unit:celsius');
    expect(data.characteristics['concept:boiling_point'].source).toBe('IUPAC 2018');
    // Other characteristics preserved
    expect(data.characteristics['concept:density']).toBeDefined();
    expect(data.characteristics['concept:melting_point']).toBeDefined();
  });

  it('fails with NOT_FOUND if substance does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });

    const r = await updateCharacteristic(
      indexRef,
      {
        substance_id: 'nonexistent_xyz',
        concept_ref: 'concept:boiling_point',
        value: 100,
        unit: 'unit:celsius',
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
    expect(r.message).toContain('nonexistent_xyz');
  });

  it('fails with NOT_FOUND if characteristic does not exist on substance', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-char-'));
    await mkdir(join(tmpDir, 'substances'), { recursive: true });
    await cp(
      join(origDataSrc, 'substances', 'nacl.json'),
      join(tmpDir, 'substances', 'nacl.json'),
    );

    const r = await updateCharacteristic(
      indexRef,
      {
        substance_id: 'nacl',
        concept_ref: 'concept:nonexistent_property',
        value: 42,
        unit: 'unit:g_per_mol',
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
    expect(r.message).toContain('concept:nonexistent_property');
    expect(r.message).toContain('nacl');
  });
});
