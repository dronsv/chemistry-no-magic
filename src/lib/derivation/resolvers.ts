import type { Element } from '../../types/element';
import type { QRef, ReasonStep } from '../../types/derivation';

// ── Ontology access interface ────────────────────────────────────

export interface OntologyAccess {
  elements: Element[];
  parseFormula: (ascii: string) => Record<string, number>;
  /** Entity ref → ASCII formula (substances, ions, any entity with a formula). */
  entityFormulas: Map<string, string>;
}

// ── Lookup resolver ──────────────────────────────────────────────

export interface LookupResult {
  qref: QRef;
  value: number;
  step: ReasonStep & { type: 'lookup' };
}

/**
 * Resolve a quantity by direct ontology lookup.
 * MVP: supports element → q:relative_atomic_mass only.
 */
export function resolveLookup(
  target: QRef,
  ontology: OntologyAccess,
): LookupResult | null {
  if (target.quantity !== 'q:relative_atomic_mass') return null;
  const ctx = target.context;
  if (!ctx || ctx.system_type !== 'element' || !ctx.entity_ref) return null;

  const symbol = ctx.entity_ref.replace('element:', '');
  const el = ontology.elements.find(e => e.symbol === symbol);
  if (!el) return null;

  return {
    qref: target,
    value: el.atomic_mass,
    step: { type: 'lookup', qref: target, value: el.atomic_mass, source: `element:${symbol}` },
  };
}

// ── Decompose resolver ───────────────────────────────────────────

export interface DecomposeResultItem {
  element: string;
  count: number;
  elementRef: string;          // 'element:O'
  arQRef: QRef;                // q:relative_atomic_mass for this element
  countQRef: QRef;             // q:atom_count_in_composition for this element
}

export interface DecomposeResult {
  items: DecomposeResultItem[];
  step: ReasonStep & { type: 'decompose' };
}

/**
 * Decompose an entity into its elemental components.
 * Returns structural data only (element + count). Ar is NOT looked up here —
 * that's the responsibility of the caller via resolveLookup().
 */
export function resolveDecompose(
  entityRef: string,
  ontology: OntologyAccess,
): DecomposeResult | null {
  const formula = ontology.entityFormulas.get(entityRef);
  if (!formula) return null;

  const counts = ontology.parseFormula(formula);
  const items: DecomposeResultItem[] = [];

  for (const [symbol, count] of Object.entries(counts)) {
    // Verify element exists in ontology
    if (!ontology.elements.some(e => e.symbol === symbol)) return null;

    items.push({
      element: symbol,
      count,
      elementRef: `element:${symbol}`,
      arQRef: {
        quantity: 'q:relative_atomic_mass',
        context: { system_type: 'element', entity_ref: `element:${symbol}` },
      },
      countQRef: {
        quantity: 'q:atom_count_in_composition',
        context: {
          system_type: 'substance_component',
          entity_ref: `element:${symbol}`,
          parent_ref: entityRef,
          bindings: { component: `element:${symbol}` },
        },
      },
    });
  }

  return {
    items,
    step: {
      type: 'decompose',
      sourceRef: entityRef,
      components: items.map(i => ({ element: i.element, count: i.count })),
    },
  };
}
