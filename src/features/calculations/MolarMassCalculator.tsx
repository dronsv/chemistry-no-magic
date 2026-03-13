import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../../types/i18n';
import { loadSubstancesIndex, loadIons, loadElements } from '../../lib/data-loader';
import { parseFormula } from '../../lib/formula-parser';
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
// Unicode subscript → ASCII for parseFormula
// ---------------------------------------------------------------------------

function unicodeToAscii(formula: string): string {
  return formula.replace(/[\u2080-\u2089]/g, ch =>
    String(ch.charCodeAt(0) - 0x2080),
  );
}

// ---------------------------------------------------------------------------
// Strip ion charge from display formula: SO₄²⁻ → SO₄
// ---------------------------------------------------------------------------

const SUPERSCRIPT_RE = /[\u2070\u00B9\u00B2\u00B3\u2074-\u2079\u207A\u207B]+$/;

function stripCharge(formula: string): string {
  return formula.replace(SUPERSCRIPT_RE, '');
}

// ---------------------------------------------------------------------------
// Build molar mass item from formula + element Ar map
// ---------------------------------------------------------------------------

function buildItem(
  displayFormula: string,
  arMap: Map<string, number>,
  name?: string,
): MolarMassItem | null {
  const ascii = unicodeToAscii(displayFormula);
  const counts = parseFormula(ascii);
  const composition: CompositionEntry[] = [];
  let M = 0;

  for (const [el, count] of Object.entries(counts)) {
    const Ar = arMap.get(el);
    if (Ar === undefined) return null;
    composition.push({ element: el, Ar, count });
    M += Ar * count;
  }

  if (composition.length === 0) return null;
  M = Math.round(M * 100) / 100;
  return { formula: displayFormula, composition, M, name };
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
    ]).then(([substances, ions, elements]) => {
      const arMap = new Map<string, number>();
      for (const el of elements) {
        arMap.set(el.symbol, Math.round(el.atomic_mass));
      }

      const seen = new Set<string>();
      const result: MolarMassItem[] = [];

      for (const s of substances) {
        if (seen.has(s.formula)) continue;
        const item = buildItem(s.formula, arMap, s.name);
        if (item) {
          seen.add(s.formula);
          result.push(item);
        }
      }

      for (const ion of ions) {
        const stripped = stripCharge(ion.formula);
        if (seen.has(stripped)) continue;
        const item = buildItem(stripped, arMap, ion.name);
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
