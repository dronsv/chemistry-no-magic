import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ConceptEntry, ConceptRegistry, ConceptOverlayEntry } from '../../types/ontology-ref';

const DATA_SRC = join(process.cwd(), 'data-src');

/** Minimal substance info needed for rendering examples */
export interface SubstanceInfo {
  id: string;
  formula: string;
  name_ru?: string;
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
}

interface ConceptPagePath {
  params: { conceptSlug: string };
  props: ConceptPageProps;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/** Load minimal substance data from individual files in data-src/substances/ */
function loadSubstanceIndex(): Record<string, SubstanceInfo> {
  const dir = join(DATA_SRC, 'substances');
  const index: Record<string, SubstanceInfo> = {};
  try {
    const files = readdirSync(dir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const data = loadJson<SubstanceInfo>(join(dir, f));
      index[data.id] = {
        id: data.id,
        formula: data.formula,
        name_ru: data.name_ru,
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

export function getConceptDetailPaths(locale: string): ConceptPagePath[] {
  const registry = loadJson<ConceptRegistry>(join(DATA_SRC, 'concepts.json'));

  let overlay: Record<string, ConceptOverlayEntry>;
  try {
    overlay = loadJson(join(DATA_SRC, 'translations', locale, 'concepts.json'));
  } catch {
    return [];
  }

  // Load substance index for resolving substance examples
  const substanceIndex = loadSubstanceIndex();

  // Apply locale overlay to substance names if available
  if (locale !== 'ru') {
    try {
      const substOverlay = loadJson<Record<string, { name_ru?: string }>>(
        join(DATA_SRC, 'translations', locale, 'substances.json'),
      );
      for (const [id, ov] of Object.entries(substOverlay)) {
        if (substanceIndex[id] && ov.name_ru) {
          substanceIndex[id] = { ...substanceIndex[id], name_ru: ov.name_ru };
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
      },
    });
  }

  return paths;
}

/** Get only concepts of specific kinds */
export function getConceptDetailPathsByKind(locale: string, kinds: string[]): ConceptPagePath[] {
  return getConceptDetailPaths(locale).filter(p => kinds.includes(p.props.entry.kind));
}
