// src/lib/ont-preview/adapters/formula-variable-preview.ts
import type { ResolvedOntPreview, PreviewFact } from '../../../types/ont-preview';
import type { Variable } from '../../../types/formula';
import type { SupportedLocale } from '../../../types/i18n';
import { loadQuantityNames, loadSubstancesIndex, loadElements, loadIons } from '../../data-loader';
import { extractRefId, resolveRefKind } from '../../ont-ref-registry';

export async function resolveFormulaVariablePreview(
  variable: Variable,
  formulaId: string,
  locale: string,
): Promise<ResolvedOntPreview> {
  const loc = locale as SupportedLocale;

  // Priority 1: explanation_overrides[locale]
  const override = variable.explanation_overrides?.[locale];
  if (override) {
    return {
      target: { ref: `formula_var:${formulaId}:${variable.symbol}`, subjectKind: 'formula_variable' },
      data: {
        title: variable.display_symbol ?? variable.symbol,
        description: override,
      },
    };
  }

  // Load quantity names
  let quantityNames: Record<string, string> = {};
  try {
    quantityNames = await loadQuantityNames(loc);
  } catch {
    // silent fallback
  }

  const quantityName = quantityNames[variable.quantity];
  const unitName = quantityNames[variable.unit];

  const facts: PreviewFact[] = [];

  if (quantityName) {
    facts.push({ label: 'Quantity', value: quantityName });
  } else if (variable.quantity) {
    facts.push({ label: 'Quantity', value: extractRefId(variable.quantity) });
  }

  // Priority 2: compose from quantity name + binding entity name
  let bindingDescription: string | undefined;
  if (variable.binding) {
    const { ref, mode } = variable.binding;
    const bindingKind = resolveRefKind(ref);
    const bindingId = extractRefId(ref);

    if (mode === 'concrete_entity') {
      try {
        if (bindingKind === 'element') {
          const elements = await loadElements(loc);
          const el = elements.find(e => e.symbol === bindingId);
          if (el) bindingDescription = el.name ?? bindingId;
        } else if (bindingKind === 'substance') {
          const substances = await loadSubstancesIndex(loc);
          const sub = substances.find(
            s => s.id === ref || s.id === `sub:${bindingId}` || s.id === bindingId,
          );
          if (sub) bindingDescription = sub.name ?? sub.formula;
        } else if (bindingKind === 'ion') {
          const ions = await loadIons(loc);
          const ion = ions.find(i => i.id === bindingId);
          if (ion) bindingDescription = ion.name;
        }
      } catch {
        // silent — fall through to symbol fallback
      }
    } else if (mode === 'abstract_class' || mode === 'contextual_role') {
      bindingDescription = bindingId;
    }

    if (bindingDescription) {
      facts.push({ label: 'For', value: bindingDescription });
    }
  }

  if (unitName) {
    facts.push({ label: 'Unit', value: unitName });
  } else if (variable.unit) {
    facts.push({ label: 'Unit', value: extractRefId(variable.unit) });
  }

  // Priority 3: symbol fallback
  const title = variable.display_symbol ?? variable.symbol;

  // Description: compose from quantity + binding when no override
  let description: string | undefined;
  if (quantityName && bindingDescription) {
    description = `${quantityName} (${bindingDescription})`;
  } else if (quantityName) {
    description = quantityName;
  }

  return {
    target: { ref: `formula_var:${formulaId}:${variable.symbol}`, subjectKind: 'formula_variable' },
    data: {
      title,
      description,
      facts: facts.slice(0, 5),
    },
  };
}
