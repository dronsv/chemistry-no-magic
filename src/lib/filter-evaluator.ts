import type { ConceptFilter, FilterExpr, FilterPred } from '../types/filter-dsl';

type ConceptResolver = (conceptId: string) => ConceptFilter | undefined;

function evaluatePred(pred: FilterPred, entity: Record<string, unknown>): boolean {
  const val = entity[pred.field];

  if (pred.eq !== undefined) {
    return val === pred.eq;
  }
  if (pred.in !== undefined) {
    if (Array.isArray(val)) {
      return val.some(v => pred.in!.includes(v as string | number));
    }
    return pred.in.includes(val as string | number);
  }
  if (pred.has !== undefined) {
    if (Array.isArray(val)) {
      return val.includes(pred.has);
    }
    return false;
  }
  if (pred.gt !== undefined) {
    return typeof val === 'number' && val > pred.gt;
  }
  if (pred.lt !== undefined) {
    return typeof val === 'number' && val < pred.lt;
  }
  return false;
}

function evalExpr(
  expr: FilterExpr,
  entity: Record<string, unknown>,
  resolve: ConceptResolver,
  depth: number,
): boolean {
  if (depth > 10) return false; // prevent infinite recursion

  if ('all' in expr) {
    return expr.all.every(sub => evalExpr(sub, entity, resolve, depth + 1));
  }
  if ('any' in expr) {
    return expr.any.some(sub => evalExpr(sub, entity, resolve, depth + 1));
  }
  if ('not' in expr) {
    return !evalExpr(expr.not, entity, resolve, depth + 1);
  }
  if ('pred' in expr) {
    return evaluatePred(expr.pred, entity);
  }
  if ('concept' in expr) {
    const conceptFilter = resolve(expr.concept);
    if (!conceptFilter) return false;
    return evalExpr(conceptFilter, entity, resolve, depth + 1);
  }
  return false;
}

/** Evaluate a filter expression against an entity record */
export function evaluateFilter(
  filter: ConceptFilter,
  entity: Record<string, unknown>,
  resolveConceptFilter: ConceptResolver,
): boolean {
  return evalExpr(filter, entity, resolveConceptFilter, 0);
}

/** Evaluate filter against an array of entities, return matches */
export function filterEntities<T extends Record<string, unknown>>(
  filter: ConceptFilter,
  entities: T[],
  resolveConceptFilter: ConceptResolver,
): T[] {
  return entities.filter(e => evaluateFilter(filter, e, resolveConceptFilter));
}
