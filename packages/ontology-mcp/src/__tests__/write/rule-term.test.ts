import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { buildOntologyIndex, getDataSrcRoot } from '../../server/indexing/build-index.js';
import { addRuleTerm, updateRuleTerm } from '../../server/tools/write/rule-term.js';
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

async function makeTmpWithRuleTerms(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ontology-rule-term-'));
  await mkdir(join(dir, 'vocab'), { recursive: true });
  await cp(
    join(origDataSrc, 'vocab', 'rule_terms.json'),
    join(dir, 'vocab', 'rule_terms.json'),
  );
  return dir;
}

describe('addRuleTerm', () => {
  it('adds a new term and keeps the array sorted', async () => {
    tmpDir = await makeTmpWithRuleTerms();

    const r = await addRuleTerm(indexRef, { term: 'condition:cooling' }, tmpDir);

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('created');
    expect(r.term).toBe('condition:cooling');

    const data = (await readJsonFile(join(tmpDir, 'vocab', 'rule_terms.json'))) as string[];
    expect(data).toContain('condition:cooling');
    // Verify sorted
    const sorted = [...data].sort();
    expect(data).toEqual(sorted);
  });

  it('fails with ENTITY_EXISTS if term already exists', async () => {
    tmpDir = await makeTmpWithRuleTerms();

    const r = await addRuleTerm(indexRef, { term: 'condition:heating' }, tmpDir);

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
    expect(r.message).toContain('condition:heating');
  });

  it('fails with VALIDATION_FAILED if term is empty', async () => {
    tmpDir = await makeTmpWithRuleTerms();

    const r = await addRuleTerm(indexRef, { term: '' }, tmpDir);

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
    expect(r.message).toContain('term');
  });

  it('creates vocab dir and file if they do not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ontology-rule-term-'));
    // No vocab dir created

    const r = await addRuleTerm(indexRef, { term: 'new:term' }, tmpDir);

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('created');

    const data = (await readJsonFile(join(tmpDir, 'vocab', 'rule_terms.json'))) as string[];
    expect(data).toEqual(['new:term']);
  });
});

describe('updateRuleTerm', () => {
  it('replaces an existing term and re-sorts', async () => {
    tmpDir = await makeTmpWithRuleTerms();

    const r = await updateRuleTerm(
      indexRef,
      { old_term: 'condition:heating', new_term: 'condition:strong_heating' },
      tmpDir,
    );

    expect(r.error).toBeUndefined();
    expect(r.status).toBe('updated');
    expect(r.old_term).toBe('condition:heating');
    expect(r.new_term).toBe('condition:strong_heating');

    const data = (await readJsonFile(join(tmpDir, 'vocab', 'rule_terms.json'))) as string[];
    expect(data).not.toContain('condition:heating');
    expect(data).toContain('condition:strong_heating');
    // Verify sorted
    const sorted = [...data].sort();
    expect(data).toEqual(sorted);
  });

  it('fails with NOT_FOUND if old_term does not exist', async () => {
    tmpDir = await makeTmpWithRuleTerms();

    const r = await updateRuleTerm(
      indexRef,
      { old_term: 'nonexistent:term', new_term: 'new:term' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('NOT_FOUND');
    expect(r.message).toContain('nonexistent:term');
  });

  it('fails with ENTITY_EXISTS if new_term already exists', async () => {
    tmpDir = await makeTmpWithRuleTerms();

    const r = await updateRuleTerm(
      indexRef,
      { old_term: 'condition:heating', new_term: 'product:precipitate' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('ENTITY_EXISTS');
    expect(r.message).toContain('product:precipitate');
  });

  it('fails with VALIDATION_FAILED if old_term is empty', async () => {
    tmpDir = await makeTmpWithRuleTerms();

    const r = await updateRuleTerm(
      indexRef,
      { old_term: '', new_term: 'new:term' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
  });

  it('fails with VALIDATION_FAILED if new_term is empty', async () => {
    tmpDir = await makeTmpWithRuleTerms();

    const r = await updateRuleTerm(
      indexRef,
      { old_term: 'condition:heating', new_term: '' },
      tmpDir,
    );

    expect(r.error).toBe(true);
    expect(r.code).toBe('VALIDATION_FAILED');
  });
});
