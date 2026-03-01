import type { ConceptFilter, FilterExpr, FilterPred } from '../types/filter-dsl';
import type { RichText, TextSeg } from '../types/ontology-ref';

/** Predicate field → concept prefix for building OntologyRef ids */
const FIELD_TO_PREFIX: Record<string, string> = {
  class: 'cls',
  element_kind: 'grp',
  reaction_type: 'rxtype',
  heat_effect: 'rxtype',
  has_property: 'prop',
};

/** Localized connectors */
const CONNECTORS: Record<string, { and: string; or: string; except: string; with: string }> = {
  ru: { and: ', ', or: ' или ', except: ' кроме ', with: ' со ' },
  en: { and: ', ', or: ' or ', except: ' except ', with: ' with ' },
  pl: { and: ', ', or: ' lub ', except: ' z wyjątkiem ', with: ' z ' },
  es: { and: ', ', or: ' o ', except: ' excepto ', with: ' con ' },
};

function getConnectors(locale: string) {
  return CONNECTORS[locale] ?? CONNECTORS.en;
}

function predToRichText(pred: FilterPred, locale: string): RichText {
  const field = pred.field;
  const prefix = FIELD_TO_PREFIX[field];

  if (pred.eq !== undefined) {
    if (prefix) {
      return [{ t: 'ref', id: `${prefix}:${pred.eq}` }];
    }
    return [{ t: 'text', v: `${field}=${String(pred.eq)}` }];
  }

  if (pred.has !== undefined) {
    if (field === 'has_property' || field === 'properties') {
      return [{ t: 'ref', id: `prop:${pred.has}` }];
    }
    if (field === 'type_tags') {
      return [{ t: 'ref', id: `rxtype:${pred.has}` }];
    }
    return [{ t: 'text', v: `${field} ∋ ${pred.has}` }];
  }

  if (pred.in !== undefined) {
    const conn = getConnectors(locale);
    const segments: RichText = [];
    for (let i = 0; i < pred.in.length; i++) {
      if (i > 0) segments.push({ t: 'text', v: conn.or });
      if (prefix) {
        segments.push({ t: 'ref', id: `${prefix}:${pred.in[i]}` });
      } else {
        segments.push({ t: 'text', v: String(pred.in[i]) });
      }
    }
    return segments;
  }

  if (pred.gt !== undefined) {
    return [{ t: 'text', v: `${field} > ${pred.gt}` }];
  }
  if (pred.lt !== undefined) {
    return [{ t: 'text', v: `${field} < ${pred.lt}` }];
  }

  return [{ t: 'text', v: field }];
}

function exprToRichText(expr: FilterExpr, locale: string, depth: number): RichText {
  if (depth > 10) return [{ t: 'text', v: '...' }];
  const conn = getConnectors(locale);

  if ('all' in expr) {
    const parts: RichText[] = expr.all.map(sub => exprToRichText(sub, locale, depth + 1));
    const result: RichText = [];
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) result.push({ t: 'text', v: conn.and });
      result.push(...parts[i]);
    }
    return result;
  }

  if ('any' in expr) {
    const parts: RichText[] = expr.any.map(sub => exprToRichText(sub, locale, depth + 1));
    const result: RichText = [];
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) result.push({ t: 'text', v: conn.or });
      result.push(...parts[i]);
    }
    return result;
  }

  if ('not' in expr) {
    const inner = exprToRichText(expr.not, locale, depth + 1);
    return [{ t: 'text', v: conn.except.trimStart() }, ...inner];
  }

  if ('pred' in expr) {
    return predToRichText(expr.pred, locale);
  }

  if ('concept' in expr) {
    return [{ t: 'ref', id: expr.concept }];
  }

  return [];
}

/** Convert Filter DSL → human-readable RichText criteria description */
export function filtersToRichText(
  filter: ConceptFilter,
  locale: string,
): RichText {
  return exprToRichText(filter, locale, 0);
}

/** Check if a filter is a new-style DSL expression (not legacy flat Record) */
export function isDslFilter(
  filter: ConceptFilter | Record<string, string | string[]>,
): filter is ConceptFilter {
  if (!filter || typeof filter !== 'object') return false;
  return 'all' in filter || 'any' in filter || 'not' in filter || 'pred' in filter || 'concept' in filter;
}
