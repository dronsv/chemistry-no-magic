import { useState, useEffect } from 'react';
import type { SolubilityEntry, SolubilityRule, SolubilityRulesFull } from '../../types/rules';
import type { Ion } from '../../types/ion';
import type { SupportedLocale } from '../../types/i18n';
import { loadSolubilityRules, loadSolubilityRulesFull, loadIons } from '../../lib/data-loader';
import { cellMatchesRule } from './solubility-helpers';
import FormulaChip from '../../components/FormulaChip';
import SolubilityRulesPanel from './SolubilityRulesPanel';
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

const COMPACT_CATION_ORDER = [
  'H_plus', 'Na_plus', 'K_plus', 'NH4_plus', 'Ba_2plus', 'Ca_2plus', 'Mg_2plus',
  'Al_3plus', 'Fe_2plus', 'Fe_3plus', 'Cu_2plus', 'Zn_2plus', 'Ag_plus', 'Pb_2plus',
];

const COMPACT_ANION_ORDER = [
  'Cl_minus', 'SO4_2minus', 'NO3_minus', 'CO3_2minus', 'PO4_3minus', 'S_2minus', 'OH_minus', 'SiO3_2minus',
];

interface SolubilityTableProps {
  locale?: SupportedLocale;
  variant?: 'compact' | 'full';
}

export default function SolubilityTable({ locale = 'ru', variant = 'compact' }: SolubilityTableProps) {
  const [entries, setEntries] = useState<SolubilityEntry[]>([]);
  const [ionMap, setIonMap] = useState<Map<string, Ion>>(new Map());
  const [loading, setLoading] = useState(true);
  const [highlightRow, setHighlightRow] = useState<string | null>(null);
  const [highlightCol, setHighlightCol] = useState<string | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [rules, setRules] = useState<SolubilityRule[]>([]);
  const [cationOrder, setCationOrder] = useState<string[]>(COMPACT_CATION_ORDER);
  const [anionOrder, setAnionOrder] = useState<string[]>(COMPACT_ANION_ORDER);

  useEffect(() => {
    const loadData = async () => {
      const ions = await loadIons(locale);
      const iMap = new Map<string, Ion>();
      for (const ion of ions) {
        iMap.set(ion.id, ion);
      }

      if (variant === 'full') {
        const fullData = await loadSolubilityRulesFull();
        setEntries(fullData.pairs);
        setCationOrder(fullData.cation_order);
        setAnionOrder(fullData.anion_order);
        setRules(fullData.rules);
      } else {
        const sol = await loadSolubilityRules();
        setEntries(sol);
        setCationOrder(COMPACT_CATION_ORDER);
        setAnionOrder(COMPACT_ANION_ORDER);
        setRules([]);
      }

      setIonMap(iMap);
      setActiveRuleId(null);
      setHighlightRow(null);
      setHighlightCol(null);
      setLoading(false);
    };
    setLoading(true);
    loadData();
  }, [locale, variant]);

  if (loading) return null;

  const lookup = new Map<string, SolubilityEntry>();
  for (const e of entries) {
    lookup.set(`${e.cation}|${e.anion}`, e);
  }

  // For compact variant, entries use ion.id format already (Na_plus)
  // For full variant, also ion.id format
  const activeRule = activeRuleId ? rules.find(r => r.id === activeRuleId) ?? null : null;

  function getIonFormula(ionId: string): string {
    return ionMap.get(ionId)?.formula ?? ionId;
  }

  function getIonName(ionId: string): string | undefined {
    return ionMap.get(ionId)?.name_ru;
  }

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
      {variant === 'full' && rules.length > 0 && (
        <SolubilityRulesPanel
          rules={rules}
          activeRuleId={activeRuleId}
          onRuleClick={setActiveRuleId}
        />
      )}
      <table className={`sol-table ${variant === 'full' ? 'sol-table--full' : ''}`}>
        <thead>
          <tr>
            <th className="sol-table__corner">
              <span className="sol-table__corner-label sol-table__corner-anion">{m.sol_corner_anions()}</span>
              <span className="sol-table__corner-label sol-table__corner-cation">{m.sol_corner_cations()}</span>
            </th>
            {anionOrder.map(anionId => {
              const ion = ionMap.get(anionId);
              const formula = ion?.formula ?? anionId;
              const isHl = highlightCol === anionId;
              return (
                <th
                  key={anionId}
                  className={`sol-table__anion-header ${isHl ? 'sol-table__header--highlight' : ''}`}
                  onClick={() => {
                    setHighlightCol(highlightCol === anionId ? null : anionId);
                    setHighlightRow(null);
                  }}
                >
                  <FormulaChip
                    formula={formula}
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
          {cationOrder.map(cationId => {
            const catIon = ionMap.get(cationId);
            const catFormula = catIon?.formula ?? cationId;
            const isRowHl = highlightRow === cationId;
            return (
              <tr key={cationId}>
                <th
                  className={`sol-table__cation-header ${isRowHl ? 'sol-table__header--highlight' : ''}`}
                  onClick={() => {
                    setHighlightRow(highlightRow === cationId ? null : cationId);
                    setHighlightCol(null);
                  }}
                >
                  <FormulaChip
                    formula={catFormula}
                    ionType="cation"
                    ionId={catIon?.id}
                    name={catIon?.name_ru}
                  />
                </th>
                {anionOrder.map(anionId => {
                  const entry = lookup.get(`${cationId}|${anionId}`);
                  const sol = entry?.solubility;
                  const isHighlighted = highlightRow === cationId || highlightCol === anionId;
                  const catName = getIonName(cationId) ?? catFormula;
                  const anName = getIonName(anionId) ?? getIonFormula(anionId);
                  const solLabel = sol ? SOLUBILITY_LABELS[sol]?.() ?? '' : '';

                  // Rule highlighting
                  let ruleClass = '';
                  if (activeRule) {
                    const match = cellMatchesRule(cationId, anionId, activeRule);
                    if (match === 'match') ruleClass = 'sol-cell--rule-match';
                    else if (match === 'exception') ruleClass = 'sol-cell--rule-exception';
                  }

                  return (
                    <td
                      key={anionId}
                      className={`sol-cell ${sol ? SOLUBILITY_CLASSES[sol] : ''} ${isHighlighted ? 'sol-cell--highlight' : ''} ${ruleClass}`}
                      onClick={() => handleCellClick(cationId, anionId)}
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
