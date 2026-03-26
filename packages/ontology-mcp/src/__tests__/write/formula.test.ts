import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex, getDataSrcRoot } from '../../server/indexing/build-index.js';
import { addFormula, updateFormula } from '../../server/tools/write/formula.js';
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

async function makeTmpWithFormulas(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ontology-formula-'));
  await mkdir(join(dir, 'foundations'), { recursive: true });
  await cp(
    join(origDataSrc, 'foundations', 'formulas.json'),
    join(dir, 'foundations', 'formulas.json'),
  );
  return dir;
}

const minimalFormula = {
  id: 'formula:test_ideal_gas',
  kind: 'definition',
  domain: 'thermodynamics',
  school_grade: [10],
  variables: [
    { symbol: 'P', quantity: 'q:pressure', unit: 'unit:Pa', role: 'input' },
    { symbol: 'V', quantity: 'q:volume', unit: 'unit:L', role: 'input' },
  ],
  expression: { op: 'multiply', operands: ['P', 'V'] },
  result_variable: 'PV',
};

describe('addFormula', () => {
  it('creates a new formula with correct structure', async () => {
    tmpDir = await makeTmpWithFormulas();

    const r = await addFormula(indexRef, minimalFormula, tmpDir);

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('created');
    expect(r.ref).toBe('formula:test_ideal_gas');
    expect(r.requires_review).toBe(true);

    const data = (await readJsonFile(join(tmpDir, 'foundations', 'formulas.json'))) as any[];
    const added = data.find((e: any) => e.id === 'formula:test_ideal_gas');
    expect(added).toBeDefined();
    expect(added.kind).toBe('definition');
    expect(added.domain).toBe('thermodynamics');
    expect(added.school_grade).toEqual([10]);
    expect(added.variables).toHaveLength(2);
    expect(added.expression).toEqual({ op: 'multiply', operands: ['P', 'V'] });
    expect(added.result_variable).toBe('PV');
  });

  it('creates a formula with all optional fields', async () => {
    tmpDir = await makeTmpWithFormulas();

    const r = await addFormula(
      indexRef,
      {
        ...minimalFormula,
        id: 'formula:test_full',
        concept_refs: ['concept:ideal_gas_law'],
        didactic_scope: 'basic',
        invertible_for: ['P', 'V'],
        inversions: { P: { op: 'divide', operands: ['PV', 'V'] } },
        constants_used: ['R'],
        prerequisite_formulas: ['formula:molar_mass_from_composition'],
        used_by_solvers: ['solver.gas'],
      },
      tmpDir,
    );

    expect(r.status).toBe('created');

    const data = (await readJsonFile(join(tmpDir, 'foundations', 'formulas.json'))) as any[];
    const added = data.find((e: any) => e.id === 'formula:test_full');
    expect(added.concept_refs).toEqual(['concept:ideal_gas_law']);
    expect(added.didactic_scope).toBe('basic');
    expect(added.invertible_for).toEqual(['P', 'V']);
    expect(added.constants_used).toEqual(['R']);
    expect(added.prerequisite_formulas).toEqual(['formula:molar_mass_from_composition']);
    expect(added.used_by_solvers).toEqual(['solver.gas']);
  });

  it('fails with VALIDATION_FAILED if id does not start with formula:', async () => {
    tmpDir = await makeTmpWithFormulas();

    const r = await addFormula(
      indexRef,
      { ...minimalFormula, id: 'bad_id' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
    expect(r.message).toContain('formula:');
  });

  it('fails with VALIDATION_FAILED if variables are empty', async () => {
    tmpDir = await makeTmpWithFormulas();

    const r = await addFormula(
      indexRef,
      { ...minimalFormula, id: 'formula:test_no_vars', variables: [] },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
    expect(r.message).toContain('variables');
  });

  it('fails with ENTITY_EXISTS if formula id already exists', async () => {
    tmpDir = await makeTmpWithFormulas();

    const r = await addFormula(
      indexRef,
      { ...minimalFormula, id: 'formula:molar_mass_from_composition' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
    expect(r.message).toContain('formula:molar_mass_from_composition');
  });
});

describe('updateFormula', () => {
  it('updates existing formula fields while preserving others', async () => {
    tmpDir = await makeTmpWithFormulas();

    const r = await updateFormula(
      indexRef,
      {
        id: 'formula:molar_mass_from_composition',
        domain: 'general_chemistry',
        school_grade: [8, 9],
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('updated');
    expect(r.ref).toBe('formula:molar_mass_from_composition');
    expect(r.requires_review).toBe(true);
    expect(r.updated_fields).toContain('domain');
    expect(r.updated_fields).toContain('school_grade');
    expect(r.updated_fields).not.toContain('id');

    const data = (await readJsonFile(join(tmpDir, 'foundations', 'formulas.json'))) as any[];
    const updated = data.find((e: any) => e.id === 'formula:molar_mass_from_composition');
    expect(updated.domain).toBe('general_chemistry');
    expect(updated.school_grade).toEqual([8, 9]);
    // Preserved fields
    expect(updated.kind).toBe('definition');
    expect(updated.variables).toBeDefined();
    expect(updated.expression).toBeDefined();
    expect(updated.result_variable).toBe('M');
  });

  it('fails with NOT_FOUND if formula does not exist', async () => {
    tmpDir = await makeTmpWithFormulas();

    const r = await updateFormula(
      indexRef,
      {
        id: 'formula:nonexistent_xyz',
        domain: 'test',
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
    expect(r.message).toContain('formula:nonexistent_xyz');
  });

  it('fails with VALIDATION_FAILED if id prefix is wrong', async () => {
    tmpDir = await makeTmpWithFormulas();

    const r = await updateFormula(
      indexRef,
      { id: 'bad_id', domain: 'test' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
    expect(r.message).toContain('formula:');
  });

  it('validates variables if provided during update', async () => {
    tmpDir = await makeTmpWithFormulas();

    const r = await updateFormula(
      indexRef,
      {
        id: 'formula:molar_mass_from_composition',
        variables: [],
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
    expect(r.message).toContain('variables');
  });
});
