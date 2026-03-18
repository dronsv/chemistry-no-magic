// src/lib/ont-preview/adapters/element-preview.ts
import type { ResolvedOntPreview, PreviewContext } from '../../../types/ont-preview';
import type { SupportedLocale } from '../../../types/i18n';
import { loadElements } from '../../data-loader';
import { buildCanonicalHref, extractRefId } from '../../ont-ref-registry';
import { getEntityCharValue } from '../../characteristics-utils';

export async function resolveElementPreview(
  ref: string,
  locale: string,
  _context?: PreviewContext,
): Promise<ResolvedOntPreview> {
  const symbol = extractRefId(ref);
  const loc = locale as SupportedLocale;

  let elements;
  try {
    elements = await loadElements(loc);
  } catch {
    elements = [];
  }

  const el = elements.find(e => e.symbol === symbol);

  if (!el) {
    return {
      target: { ref, subjectKind: 'entity', canonicalHref: buildCanonicalHref(ref, locale) ?? undefined },
      data: { title: symbol },
    };
  }

  const canonicalHref = buildCanonicalHref(ref, locale);
  const Z = el.Z;
  const Ar = getEntityCharValue(el.characteristics, 'concept:atomic_mass');
  const electronegativity = getEntityCharValue(el.characteristics, 'concept:electronegativity');

  const facts = [];
  facts.push({ label: 'Z', value: String(Z) });
  if (Ar !== undefined) {
    facts.push({ label: 'Aᵣ', value: String(Ar) });
  }
  if (el.typical_oxidation_states.length > 0) {
    facts.push({
      label: 'Oxidation states',
      value: el.typical_oxidation_states
        .map(s => (s > 0 ? `+${s}` : String(s)))
        .join(', '),
    });
  }
  if (electronegativity !== undefined) {
    facts.push({ label: 'χ', value: String(electronegativity) });
  }

  return {
    target: {
      ref,
      subjectKind: 'entity',
      canonicalHref: canonicalHref ?? undefined,
    },
    data: {
      title: el.name ?? symbol,
      subtitle: symbol,
      facts: facts.slice(0, 5),
    },
  };
}
