import { useState } from 'react';
import { useConcepts } from './ConceptProvider';
import { localizeUrl } from '../lib/i18n';
import type { SupportedLocale } from '../types/i18n';
import type { ConceptKind } from '../types/ontology-ref';
import './ontology-ref.css';

/** Route templates per concept kind */
const KIND_ROUTES: Record<ConceptKind, string> = {
  substance_class: '/substances/',
  element_group: '/periodic-table/',
  reaction_type: '/reactions/',
  process: '/processes/',
  property: '/properties/',
};

/** For substance_class, derive color from filters.class */
function getCssClass(kind: ConceptKind, filters: Record<string, string | string[]>): string {
  if (kind === 'substance_class' && typeof filters.class === 'string') {
    return `ont-ref--${filters.class}`;
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

  const base = KIND_ROUTES[entry.kind] ?? '/';
  const path = base + slugs.join('/') + '/';
  return locale ? localizeUrl(path, locale) : path;
}

interface OntologyRefProps {
  id: string;
  form?: string;
  surface?: string;
  locale?: SupportedLocale;
}

export default function OntologyRef({ id, form, surface, locale }: OntologyRefProps) {
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
        </span>
      )}
    </a>
  );
}
