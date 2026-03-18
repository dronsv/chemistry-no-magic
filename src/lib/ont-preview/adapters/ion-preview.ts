// src/lib/ont-preview/adapters/ion-preview.ts
import type { ResolvedOntPreview, PreviewContext } from '../../../types/ont-preview';
import type { SupportedLocale } from '../../../types/i18n';
import { loadIons } from '../../data-loader';
import { extractRefId } from '../../ont-ref-registry';
import { getEntityCharValue } from '../../characteristics-utils';

export async function resolveIonPreview(
  ref: string,
  locale: string,
  _context?: PreviewContext,
): Promise<ResolvedOntPreview> {
  const id = extractRefId(ref);
  const loc = locale as SupportedLocale;

  let ions;
  try {
    ions = await loadIons(loc);
  } catch {
    ions = [];
  }

  // Ion IDs use full ref format (e.g., "ion:H_plus")
  const ion = ions.find(i => i.id === ref || i.id === id || i.id === `ion:${id}`);

  if (!ion) {
    return {
      target: { ref, subjectKind: 'entity' },
      data: { title: id },
    };
  }

  const charge = getEntityCharValue(ion.characteristics, 'concept:charge');
  const facts = [];

  facts.push({ label: 'Formula', value: ion.formula });

  if (charge !== undefined) {
    facts.push({ label: 'Charge', value: String(charge) });
  }

  facts.push({ label: 'Type', value: ion.type });

  return {
    target: { ref, subjectKind: 'entity' },
    data: {
      title: ion.name,
      subtitle: ion.formula,
      facts: facts.slice(0, 5),
    },
  };
}
