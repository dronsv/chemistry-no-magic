import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { SupportedLocale } from '../types/i18n';
import type { OntRef } from '../types/ontology-ref';
import { toOntRefStr } from '../lib/ontology-ref';
import { localizeUrl } from '../lib/i18n';
import { useFormulaLookup } from './ChemText';
import FormulaChip from './FormulaChip';
import ConceptRef from './ConceptRef';
import type { FormulaLookup } from '../types/formula-lookup';
import './ontology-ref.css';

// ---------------------------------------------------------------------------
// Quantity/unit name lookup context
// ---------------------------------------------------------------------------

/** Maps full IDs ("q:molar_mass", "unit:g_per_mol") to localized names. */
export type QuantityLookup = Record<string, string>;

const QuantityLookupCtx = createContext<QuantityLookup | null>(null);

export function QuantityLookupProvider({
  value,
  children,
}: {
  value: QuantityLookup | null;
  children: ReactNode;
}) {
  return (
    <QuantityLookupCtx.Provider value={value}>
      {children}
    </QuantityLookupCtx.Provider>
  );
}

export function useQuantityLookup(): QuantityLookup | null {
  return useContext(QuantityLookupCtx);
}

/** Build reverse map: `type:id` → display formula string */
function buildReverseMap(lookup: FormulaLookup | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!lookup) return map;
  for (const [formula, entry] of Object.entries(lookup)) {
    map.set(`${entry.type}:${entry.id}`, formula);
  }
  return map;
}

interface OntologyRefProps {
  ontRef: OntRef;           // not 'ref' — that's reserved by React
  variant?: 'chip' | 'card';
  form?: string;
  surface?: string;
  locale?: SupportedLocale;
}

export default function OntologyRef({ ontRef, variant = 'chip', form, surface, locale }: OntologyRefProps) {
  const formulaLookup = useFormulaLookup();
  const quantityLookup = useQuantityLookup();

  const reverseMap = useMemo(() => buildReverseMap(formulaLookup), [formulaLookup]);

  const { kind, id } = ontRef;

  // Element: symbol IS the formula; navigate to element detail page
  if (kind === 'element') {
    return (
      <FormulaChip
        formula={id}
        substanceClass="simple"
        elementId={id}
        locale={locale}
      />
    );
  }

  // Substance: reverse-lookup formula from id
  if (kind === 'substance') {
    const formula = reverseMap.get(`substance:${id}`);
    if (!formula) return <span className="ont-ref ont-ref--substance">{surface ?? id}</span>;
    const entry = formulaLookup?.[formula];
    return (
      <FormulaChip
        formula={formula}
        substanceId={id}
        substanceClass={entry?.cls}
        locale={locale}
      />
    );
  }

  // Ion: reverse-lookup formula from id
  if (kind === 'ion') {
    const formula = reverseMap.get(`ion:${id}`);
    if (!formula) return <span className="ont-ref ont-ref--ion">{surface ?? id}</span>;
    const entry = formulaLookup?.[formula];
    return (
      <FormulaChip
        formula={formula}
        ionId={id}
        ionType={entry?.ionType}
        locale={locale}
      />
    );
  }

  // Concept kinds: delegate to ConceptRef (uses full ontref string as registry key)
  if (
    kind === 'substance_class' ||
    kind === 'element_group' ||
    kind === 'reaction_type' ||
    kind === 'reaction_facet' ||
    kind === 'process' ||
    kind === 'property'
  ) {
    const conceptId = toOntRefStr(ontRef);
    return <ConceptRef id={conceptId} form={form} surface={surface} locale={locale} variant={variant} />;
  }

  // Reaction: inline chip, link to reactions list
  if (kind === 'reaction') {
    const href = localizeUrl('/reactions/', locale ?? 'ru');
    const label = surface ?? id;
    return (
      <a className="ont-ref ont-ref--reaction" href={href}>
        {label}
      </a>
    );
  }

  // Quantity / Unit: styled inline reference with ontology name tooltip
  if (kind === 'quantity' || kind === 'unit') {
    const label = surface ?? id;
    const fullId = kind === 'quantity' ? `q:${id}` : `unit:${id}`;
    const name = quantityLookup?.[fullId];
    return (
      <span className={`ont-ref ont-ref--${kind}`} style={name ? { position: 'relative' } : undefined}>
        {label}
        {name && (
          <span className="ont-ref__tooltip">{name}</span>
        )}
      </span>
    );
  }

  // Context / unknown: plain text fallback
  return <span>{surface ?? id}</span>;
}
