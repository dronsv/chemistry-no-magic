import type { QRef, BoundContext } from '../../types/derivation';

/**
 * Semantic identity key for derivation planner.
 * Uses quantity + role + context. Phase is EXCLUDED — it is procedural, not identity.
 * When context is absent, output is identical to the pre-context version.
 */
export function qrefKey(qref: QRef): string {
  let key = qref.quantity;
  if (qref.role) key += `|${qref.role}`;
  if (qref.context) key += `@${contextKey(qref.context)}`;
  return key;
}

function contextKey(ctx: BoundContext): string {
  let key = ctx.system_type;
  if (ctx.entity_ref) key += ':' + ctx.entity_ref;
  if (ctx.parent_ref) key += '^' + ctx.parent_ref;
  if (ctx.bindings) {
    const entries = Object.entries(ctx.bindings).sort(([a], [b]) => a.localeCompare(b));
    key += '{' + entries.map(([k, v]) => `${k}=${v}`).join(',') + '}';
  }
  return key;
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
