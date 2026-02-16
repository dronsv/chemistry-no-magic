import { useState, useEffect } from 'react';
import type { SolubilityEntry } from '../../types/rules';
import { loadSolubilityRules } from '../../lib/data-loader';

const SOLUBILITY_LABELS: Record<string, string> = {
  soluble: 'Р',
  insoluble: 'Н',
  slightly_soluble: 'М',
  decomposes: '—',
};

const SOLUBILITY_CLASSES: Record<string, string> = {
  soluble: 'sol-cell--soluble',
  insoluble: 'sol-cell--insoluble',
  slightly_soluble: 'sol-cell--slightly',
  decomposes: 'sol-cell--decomposes',
};

const CATION_ORDER = [
  'H⁺', 'Na⁺', 'K⁺', 'NH₄⁺', 'Ba²⁺', 'Ca²⁺', 'Mg²⁺',
  'Al³⁺', 'Fe²⁺', 'Fe³⁺', 'Cu²⁺', 'Zn²⁺', 'Ag⁺', 'Pb²⁺',
];

const ANION_ORDER = [
  'Cl⁻', 'SO₄²⁻', 'NO₃⁻', 'CO₃²⁻', 'PO₄³⁻', 'S²⁻', 'OH⁻', 'SiO₃²⁻',
];

export default function SolubilityTable() {
  const [entries, setEntries] = useState<SolubilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightRow, setHighlightRow] = useState<string | null>(null);
  const [highlightCol, setHighlightCol] = useState<string | null>(null);

  useEffect(() => {
    loadSolubilityRules().then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  const lookup = new Map<string, SolubilityEntry>();
  for (const e of entries) {
    lookup.set(`${e.cation}|${e.anion}`, e);
  }

  // Determine which anions are present in data
  const dataAnions = new Set(entries.map(e => e.anion));
  const anions = ANION_ORDER.filter(a => dataAnions.has(a));

  const dataCations = new Set(entries.map(e => e.cation));
  const cations = CATION_ORDER.filter(c => dataCations.has(c));

  function handleCellClick(cation: string, anion: string) {
    if (highlightRow === cation && highlightCol === anion) {
      setHighlightRow(null);
      setHighlightCol(null);
    } else {
      setHighlightRow(cation);
      setHighlightCol(anion);
    }
  }

  return (
    <div className="sol-table-wrapper">
      <table className="sol-table">
        <thead>
          <tr>
            <th className="sol-table__corner"></th>
            {anions.map(anion => (
              <th
                key={anion}
                className={`sol-table__anion-header ${highlightCol === anion ? 'sol-table__header--highlight' : ''}`}
              >
                {anion}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cations.map(cation => (
            <tr key={cation}>
              <th
                className={`sol-table__cation-header ${highlightRow === cation ? 'sol-table__header--highlight' : ''}`}
              >
                {cation}
              </th>
              {anions.map(anion => {
                const entry = lookup.get(`${cation}|${anion}`);
                const sol = entry?.solubility;
                const isHighlighted = highlightRow === cation || highlightCol === anion;
                return (
                  <td
                    key={anion}
                    className={`sol-cell ${sol ? SOLUBILITY_CLASSES[sol] : ''} ${isHighlighted ? 'sol-cell--highlight' : ''}`}
                    onClick={() => handleCellClick(cation, anion)}
                    title={sol ? `${cation} + ${anion}: ${sol}` : ''}
                  >
                    {sol ? SOLUBILITY_LABELS[sol] : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sol-legend">
        <span className="sol-legend__item"><span className="sol-legend__swatch sol-legend__swatch--soluble"></span>Р — растворимое</span>
        <span className="sol-legend__item"><span className="sol-legend__swatch sol-legend__swatch--insoluble"></span>Н — нерастворимое</span>
        <span className="sol-legend__item"><span className="sol-legend__swatch sol-legend__swatch--slightly"></span>М — малорастворимое</span>
        <span className="sol-legend__item"><span className="sol-legend__swatch sol-legend__swatch--decomposes"></span>— — разлагается</span>
      </div>
    </div>
  );
}
