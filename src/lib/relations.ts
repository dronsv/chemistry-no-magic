import type { Relation, KnowledgeLevel } from '../types/relation';

/**
 * Returns all object values reachable from subjectId via predicate.
 * If predicate is omitted, returns all objects for the subject.
 */
export function getTargets(
  relations: Relation[],
  subjectId: string,
  predicate?: string,
): string[] {
  return relations
    .filter(r => r.subject === subjectId && (predicate === undefined || r.predicate === predicate))
    .map(r => r.object);
}

/**
 * Returns all subject IDs that point to objectId via predicate.
 * If predicate is omitted, returns all subjects for the object.
 */
export function getSources(
  relations: Relation[],
  objectId: string,
  predicate?: string,
): string[] {
  return relations
    .filter(r => r.object === objectId && (predicate === undefined || r.predicate === predicate))
    .map(r => r.subject);
}

/**
 * Filters relations to those with a specific knowledge_level.
 */
export function filterByKnowledgeLevel(
  relations: Relation[],
  level: KnowledgeLevel,
): Relation[] {
  return relations.filter(r => r.knowledge_level === level);
}

/**
 * Follows the has_conjugate_base chain from an acid (sub: prefixed) to its terminal base.
 * Handles monoprotic, diprotic, and triprotic acids by following the minimum-step path.
 * Returns null if the subject is not an acid or has no conjugate base.
 */
export function terminalConjugateBase(relations: Relation[], acidId: string): string | null {
  if (!acidId.startsWith('sub:')) return null;

  const cbMap = new Map<string, Array<{ step: number; target: string }>>();
  for (const r of relations) {
    if (r.predicate !== 'has_conjugate_base') continue;
    const entry = cbMap.get(r.subject) ?? [];
    entry.push({ step: r.step ?? 1, target: r.object });
    cbMap.set(r.subject, entry);
  }

  if (!cbMap.has(acidId)) return null;

  let current = acidId;
  let terminal: string | null = null;
  const visited = new Set<string>();

  while (cbMap.has(current) && !visited.has(current)) {
    visited.add(current);
    const nexts = cbMap.get(current)!.sort((a, b) => a.step - b.step);
    terminal = nexts[0].target;
    current = terminal;
  }

  return terminal;
}

/**
 * Returns all objects reachable from entityId via predicate at a specific step.
 */
export function getAtStep(
  relations: Relation[],
  entityId: string,
  predicate: string,
  step: number,
): string[] {
  return relations
    .filter(r => r.subject === entityId && r.predicate === predicate && r.step === step)
    .map(r => r.object);
}
