import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex, getDataSrcRoot } from '../../server/indexing/build-index.js';
import { addReaction, updateReaction } from '../../server/tools/write/reaction.js';
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

async function makeTmpWithReactions(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ontology-reaction-'));
  await mkdir(join(dir, 'reactions'), { recursive: true });
  await cp(
    join(origDataSrc, 'reactions', 'reactions.json'),
    join(dir, 'reactions', 'reactions.json'),
  );
  return dir;
}

const minimalReaction = {
  reaction_id: 'rx_test_01',
  equation: 'A + B → C',
  type_tags: ['test'],
  molecular: {
    reactants: [{ formula: 'A', coeff: 1 }],
    products: [{ formula: 'C', coeff: 1 }],
  },
};

describe('addReaction', () => {
  it('creates a new reaction with correct structure', async () => {
    tmpDir = await makeTmpWithReactions();

    const r = await addReaction(indexRef, minimalReaction, tmpDir);

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('created');
    expect(r.ref).toBe('rx_test_01');
    expect(r.requires_review).toBe(true);

    const data = (await readJsonFile(join(tmpDir, 'reactions', 'reactions.json'))) as any[];
    const added = data.find((e: any) => e.reaction_id === 'rx_test_01');
    expect(added).toBeDefined();
    expect(added.equation).toBe('A + B → C');
    expect(added.type_tags).toEqual(['test']);
    expect(added.molecular.reactants).toHaveLength(1);
    expect(added.molecular.products).toHaveLength(1);
  });

  it('creates a reaction with all optional fields', async () => {
    tmpDir = await makeTmpWithReactions();

    const r = await addReaction(
      indexRef,
      {
        ...minimalReaction,
        reaction_id: 'rx_test_full',
        phase: { medium: 'aq', note_key: 'aqueous' },
        conditions: { temperature: 'room' },
        driving_forces: ['water_formation'],
        ionic: { full: 'H⁺ + OH⁻ → H₂O', net: 'H⁺ + OH⁻ → H₂O', spectators: [] },
        heat_effect: 'exothermic',
        safety_notes: ['wear goggles'],
        competencies: { comp1: 'value' },
        template_id: 'tmpl_test',
        schema_version: 2,
      },
      tmpDir,
    );

    expect(r.status).toBe('created');

    const data = (await readJsonFile(join(tmpDir, 'reactions', 'reactions.json'))) as any[];
    const added = data.find((e: any) => e.reaction_id === 'rx_test_full');
    expect(added.phase.medium).toBe('aq');
    expect(added.driving_forces).toEqual(['water_formation']);
    expect(added.heat_effect).toBe('exothermic');
    expect(added.safety_notes).toEqual(['wear goggles']);
    expect(added.template_id).toBe('tmpl_test');
    expect(added.schema_version).toBe(2);
  });

  it('fails with ENTITY_EXISTS if reaction_id already exists', async () => {
    tmpDir = await makeTmpWithReactions();

    const r = await addReaction(
      indexRef,
      {
        ...minimalReaction,
        reaction_id: 'rx_neutral_01_hcl_naoh', // exists in real data
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
    expect(r.message).toContain('rx_neutral_01_hcl_naoh');
  });

  it('fails with VALIDATION_FAILED if reaction_id is empty', async () => {
    tmpDir = await makeTmpWithReactions();

    const r = await addReaction(
      indexRef,
      { ...minimalReaction, reaction_id: '' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
    expect(r.message).toContain('reaction_id');
  });

  it('fails with VALIDATION_FAILED if reactants are empty', async () => {
    tmpDir = await makeTmpWithReactions();

    const r = await addReaction(
      indexRef,
      {
        ...minimalReaction,
        reaction_id: 'rx_bad',
        molecular: { reactants: [], products: [{ formula: 'C', coeff: 1 }] },
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
    expect(r.message).toContain('reactants');
  });

  it('fails with VALIDATION_FAILED if products are empty', async () => {
    tmpDir = await makeTmpWithReactions();

    const r = await addReaction(
      indexRef,
      {
        ...minimalReaction,
        reaction_id: 'rx_bad',
        molecular: { reactants: [{ formula: 'A', coeff: 1 }], products: [] },
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
    expect(r.message).toContain('products');
  });
});

describe('updateReaction', () => {
  it('updates existing reaction fields while preserving others', async () => {
    tmpDir = await makeTmpWithReactions();

    const r = await updateReaction(
      indexRef,
      {
        reaction_id: 'rx_neutral_01_hcl_naoh',
        heat_effect: 'strongly_exothermic',
        type_tags: ['exchange', 'neutralization', 'test_tag'],
      },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('updated');
    expect(r.ref).toBe('rx_neutral_01_hcl_naoh');
    expect(r.requires_review).toBe(true);
    expect(r.updated_fields).toContain('heat_effect');
    expect(r.updated_fields).toContain('type_tags');
    expect(r.updated_fields).not.toContain('reaction_id');

    const data = (await readJsonFile(join(tmpDir, 'reactions', 'reactions.json'))) as any[];
    const updated = data.find((e: any) => e.reaction_id === 'rx_neutral_01_hcl_naoh');
    expect(updated.heat_effect).toBe('strongly_exothermic');
    expect(updated.type_tags).toContain('test_tag');
    // Preserved fields
    expect(updated.equation).toBeDefined();
    expect(updated.molecular).toBeDefined();
  });

  it('fails with NOT_FOUND if reaction does not exist', async () => {
    tmpDir = await makeTmpWithReactions();

    const r = await updateReaction(
      indexRef,
      {
        reaction_id: 'rx_nonexistent_xyz',
        heat_effect: 'endothermic',
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
    expect(r.message).toContain('rx_nonexistent_xyz');
  });

  it('validates molecular block if provided during update', async () => {
    tmpDir = await makeTmpWithReactions();

    const r = await updateReaction(
      indexRef,
      {
        reaction_id: 'rx_neutral_01_hcl_naoh',
        molecular: { reactants: [], products: [{ formula: 'C', coeff: 1 }] },
      },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
    expect(r.message).toContain('reactants');
  });
});
