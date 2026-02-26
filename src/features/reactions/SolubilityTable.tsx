import { useState, useEffect } from 'react';
import type { SolubilityEntry } from '../../types/rules';
import type { Ion } from '../../types/ion';
import type { SupportedLocale } from '../../types/i18n';
import { loadSolubilityRules, loadIons } from '../../lib/data-loader';
import FormulaChip from '../../components/FormulaChip';
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

interface SolubilityTableProps {
  locale?: SupportedLocale;
}

export default function SolubilityTable({ locale = 'ru' }: SolubilityTableProps) {
  const [entries, setEntries] = useState<SolubilityEntry[]>([]);
  const [ionMap, setIonMap] = useState<Map<string, Ion>>(new Map());
  const [loading, setLoading] = useState(true);
  const [highlightRow, setHighlightRow] = useState<string | null>(null);
  const [highlightCol, setHighlightCol] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadSolubilityRules(), loadIons(locale)]).then(([sol, ions]) => {
      const iMap = new Map<string, Ion>();
      const idToFormula = new Map<string, string>();
      for (const ion of ions) {
        iMap.set(ion.formula, ion);
        idToFormula.set(ion.id, ion.formula);
      }
      // Convert ion.id format (Na_plus) → formula format (Na⁺)
      const mapped = sol.map(e => ({
        ...e,
        cation: idToFormula.get(e.cation) ?? e.cation,
        anion: idToFormula.get(e.anion) ?? e.anion,
      }));
      setEntries(mapped);
      setIonMap(iMap);
      setLoading(false);
    });
  }, [locale]);

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
              <span className="sol-table__corner-label sol-table__corner-anion">{m.sol_corner_anions()}</span>
              <span className="sol-table__corner-label sol-table__corner-cation">{m.sol_corner_cations()}</span>
            </th>
            {anions.map(anion => {
              const ion = ionMap.get(anion);
              const isHl = highlightCol === anion;
              return (
                <th
                  key={anion}
                  className={`sol-table__anion-header ${isHl ? 'sol-table__header--highlight' : ''}`}
                  onClick={() => {
                    setHighlightCol(highlightCol === anion ? null : anion);
                    setHighlightRow(null);
                  }}
                >
                  <FormulaChip
                    formula={anion}
                    ionType="anion"
                    ionId={ion?.id}
                    name={ion?.name_ru}
                  />
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
                  className={`sol-table__cation-header ${isRowHl ? 'sol-table__header--highlight' : ''}`}
                  onClick={() => {
                    setHighlightRow(highlightRow === cation ? null : cation);
                    setHighlightCol(null);
                  }}
                >
                  <FormulaChip
                    formula={cation}
                    ionType="cation"
                    ionId={catIon?.id}
                    name={catIon?.name_ru}
                  />
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
        <span className="sol-legend__item"><span className="sol-legend__swatch sol-legend__swatch--soluble"></span>{m.sol_legend_soluble()}</span>
        <span className="sol-legend__item"><span className="sol-legend__swatch sol-legend__swatch--insoluble"></span>{m.sol_legend_insoluble()}</span>
        <span className="sol-legend__item"><span className="sol-legend__swatch sol-legend__swatch--slightly"></span>{m.sol_legend_slightly()}</span>
        <span className="sol-legend__item"><span className="sol-legend__swatch sol-legend__swatch--decomposes"></span>{m.sol_legend_decomposes()}</span>
      </div>
    </div>
  );
}
