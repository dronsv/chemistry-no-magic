import { useState, useEffect } from 'react';
import type { SolubilityEntry } from '../../types/rules';
import type { Ion } from '../../types/ion';
import { loadSolubilityRules, loadIons } from '../../lib/data-loader';
import * as m from '../../paraglide/messages.js';
import './solubility-table.css';

const SOLUBILITY_LABELS: Record<string, () => string> = {
  soluble: m.sol_soluble,
  insoluble: m.sol_insoluble,
  slightly_soluble: m.sol_slightly_soluble,
  decomposes: () => '—',
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

// Unicode superscript/subscript ranges
const SUPERSCRIPTS = '\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079\u207A\u207B';
const SUBSCRIPTS = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';

/** Render ion formula with HTML <sup>/<sub> for proper classical notation. */
function renderIonFormula(formula: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < formula.length) {
    const ch = formula[i];
    if (SUPERSCRIPTS.includes(ch)) {
      // Collect consecutive superscript chars
      let sup = '';
      while (i < formula.length && SUPERSCRIPTS.includes(formula[i])) {
        sup += decodeSuperscript(formula[i]);
        i++;
      }
      parts.push(<sup key={key++} className="sol-ion__charge">{sup}</sup>);
    } else if (SUBSCRIPTS.includes(ch)) {
      let sub = '';
      while (i < formula.length && SUBSCRIPTS.includes(formula[i])) {
        sub += decodeSubscript(formula[i]);
        i++;
      }
      parts.push(<sub key={key++} className="sol-ion__sub">{sub}</sub>);
    } else {
      // Regular char — collect consecutive regular chars
      let text = '';
      while (i < formula.length && !SUPERSCRIPTS.includes(formula[i]) && !SUBSCRIPTS.includes(formula[i])) {
        text += formula[i];
        i++;
      }
      parts.push(<span key={key++}>{text}</span>);
    }
  }
  return parts;
}

function decodeSuperscript(ch: string): string {
  const map: Record<string, string> = {
    '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3',
    '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7',
    '\u2078': '8', '\u2079': '9', '\u207A': '+', '\u207B': '\u2212',
  };
  return map[ch] ?? ch;
}

function decodeSubscript(ch: string): string {
  return String(ch.charCodeAt(0) - 0x2080);
}

export default function SolubilityTable() {
  const [entries, setEntries] = useState<SolubilityEntry[]>([]);
  const [ionMap, setIonMap] = useState<Map<string, Ion>>(new Map());
  const [loading, setLoading] = useState(true);
  const [highlightRow, setHighlightRow] = useState<string | null>(null);
  const [highlightCol, setHighlightCol] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadSolubilityRules(), loadIons()]).then(([sol, ions]) => {
      setEntries(sol);
      const iMap = new Map<string, Ion>();
      for (const ion of ions) iMap.set(ion.formula, ion);
      setIonMap(iMap);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  const lookup = new Map<string, SolubilityEntry>();
  for (const e of entries) {
    lookup.set(`${e.cation}|${e.anion}`, e);
  }

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
            <th className="sol-table__corner">
              <span className="sol-table__corner-label sol-table__corner-anion">анионы →</span>
              <span className="sol-table__corner-label sol-table__corner-cation">↓ катионы</span>
            </th>
            {anions.map(anion => {
              const ion = ionMap.get(anion);
              const isHl = highlightCol === anion;
              return (
                <th
                  key={anion}
                  className={`sol-table__anion-header sol-ion sol-ion--anion ${isHl ? 'sol-table__header--highlight' : ''}`}
                  title={ion?.name_ru}
                  onClick={() => {
                    setHighlightCol(highlightCol === anion ? null : anion);
                    setHighlightRow(null);
                  }}
                >
                  {renderIonFormula(anion)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {cations.map(cation => {
            const catIon = ionMap.get(cation);
            const isRowHl = highlightRow === cation;
            return (
              <tr key={cation}>
                <th
                  className={`sol-table__cation-header sol-ion sol-ion--cation ${isRowHl ? 'sol-table__header--highlight' : ''}`}
                  title={catIon?.name_ru}
                  onClick={() => {
                    setHighlightRow(highlightRow === cation ? null : cation);
                    setHighlightCol(null);
                  }}
                >
                  {renderIonFormula(cation)}
                </th>
                {anions.map(anion => {
                  const entry = lookup.get(`${cation}|${anion}`);
                  const sol = entry?.solubility;
                  const isHighlighted = highlightRow === cation || highlightCol === anion;
                  const catName = ionMap.get(cation)?.name_ru ?? cation;
                  const anName = ionMap.get(anion)?.name_ru ?? anion;
                  const solLabel = sol ? SOLUBILITY_LABELS[sol]?.() ?? '' : '';
                  return (
                    <td
                      key={anion}
                      className={`sol-cell ${sol ? SOLUBILITY_CLASSES[sol] : ''} ${isHighlighted ? 'sol-cell--highlight' : ''}`}
                      onClick={() => handleCellClick(cation, anion)}
                      title={sol ? `${catName} + ${anName}: ${solLabel}` : ''}
                    >
                      {solLabel}
                    </td>
                  );
                })}
              </tr>
            );
          })}
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
