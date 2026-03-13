import { useState, useEffect } from 'react';
import type { CalcSubstance } from '../../types/calculations';
import type { SupportedLocale } from '../../types/i18n';
import { loadCalculationsData } from '../../lib/data-loader';
import * as m from '../../paraglide/messages.js';

/** Build the symbolic expansion line: M(H₂SO₄) = 2×Aᵣ(H) + Aᵣ(S) + 4×Aᵣ(O) */
function symbolicExpansion(substance: CalcSubstance): string {
  const terms = substance.composition.map(c =>
    c.count === 1 ? `Aᵣ(${c.element})` : `${c.count}×Aᵣ(${c.element})`,
  );
  return `M(${substance.formula}) = ${terms.join(' + ')}`;
}

/** Build the numeric substitution line: = 2×1 + 32 + 4×16 */
function numericSubstitution(substance: CalcSubstance): string {
  const terms = substance.composition.map(c =>
    c.count === 1 ? String(c.Ar) : `${c.count}×${c.Ar}`,
  );
  return `= ${terms.join(' + ')}`;
}

export default function MolarMassCalculator({ locale }: { locale?: SupportedLocale }) {
  const [substances, setSubstances] = useState<CalcSubstance[]>([]);
  const [selected, setSelected] = useState<CalcSubstance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalculationsData(locale).then(data => {
      const sorted = [...data.calc_substances].sort((a, b) =>
        a.formula.localeCompare(b.formula),
      );
      setSubstances(sorted);
      setLoading(false);
    });
  }, [locale]);

  if (loading) return null;

  const unitLabel = m.calc_molar_mass_unit();

  return (
    <div className="molar-mass-calc">
      <div className="molar-mass-calc__picker">
        <label className="molar-mass-calc__label">
          {m.calc_molar_mass_pick()}
        </label>
        <div className="molar-mass-calc__chips">
          {substances.map(s => (
            <button
              key={s.formula}
              type="button"
              className={`molar-mass-calc__chip ${selected?.formula === s.formula ? 'molar-mass-calc__chip--active' : ''}`}
              onClick={() => setSelected(s)}
            >
              {s.formula}
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
