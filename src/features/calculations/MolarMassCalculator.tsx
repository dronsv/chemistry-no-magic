import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../../types/i18n';
import type { ReasonStep } from '../../types/derivation';
import { loadSubstancesIndex, loadIons, loadElements, loadFormulas, loadConstants } from '../../lib/data-loader';
import { parseFormula, unicodeToAscii, stripIonCharge } from '../../lib/formula-parser';
import { toConstantsDict } from '../../lib/formula-evaluator';
import { deriveQuantity } from '../../lib/derivation/derive-quantity';
import type { OntologyAccess } from '../../lib/derivation/resolvers';
import FormulaChip from '../../components/FormulaChip';
import * as m from '../../paraglide/messages.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompositionEntry {
  element: string;
  Ar: number;
  count: number;
}

interface MolarMassItem {
  formula: string;   // display formula (Unicode)
  name?: string;     // localized substance name
  composition: CompositionEntry[];
  M: number;
}

// ---------------------------------------------------------------------------
// Build molar mass item via deriveQuantity
// ---------------------------------------------------------------------------

function buildItem(
  entityRef: string,
  displayFormula: string,
  ontology: OntologyAccess,
  formulas: import('../../types/formula').ComputableFormula[],
  constants: import('../../types/eval-trace').ConstantsDict,
  name?: string,
): MolarMassItem | null {
  try {
    const result = deriveQuantity({
      target: {
        quantity: 'q:molar_mass',
        context: { system_type: 'substance', entity_ref: entityRef },
      },
      knowns: [],
      formulas,
      constants,
      ontology,
    });

    // Extract composition from decompose + lookup steps in trace
    const decompStep = result.trace.find(
      (s): s is ReasonStep & { type: 'decompose' } => s.type === 'decompose',
    );
    const lookupSteps = result.trace.filter(
      (s): s is ReasonStep & { type: 'lookup' } => s.type === 'lookup',
    );

    if (!decompStep) return null;

    // Match lookup Ar values to decompose components
    const composition: CompositionEntry[] = decompStep.components.map(c => {
      const lookup = lookupSteps.find(
        l => l.source === `element:${c.element}`,
      );
      return {
        element: c.element,
        count: c.count,
        Ar: Math.round(lookup?.value ?? 0),
      };
    });

    return {
      formula: displayFormula,
      composition,
      M: Math.round(result.value * 100) / 100,
      name,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MolarMassCalculator({ locale }: { locale?: SupportedLocale }) {
  const [items, setItems] = useState<MolarMassItem[]>([]);
  const [selected, setSelected] = useState<MolarMassItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadSubstancesIndex(locale),
      loadIons(locale),
      loadElements(),
      loadFormulas(),
      loadConstants(),
    ]).then(([substances, ions, elements, formulas, rawConstants]) => {
      const constants = toConstantsDict(rawConstants);

      // Build ontology access adapter
      const entityFormulas = new Map<string, string>();
      for (const s of substances) {
        const ascii = unicodeToAscii(s.formula);
        entityFormulas.set(`substance:${ascii}`, ascii);
      }
      for (const ion of ions) {
        const stripped = stripIonCharge(ion.formula);
        const ascii = unicodeToAscii(stripped);
        entityFormulas.set(`ion:${ascii}`, ascii);
      }

      const ontology: OntologyAccess = { elements, parseFormula, entityFormulas };

      const seen = new Set<string>();
      const result: MolarMassItem[] = [];

      for (const s of substances) {
        if (seen.has(s.formula)) continue;
        const ascii = unicodeToAscii(s.formula);
        const item = buildItem(`substance:${ascii}`, s.formula, ontology, formulas, constants, s.name);
        if (item) {
          seen.add(s.formula);
          result.push(item);
        }
      }

      for (const ion of ions) {
        const stripped = stripIonCharge(ion.formula);
        if (seen.has(stripped)) continue;
        const ascii = unicodeToAscii(stripped);
        const item = buildItem(`ion:${ascii}`, stripped, ontology, formulas, constants, ion.name);
        if (item) {
          seen.add(stripped);
          result.push(item);
        }
      }

      result.sort((a, b) => (a.name ?? a.formula).localeCompare(b.name ?? b.formula));
      setItems(result);

      // Default: H₂O
      const h2o = result.find(i => i.formula === 'H₂O');
      setSelected(h2o ?? result[0] ?? null);

      setLoading(false);
    });
  }, [locale]);

  if (loading) return null;

  const unitLabel = m.calc_molar_mass_unit();

  return (
    <div className="molar-mass-calc">
      <div className="molar-mass-calc__selector">
        <select
          className="molar-mass-calc__select"
          value={selected?.formula ?? ''}
          onChange={e => {
            const item = items.find(i => i.formula === e.target.value);
            if (item) setSelected(item);
          }}
        >
          {items.map(item => (
            <option key={item.formula} value={item.formula}>
              {item.name ? `${item.name} (${item.formula})` : item.formula}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="molar-mass-calc__formula">
          <span className="molar-mass-calc__lhs">
            M(<FormulaChip formula={selected.formula} locale={locale} />)
          </span>
          <span className="molar-mass-calc__eq">=</span>
          {selected.composition.map((c, i) => (
            <span key={c.element} className="molar-mass-calc__term">
              {i > 0 && <span className="molar-mass-calc__plus"> + </span>}
              <span className="molar-mass-calc__ar">
                Aᵣ(<FormulaChip formula={c.element} elementId={c.element} locale={locale} />)
              </span>
              <span className="molar-mass-calc__val">={c.Ar}</span>
              <span className="molar-mass-calc__mul"> × {c.count}</span>
            </span>
          ))}
          <span className="molar-mass-calc__eq">=</span>
          <span className="molar-mass-calc__result">
            {selected.M} {unitLabel}
          </span>
        </div>
      )}
    </div>
  );
}
