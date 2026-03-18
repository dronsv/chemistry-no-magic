// src/lib/ont-preview/adapters/concept-preview.ts
import type { ResolvedOntPreview, PreviewContext, PreviewFact } from '../../../types/ont-preview';
import type { SupportedLocale } from '../../../types/i18n';
import { loadConcepts, loadConceptOverlay, loadFormulas } from '../../data-loader';
import { formulaToDisplayString } from '../../formula-evaluator';
import { extractRefId, resolveRefKind } from '../../ont-ref-registry';

const MAX_DESCRIPTION_LEN = 220;

function capDescription(text: string): string {
  if (text.length <= MAX_DESCRIPTION_LEN) return text;
  return text.slice(0, MAX_DESCRIPTION_LEN - 1) + '…';
}

export async function resolveConceptPreview(
  ref: string,
  locale: string,
  _context?: PreviewContext,
): Promise<ResolvedOntPreview> {
  const id = extractRefId(ref);
  const kind = resolveRefKind(ref);
  const loc = locale as SupportedLocale;

  let concepts;
  let overlay;
  try {
    [concepts, overlay] = await Promise.all([
      loadConcepts(),
      loadConceptOverlay(loc),
    ]);
  } catch {
    concepts = {};
    overlay = null;
  }

  // Concept keys use full ref (e.g., "concept:pKa") in both registry and overlay
  const entry = concepts[ref] ?? concepts[id];
  const overlayEntry = overlay?.[ref] ?? overlay?.[id];

  if (!entry && !overlayEntry) {
    return {
      target: { ref, subjectKind: 'entity' },
      data: { title: id },
    };
  }

  const title = overlayEntry?.name ?? id;
  const description = overlayEntry?.description
    ? capDescription(overlayEntry.description)
    : undefined;

  const chips = [];

  // Parent concept chip
  if (entry?.parent_id) {
    const parentOverlay = overlay?.[entry.parent_id];
    if (parentOverlay?.name) {
      chips.push({ label: parentOverlay.name, variant: 'muted' as const });
    }
  }

  // canonicalHref: null for domain_concept, attempt buildCanonicalHref for substance_class
  let canonicalHref: string | undefined;
  if (kind === 'substance_class') {
    // No href resolution without slug data — return undefined
    canonicalHref = undefined;
  }

  // Find formulas that reference this concept
  const facts: PreviewFact[] = [];
  try {
    const formulas = await loadFormulas();
    const related = formulas.filter(f =>
      f.concept_refs?.includes(ref) || f.concept_refs?.includes(id)
    );
    // Show the generalized formula expression (prefer generalized over exact)
    const generalized = related.find(f => f.didactic_scope === 'generalized') ?? related[0];
    if (generalized) {
      facts.push({ label: 'Formula', value: formulaToDisplayString(generalized) });
    }
  } catch { /* formulas optional */ }

  return {
    target: { ref, subjectKind: 'entity', canonicalHref },
    data: {
      title,
      description,
      facts: facts.length > 0 ? facts : undefined,
      chips: chips.length > 0 ? chips : undefined,
    },
  };
}
