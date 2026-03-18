// src/lib/ont-preview/adapters/substance-preview.ts
import type { ResolvedOntPreview, PreviewContext, PreviewFact } from '../../../types/ont-preview';
import type { SupportedLocale } from '../../../types/i18n';
import { loadSubstancesIndex, loadConceptOverlay } from '../../data-loader';
import { buildCanonicalHref, extractRefId } from '../../ont-ref-registry';
import { getEntityCharValue } from '../../characteristics-utils';

/** Map class+subclass to concept ID for localized display */
const CLASS_TO_CONCEPT: Record<string, string> = {
  oxide: 'cls:oxide', acid: 'cls:acid', base: 'cls:base', salt: 'cls:salt',
};
const SUBCLASS_TO_CONCEPT: Record<string, string> = {
  basic: 'cls:oxide_basic', acidic: 'cls:oxide_acidic',
  amphoteric: 'cls:oxide_amphoteric', indifferent: 'cls:oxide_indifferent',
  oxygen_containing: 'cls:acid_oxygen', oxygen_free: 'cls:acid_oxygenfree',
  soluble: 'cls:base_alkali', insoluble: 'cls:base_insoluble',
  normal: 'cls:salt_normal', acidic_salt: 'cls:salt_acidic', basic_salt: 'cls:salt_basic',
};

export async function resolveSubstancePreview(
  ref: string,
  locale: string,
  context?: PreviewContext,
): Promise<ResolvedOntPreview> {
  const id = extractRefId(ref);
  const loc = locale as SupportedLocale;

  let substances;
  try {
    substances = await loadSubstancesIndex(loc);
  } catch {
    substances = [];
  }

  // Substance index entries have id like "sub:hcl" or bare "hcl" — match flexibly
  const entry = substances.find(s => s.id === ref || s.id === `sub:${id}` || s.id === id);

  if (!entry) {
    return {
      target: { ref, subjectKind: 'entity', canonicalHref: buildCanonicalHref(ref, locale) ?? undefined },
      data: { title: id },
    };
  }

  const canonicalHref = buildCanonicalHref(ref, locale);
  const title = entry.name ?? entry.formula;
  const subtitle = entry.name ? entry.formula : undefined;

  const facts: PreviewFact[] = [];

  // Profile-driven facts
  const profile = context?.profile ?? deriveProfileFromClass(entry.class, entry.subclass);

  if (profile === 'acid_base') {
    const pKa = getEntityCharValue(entry.characteristics, 'concept:pKa', context?.deprotonationStep);
    if (pKa !== undefined) {
      facts.push({ label: 'pKa', value: String(pKa) });
    }
  } else if (profile === 'solubility') {
    const solTag = entry.tags?.find(t => t === 'soluble' || t === 'sparingly_soluble' || t === 'insoluble');
    if (solTag) {
      facts.push({ label: 'Solubility', value: solTag });
    }
  }

  // Class/subclass — resolve to localized concept names as chips
  let conceptOverlay;
  try { conceptOverlay = await loadConceptOverlay(loc); } catch { conceptOverlay = null; }

  const chips: { label: string; variant?: 'default' | 'primary' | 'muted' }[] = [];
  if (entry.class) {
    const classConceptId = CLASS_TO_CONCEPT[entry.class];
    const className = (classConceptId && conceptOverlay?.[classConceptId]?.name) ?? entry.class;
    chips.push({ label: className, variant: 'primary' });
  }
  if (entry.subclass) {
    const subConceptId = SUBCLASS_TO_CONCEPT[entry.subclass];
    const subName = (subConceptId && conceptOverlay?.[subConceptId]?.name) ?? entry.subclass;
    chips.push({ label: subName, variant: 'muted' });
  }

  return {
    target: {
      ref,
      subjectKind: 'entity',
      canonicalHref: canonicalHref ?? undefined,
    },
    data: {
      title,
      subtitle,
      facts: facts.slice(0, 5),
      chips: chips.length > 0 ? chips.slice(0, 3) : undefined,
    },
  };
}

function deriveProfileFromClass(cls: string, subclass?: string): string {
  if (cls === 'acid') return 'acid_base';
  if (cls === 'salt') return 'solubility';
  if (cls === 'base') return 'solubility';
  if (cls === 'oxide') return 'default';
  return 'default';
}
