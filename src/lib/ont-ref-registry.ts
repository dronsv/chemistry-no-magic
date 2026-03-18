import type { SupportedLocale } from '../types/i18n';
import { localizeUrl } from './i18n';

export type OntRefKind = 'element' | 'substance' | 'ion' | 'domain_concept' |
  'substance_class' | 'reaction_type' | 'formula' | 'unknown';

const PREFIX_MAP: Record<string, OntRefKind> = {
  el: 'element',
  sub: 'substance',
  ion: 'ion',
  concept: 'domain_concept',
  cls: 'substance_class',
  rxtype: 'reaction_type',
  formula: 'formula',
};

export function resolveRefKind(ref: string): OntRefKind {
  const colonIdx = ref.indexOf(':');
  if (colonIdx < 0) return 'unknown';
  const prefix = ref.slice(0, colonIdx);
  return PREFIX_MAP[prefix] ?? 'unknown';
}

export function extractRefId(ref: string): string {
  const colonIdx = ref.indexOf(':');
  return colonIdx >= 0 ? ref.slice(colonIdx + 1) : ref;
}

export function buildCanonicalHref(ref: string, locale: string): string | null {
  const kind = resolveRefKind(ref);
  const id = extractRefId(ref);
  const loc = locale as SupportedLocale;
  switch (kind) {
    case 'element':
      return localizeUrl(`/periodic-table/${id}/`, loc);
    case 'substance':
      return localizeUrl(`/substances/${id}/`, loc);
    // ion: list page exists but no per-ion canonical page in v1
    // substance_class, reaction_type need slug chain from overlay — not resolvable without data
    // domain_concept has no page in v1
    // formula has no standalone page
    default:
      return null;
  }
}
