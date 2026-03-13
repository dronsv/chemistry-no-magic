import { useState, useEffect, useMemo } from 'react';
import type { SupportedLocale } from '../../types/i18n';
import { loadSubstancesIndex, loadIons, loadElements } from '../../lib/data-loader';
import { parseFormula } from '../../lib/formula-parser';
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
// Build molar mass items from formula strings + element Ar map
// ---------------------------------------------------------------------------

function buildItem(
  displayFormula: string,
  arMap: Map<string, number>,
): MolarMassItem | null {
  const ascii = unicodeToAscii(displayFormula);
  const counts = parseFormula(ascii);
  const composition: CompositionEntry[] = [];
  let M = 0;

  for (const [el, count] of Object.entries(counts)) {
    const Ar = arMap.get(el);
    if (Ar === undefined) return null; // unknown element
    composition.push({ element: el, Ar, count });
    M += Ar * count;
  }

  if (composition.length === 0) return null;
  M = Math.round(M * 100) / 100;
  return { formula: displayFormula, composition, M };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function symbolicExpansion(item: MolarMassItem): string {
  const terms = item.composition.map(c =>
    c.count === 1 ? `Aᵣ(${c.element})` : `${c.count}×Aᵣ(${c.element})`,
  );
  return `M(${item.formula}) = ${terms.join(' + ')}`;
}

function numericSubstitution(item: MolarMassItem): string {
  const terms = item.composition.map(c =>
    c.count === 1 ? String(c.Ar) : `${c.count}×${c.Ar}`,
  );
  return `= ${terms.join(' + ')}`;
}

// ---------------------------------------------------------------------------
// Strip ion charge from display formula: SO₄²⁻ → SO₄
// ---------------------------------------------------------------------------

const SUPERSCRIPT_RE = /[\u2070\u00B9\u00B2\u00B3\u2074-\u2079\u207A\u207B]+$/;

function stripCharge(formula: string): string {
  return formula.replace(SUPERSCRIPT_RE, '');
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
        const item = buildItem(s.formula, arMap);
        if (item) {
          seen.add(s.formula);
          result.push(item);
        }
      }

      for (const ion of ions) {
        const stripped = stripCharge(ion.formula);
        if (seen.has(stripped)) continue;
        const item = buildItem(stripped, arMap);
        if (item) {
          seen.add(stripped);
          result.push(item);
        }
      }

      result.sort((a, b) => a.formula.localeCompare(b.formula));
      setItems(result);
      setLoading(false);
    });
  }, [locale]);

  const unitLabel = useMemo(() => m.calc_molar_mass_unit(), []);

  if (loading) return null;

  return (
    <div className="molar-mass-calc">
      <div className="molar-mass-calc__picker">
        <label className="molar-mass-calc__label">
          {m.calc_molar_mass_pick()}
        </label>
        <div className="molar-mass-calc__chips">
          {items.map(item => (
            <button
              key={item.formula}
              type="button"
              className={`molar-mass-calc__chip ${selected?.formula === item.formula ? 'molar-mass-calc__chip--active' : ''}`}
              onClick={() => setSelected(item)}
            >
              {item.formula}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="molar-mass-calc__result">
          <table className="molar-mass-calc__composition">
            <thead>
              <tr>
                <th>{m.calc_molar_mass_element()}</th>
                <th>Aᵣ</th>
                <th>{m.calc_molar_mass_count()}</th>
                <th>Aᵣ × n</th>
              </tr>
            </thead>
            <tbody>
              {selected.composition.map(c => (
                <tr key={c.element}>
                  <td>{c.element}</td>
                  <td>{c.Ar}</td>
                  <td>{c.count}</td>
                  <td>{c.Ar * c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="molar-mass-calc__steps">
            <div className="molar-mass-calc__step">{symbolicExpansion(selected)}</div>
            <div className="molar-mass-calc__step">{numericSubstitution(selected)}</div>
            <div className="molar-mass-calc__step molar-mass-calc__step--result">
              = {selected.M} {unitLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
