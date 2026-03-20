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
