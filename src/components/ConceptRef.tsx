import { useState } from 'react';
import { useConcepts } from './ConceptProvider';
import { localizeUrl, CONCEPT_KIND_ROUTES } from '../lib/i18n';
import type { SupportedLocale } from '../types/i18n';
import type { ConceptKind } from '../types/ontology-ref';
import './ontology-ref.css';

import { isDslFilter } from '../lib/filter-to-richtext';
import type { ConceptFilter, FilterExpr } from '../types/filter-dsl';

/** Extract the substance class name from a filter (works with both legacy and DSL formats) */
function extractClassFromFilter(filters: ConceptFilter | Record<string, string | string[]>): string | undefined {
  if (!isDslFilter(filters)) {
    // Legacy flat filter
    return typeof filters.class === 'string' ? filters.class : undefined;
  }
  // DSL filter — look for pred with field=class
  const search = (expr: FilterExpr): string | undefined => {
    if ('pred' in expr && expr.pred.field === 'class' && typeof expr.pred.eq === 'string') {
      return expr.pred.eq;
    }
    if ('all' in expr) {
      for (const sub of expr.all) { const r = search(sub); if (r) return r; }
    }
    return undefined;
  };
  return search(filters);
}

/** For substance_class, derive color from filters.class */
function getCssClass(kind: ConceptKind, filters: ConceptFilter | Record<string, string | string[]>): string {
  if (kind === 'substance_class') {
    const cls = extractClassFromFilter(filters);
    if (cls) return `ont-ref--${cls}`;
  }
  return `ont-ref--${kind}`;
}

/** Build concept page URL by walking parent_id chain for slug hierarchy */
function buildConceptUrl(
  conceptId: string,
  ctx: { registry: Record<string, { kind: ConceptKind; parent_id: string | null }>, overlay: Record<string, { slug: string }> },
  locale?: SupportedLocale,
): string {
  const entry = ctx.registry[conceptId];
  if (!entry) return '#';
  const ov = ctx.overlay[conceptId];
  if (!ov) return '#';

  // Build slug path by walking parent chain
  const slugs: string[] = [];
  let current: string | null = conceptId;
  while (current) {
    const curOv = ctx.overlay[current];
    if (curOv) slugs.unshift(curOv.slug);
    current = ctx.registry[current]?.parent_id ?? null;
  }

  const base = CONCEPT_KIND_ROUTES[entry.kind] ?? '/';
  const path = base + slugs.join('/') + '/';
  return locale ? localizeUrl(path, locale) : path;
}

interface ConceptRefProps {
  id: string;
  form?: string;
  surface?: string;
  locale?: SupportedLocale;
  variant?: 'chip' | 'card';
}

export default function ConceptRef({ id, form, surface, locale, variant = 'chip' }: ConceptRefProps) {
  const ctx = useConcepts();
  const [hovered, setHovered] = useState(false);

  if (!ctx) {
    // No provider — render plain text fallback
    return <span>{surface ?? id}</span>;
  }

  const entry = ctx.registry[id];
  const ov = ctx.overlay[id];
  if (!entry || !ov) {
    return <span>{surface ?? id}</span>;
  }

  // Resolve display label: surface -> forms[form] -> name
  let label = ov.name;
  if (surface) {
    label = surface;
  } else if (form && ov.forms?.[form]) {
    label = ov.forms[form];
  }

  const href = buildConceptUrl(id, ctx, locale);
  const cssClass = `ont-ref ${getCssClass(entry.kind, entry.filters)}`;

  return (
    <a
      className={cssClass}
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      {label}
      {hovered && (
        <span className="ont-ref__tooltip">
          {ov.name}
          {variant === 'card' && ov.description && (
            <span className="ont-ref__tooltip-desc">{ov.description}</span>
          )}
        </span>
      )}
    </a>
  );
}
