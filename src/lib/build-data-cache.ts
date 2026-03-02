/**
 * Build-time file cache for Astro static generation.
 *
 * Module-level Maps persist across page renders within a single `npm run build`,
 * eliminating redundant filesystem reads when the same JSON file is loaded for
 * every page in a multi-locale build (e.g. elements.json x 1072 pages -> 1 read).
 */
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const jsonCache = new Map<string, Promise<unknown>>();
const jsonSyncCache = new Map<string, unknown>();
const overlayCacheMap = new Map<string, Promise<Record<string, Record<string, unknown>> | null>>();

/**
 * Read and parse a JSON file, caching the result by absolute path.
 * Errors are NOT cached (subsequent calls retry).
 */
export async function cachedReadJson<T>(absolutePath: string): Promise<T> {
  const cached = jsonCache.get(absolutePath);
  if (cached) return cached as Promise<T>;

  const promise = readFile(absolutePath, 'utf-8').then(raw => JSON.parse(raw) as T);
  jsonCache.set(absolutePath, promise);
  promise.catch(() => { jsonCache.delete(absolutePath); });
  return promise as Promise<T>;
}

/**
 * Synchronous variant for use in synchronous getStaticPaths.
 */
export function cachedReadJsonSync<T>(absolutePath: string): T {
  const cached = jsonSyncCache.get(absolutePath);
  if (cached !== undefined) return cached as T;

  const result = JSON.parse(readFileSync(absolutePath, 'utf-8')) as T;
  jsonSyncCache.set(absolutePath, result);
  return result;
}

/** Read a JSON file relative to `data-src/`. */
export async function cachedReadDataSrc<T>(relativePath: string): Promise<T> {
  return cachedReadJson<T>(join(process.cwd(), 'data-src', relativePath));
}

/** Read a JSON file relative to `data-src/` (sync). */
export function cachedReadDataSrcSync<T>(relativePath: string): T {
  return cachedReadJsonSync<T>(join(process.cwd(), 'data-src', relativePath));
}

/**
 * Load a translation overlay file at build time, with caching.
 * Returns null for 'ru' locale or if the file doesn't exist.
 * Caches null results (missing overlays).
 */
export async function cachedLoadOverlay(
  locale: string,
  dataKey: string,
): Promise<Record<string, Record<string, unknown>> | null> {
  if (locale === 'ru') return null;

  const cacheKey = `${locale}:${dataKey}`;
  const cached = overlayCacheMap.get(cacheKey);
  if (cached !== undefined) return cached;

  const promise = (async () => {
    try {
      const filePath = join(process.cwd(), 'data-src', 'translations', locale, `${dataKey}.json`);
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as Record<string, Record<string, unknown>>;
    } catch {
      return null;
    }
  })();

  overlayCacheMap.set(cacheKey, promise);
  return promise;
}

/**
 * Load a derived data file from the built data bundle.
 * Reads manifest.json, resolves bundle_hash, navigates entrypoints by path keys.
 * E.g. cachedReadDerived(['derived', 'bond_energy']) loads the bond energy index.
 */
export async function cachedReadDerived<T>(entrypointPath: string[]): Promise<T | null> {
  const cacheKey = `derived:${entrypointPath.join('.')}`;
  const cached = jsonCache.get(cacheKey);
  if (cached) return cached as Promise<T | null>;

  const promise = (async (): Promise<T | null> => {
    try {
      const manifest = await cachedReadJson<{
        bundle_hash: string;
        entrypoints: Record<string, unknown>;
      }>(join(process.cwd(), 'public', 'data', 'latest', 'manifest.json'));

      let node: unknown = manifest.entrypoints;
      for (const key of entrypointPath) {
        if (node == null || typeof node !== 'object') return null;
        node = (node as Record<string, unknown>)[key];
      }
      if (typeof node !== 'string') return null;

      return await cachedReadJson<T>(
        join(process.cwd(), 'public', 'data', manifest.bundle_hash, node),
      );
    } catch {
      return null;
    }
  })();

  jsonCache.set(cacheKey, promise);
  promise.catch(() => { jsonCache.delete(cacheKey); });
  return promise;
}
