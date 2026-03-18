// src/lib/ont-preview/adapters/formula-preview.ts
import type { ResolvedOntPreview, PreviewContext } from '../../../types/ont-preview';
import type { SupportedLocale } from '../../../types/i18n';
import { loadFormulas, loadConceptOverlay } from '../../data-loader';
import { extractRefId } from '../../ont-ref-registry';
import { formulaToDisplayString } from '../../formula-evaluator';

export async function resolveFormulaPreview(
  ref: string,
  locale: string,
  _context?: PreviewContext,
): Promise<ResolvedOntPreview> {
  const id = extractRefId(ref);
  const loc = locale as SupportedLocale;

  let formulas;
  try {
    formulas = await loadFormulas(loc);
  } catch {
    formulas = [];
  }

  const formula = formulas.find(f => f.id === ref || f.id === `formula:${id}` || f.id === id);

  if (!formula) {
    return {
      target: { ref, subjectKind: 'formula' },
      data: { title: id },
    };
  }

  // Load concept overlay to resolve concept_refs[0] name
  let overlay;
  try {
    overlay = await loadConceptOverlay(loc);
  } catch {
    overlay = null;
  }

  const conceptId = formula.concept_refs?.[0];
  const conceptName = conceptId ? overlay?.[conceptId]?.name : undefined;
  const title = conceptName ?? id;

  const description = formulaToDisplayString(formula);

  const chips = [];
  if (formula.didactic_scope && formula.didactic_scope !== 'generalized') {
    chips.push({ label: formula.didactic_scope, variant: 'muted' as const });
  }

  return {
    target: { ref, subjectKind: 'formula' },
    data: {
      title,
      description: description || undefined,
      chips: chips.length > 0 ? chips : undefined,
    },
  };
}
