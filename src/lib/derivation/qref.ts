import type { QRef } from '../../types/derivation';

/**
 * Semantic identity key for derivation planner.
 * Uses quantity + role only. Phase is EXCLUDED — it is procedural, not identity.
 */
export function qrefKey(qref: QRef): string {
  if (qref.role) return `${qref.quantity}|${qref.role}`;
  return qref.quantity;
}

/**
 * Full problem-state key including phase (for UI/task layer, not used by planner).
 */
export function problemQRefKey(qref: QRef): string {
  let key = qref.quantity;
  if (qref.role) key += `|${qref.role}`;
  if (qref.phase) key += `|${qref.phase}`;
  return key;
}

/** Check if a QRef matches a known set (by semantic key). */
export function qrefInSet(qref: QRef, knownKeys: Set<string>): boolean {
  return knownKeys.has(qrefKey(qref));
}
