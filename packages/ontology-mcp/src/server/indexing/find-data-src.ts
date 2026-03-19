import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let cached: string | null = null;

export async function findDataSrc(): Promise<string> {
  if (cached) return cached;
  const cwd = process.cwd();
  const candidates = [
    join(cwd, 'data-src'),
    join(cwd, '..', '..', 'data-src'),
    join(cwd, '..', 'data-src'),
  ];
  for (const candidate of candidates) {
    try {
      await readFile(join(candidate, 'elements.json'), 'utf-8');
      cached = candidate;
      return candidate;
    } catch { /* try next */ }
  }
  throw new Error('Could not find data-src directory');
}
