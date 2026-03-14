import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cachedReadJsonSync, cachedReadDataSrcSync } from '../../lib/build-data-cache';
import type { ConceptEntry, ConceptRegistry, ConceptOverlayEntry } from '../../types/ontology-ref';
import type { SupportedLocale } from '../../types/i18n';
import { SUPPORTED_LOCALES, CONCEPT_KIND_ROUTES, localizeUrl } from '../../lib/i18n';

const DATA_SRC = join(process.cwd(), 'data-src');

/** Minimal substance info needed for rendering examples */
export interface SubstanceInfo {
  id: string;
  formula: string;
  name?: string;
  class: string;
}

export interface ConceptPageProps {
  conceptId: string;
  entry: ConceptEntry;
  overlay: ConceptOverlayEntry;
  locale: string;
  breadcrumbs: Array<{ name: string; slug: string; href: string }>;
  children: Array<{ id: string; name: string; slug: string }>;
  /** Substance info keyed by substance ID, for rendering substance examples */
  substanceIndex: Record<string, SubstanceInfo>;
  /** Cross-locale alternate URLs for language switcher */
  alternateUrls: Record<SupportedLocale, string>;
}

interface ConceptPagePath {
  params: { conceptSlug: string };
  props: ConceptPageProps;
}

/** Load minimal substance data from individual files in data-src/substances/ */
function loadSubstanceIndex(): Record<string, SubstanceInfo> {
  const dir = join(DATA_SRC, 'substances');
  const index: Record<string, SubstanceInfo> = {};
  try {
    const files = readdirSync(dir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const data = cachedReadJsonSync<SubstanceInfo>(join(dir, f));
      index[data.id] = {
        id: data.id,
        formula: data.formula,
        name: data.name,
        class: data.class,
      };
    }
  } catch { /* substances dir optional */ }
  return index;
}

/** Build the hierarchical slug path for a concept by walking parent chain */
function buildSlugPath(
  conceptId: string,
  registry: ConceptRegistry,
  overlay: Record<string, { slug: string }>,
): string[] {
  const slugs: string[] = [];
  let current: string | null = conceptId;
  while (current) {
    const ov = overlay[current];
    if (ov) slugs.unshift(ov.slug);
    current = registry[current]?.parent_id ?? null;
  }
  return slugs;
}

/** Load concept overlays for all locales (cached) */
function loadAllOverlays(): Record<SupportedLocale, Record<string, ConceptOverlayEntry>> {
  const result = {} as Record<SupportedLocale, Record<string, ConceptOverlayEntry>>;
  for (const loc of SUPPORTED_LOCALES) {
    try {
      result[loc] = cachedReadJsonSync(join(DATA_SRC, 'translations', loc, 'concepts.json'));
    } catch {
      result[loc] = {};
    }
  }
  return result;
}

/** Build alternate URLs for a concept across all locales */
function buildAlternateUrls(
  conceptId: string,
  kind: string,
  registry: ConceptRegistry,
  allOverlays: Record<SupportedLocale, Record<string, ConceptOverlayEntry>>,
): Record<SupportedLocale, string> {
  const baseRoute = CONCEPT_KIND_ROUTES[kind] ?? '/';
  const result = {} as Record<SupportedLocale, string>;
  for (const loc of SUPPORTED_LOCALES) {
    const ov = allOverlays[loc];
    if (ov[conceptId]) {
      const slugPath = buildSlugPath(conceptId, registry, ov);
      result[loc] = localizeUrl(baseRoute, loc) + slugPath.join('/') + '/';
    } else {
      // Fallback: use the base route if overlay missing for this locale
      result[loc] = localizeUrl(baseRoute, loc);
    }
  }
  return result;
}

export function getConceptDetailPaths(locale: string): ConceptPagePath[] {
  const registry = cachedReadDataSrcSync<ConceptRegistry>('concepts.json');

  // Load overlays for all locales (for cross-locale URL mapping)
  const allOverlays = loadAllOverlays();

  let overlay: Record<string, ConceptOverlayEntry>;
  try {
    overlay = cachedReadJsonSync(join(DATA_SRC, 'translations', locale, 'concepts.json'));
  } catch {
    return [];
  }

  // Load substance index for resolving substance examples
  const substanceIndex = loadSubstanceIndex();

  // Apply locale overlay to substance names if available
  if (locale !== 'ru') {
    try {
      const substOverlay = cachedReadJsonSync<Record<string, { name?: string }>>(
        join(DATA_SRC, 'translations', locale, 'substances.json'),
      );
      for (const [id, ov] of Object.entries(substOverlay)) {
        if (substanceIndex[id] && ov.name) {
          substanceIndex[id] = { ...substanceIndex[id], name: ov.name };
        }
      }
    } catch { /* overlay optional */ }
  }

  const paths: ConceptPagePath[] = [];

  for (const [conceptId, entry] of Object.entries(registry)) {
    const ov = overlay[conceptId];
    if (!ov) continue;

    const slugPath = buildSlugPath(conceptId, registry, overlay);
    const conceptSlug = slugPath.join('/');

    // Build breadcrumbs by walking parent chain
    const crumbs: Array<{ name: string; slug: string }> = [];
    let current: string | null = entry.parent_id;
    while (current) {
      const parentOv = overlay[current];
      if (parentOv) {
        const parentSlugs = buildSlugPath(current, registry, overlay);
        crumbs.unshift({ name: parentOv.name, slug: parentSlugs.join('/') });
      }
      current = registry[current]?.parent_id ?? null;
    }

    const breadcrumbs = crumbs.map(c => ({
      ...c,
      href: c.slug + '/',
    }));

    // Build children list from children_order
    const children: Array<{ id: string; name: string; slug: string }> = [];
    const childOrder = entry.children_order ?? [];
    for (const childId of childOrder) {
      const childOv = overlay[childId];
      if (childOv) {
        const childSlugs = buildSlugPath(childId, registry, overlay);
        children.push({ id: childId, name: childOv.name, slug: childSlugs.join('/') });
      }
    }

    // Build a filtered substance index containing only substances referenced in examples
    const relevantSubstances: Record<string, SubstanceInfo> = {};
    for (const ex of entry.examples) {
      if (ex.kind === 'substance' && substanceIndex[ex.id]) {
        relevantSubstances[ex.id] = substanceIndex[ex.id];
      }
    }

    // Build cross-locale alternate URLs for language switcher
    const alternateUrls = buildAlternateUrls(conceptId, entry.kind, registry, allOverlays);

    paths.push({
      params: { conceptSlug },
      props: {
        conceptId,
        entry,
        overlay: ov,
        locale,
        breadcrumbs,
        children,
        substanceIndex: relevantSubstances,
        alternateUrls,
      },
    });
  }

  return paths;
}

/** Get only concepts of specific kinds */
export function getConceptDetailPathsByKind(locale: string, kinds: string[]): ConceptPagePath[] {
  return getConceptDetailPaths(locale).filter(p => kinds.includes(p.props.entry.kind));
}
