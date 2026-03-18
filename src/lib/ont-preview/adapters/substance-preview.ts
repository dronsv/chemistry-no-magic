// src/lib/ont-preview/adapters/substance-preview.ts
import type { ResolvedOntPreview, PreviewContext, PreviewFact } from '../../../types/ont-preview';
import type { SupportedLocale } from '../../../types/i18n';
import { loadSubstancesIndex } from '../../data-loader';
import { buildCanonicalHref, extractRefId } from '../../ont-ref-registry';
import { getEntityCharValue } from '../../characteristics-utils';

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

  // Class/subclass always shown
  if (entry.class) {
    facts.push({ label: 'Class', value: entry.class });
  }
  if (entry.subclass) {
    facts.push({ label: 'Subclass', value: entry.subclass });
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
