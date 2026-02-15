import type { Manifest } from '../types/manifest';
import type { Element } from '../types/element';
import type { Ion } from '../types/ion';
import type { Substance } from '../types/substance';
import type { BktParams } from '../types/bkt';
import type { TaskTemplate, ReactionTemplate } from '../types/templates';
import type { DiagnosticQuestion } from '../types/diagnostic';

/** Module-level cache for the manifest to avoid repeated fetches. */
let manifestCache: Manifest | null = null;

/**
 * Fetch and cache `/data/latest/manifest.json`.
 * Subsequent calls return the cached value without a network request.
 */
export async function getManifest(): Promise<Manifest> {
  if (manifestCache) {
    return manifestCache;
  }

  const url = '/data/latest/manifest.json';
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to load manifest from ${url}: ${response.status} ${response.statusText}`,
    );
  }

  manifestCache = (await response.json()) as Manifest;
  return manifestCache;
}

/**
 * Resolve a relative path against the current bundle_hash and fetch the JSON file.
 *
 * @param path - Relative path within the data bundle (e.g. `"elements.json"`, `"rules/classification_rules.json"`).
 * @returns Parsed JSON typed as `T`.
 */
export async function loadDataFile<T>(path: string): Promise<T> {
  const manifest = await getManifest();
  const url = `/data/${manifest.bundle_hash}/${path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to load data file ${url}: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

/** Load the full elements list. */
export async function loadElements(): Promise<Element[]> {
  const manifest = await getManifest();
  return loadDataFile<Element[]>(manifest.entrypoints.elements);
}

/** Load the full ions list. */
export async function loadIons(): Promise<Ion[]> {
  const manifest = await getManifest();
  return loadDataFile<Ion[]>(manifest.entrypoints.ions);
}

/**
 * Load a single substance by its ID.
 *
 * @param id - Substance identifier (e.g. `"NaCl"`).
 */
export async function loadSubstance(id: string): Promise<Substance> {
  const manifest = await getManifest();
  const basePath = manifest.entrypoints.substances;
  // Substances directory contains individual files per substance
  const path = `${basePath}/${id}.json`;
  return loadDataFile<Substance>(path);
}

/**
 * Load a rule file by name.
 *
 * @param name - Rule name matching a key in `manifest.entrypoints.rules`
 *               (e.g. `"classification_rules"`, `"naming_rules"`).
 */
export async function loadRule(name: string): Promise<unknown> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.rules[name];

  if (!path) {
    throw new Error(
      `Unknown rule "${name}". Available rules: ${Object.keys(manifest.entrypoints.rules).join(', ')}`,
    );
  }

  return loadDataFile<unknown>(path);
}

/**
 * Load an index file by name.
 *
 * @param name - Index name matching a key in `manifest.entrypoints.indices`
 *               (e.g. `"substances_index"`).
 */
export async function loadIndex(name: string): Promise<unknown> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.indices[name];

  if (!path) {
    throw new Error(
      `Unknown index "${name}". Available indices: ${Object.keys(manifest.entrypoints.indices).join(', ')}`,
    );
  }

  return loadDataFile<unknown>(path);
}

/** Load BKT parameters for all competencies. */
export async function loadBktParams(): Promise<BktParams[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.rules['bkt_params'];

  if (!path) {
    throw new Error(
      'BKT params not found in manifest. Expected key "bkt_params" in entrypoints.rules.',
    );
  }

  return loadDataFile<BktParams[]>(path);
}

/** Load all task templates. */
export async function loadTaskTemplates(): Promise<TaskTemplate[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.templates['task_templates'];

  if (!path) {
    throw new Error(
      'Task templates not found in manifest. Expected key "task_templates" in entrypoints.templates.',
    );
  }

  return loadDataFile<TaskTemplate[]>(path);
}

/** Load diagnostic questions. */
export async function loadDiagnosticQuestions(): Promise<DiagnosticQuestion[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.diagnostic;

  if (!path) {
    throw new Error(
      'Diagnostic questions not found in manifest. Expected key "diagnostic" in entrypoints.',
    );
  }

  return loadDataFile<DiagnosticQuestion[]>(path);
}

/** Load all reaction templates. */
export async function loadReactionTemplates(): Promise<ReactionTemplate[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.templates['reaction_templates'];

  if (!path) {
    throw new Error(
      'Reaction templates not found in manifest. Expected key "reaction_templates" in entrypoints.templates.',
    );
  }

  return loadDataFile<ReactionTemplate[]>(path);
}
