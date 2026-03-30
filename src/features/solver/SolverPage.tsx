import { useState, useEffect, useMemo } from 'react';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { Element } from '../../types/element';
import type { FormulaLookup } from '../../types/formula-lookup';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { ReasoningQuery, ReasonStep, ReasoningResult } from '../../types/derivation';
import type { SupportedLocale } from '../../types/i18n';
import {
  loadSubstancesIndex,
  loadElements,
  loadFormulaLookup,
  loadFormulas,
  loadConstants,
  loadDataFile,
} from '../../lib/data-loader';
import { FormulaLookupProvider } from '../../components/ChemText';
import FormulaChip from '../../components/FormulaChip';
import { solveQuery } from '../../lib/derivation/query-solver';
import { toConstantsDict } from '../../lib/formula-evaluator';
import { parseFormula } from '../../lib/formula-parser';
import * as m from '../../paraglide/messages.js';
import StepsTrace from './StepsTrace';
import './solver.css';

interface IndicatorRule {
  id: string;
  indicator: string;
  mapping: Array<{ input: string; output_color: string }>;
}

const INDICATOR_OPTIONS = [
  { id: 'ind:litmus', label: () => m.solver_ind_litmus() },
  { id: 'ind:phenolphthalein', label: () => m.solver_ind_phenolphthalein() },
  { id: 'ind:methyl_orange', label: () => m.solver_ind_methyl_orange() },
];

const COLOR_LABELS: Record<string, () => string> = {
  'color:red': () => m.solver_color_red(),
  'color:blue': () => m.solver_color_blue(),
  'color:violet': () => m.solver_color_violet(),
  'color:crimson': () => m.solver_color_crimson(),
  'color:colorless': () => m.solver_color_colorless(),
  'color:orange': () => m.solver_color_orange(),
  'color:yellow': () => m.solver_color_yellow(),
};

function colorCssClass(color: string): string {
  const name = color.replace('color:', '');
  return `solver-color-chip--${name}`;
}

export default function SolverPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);
  const [substances, setSubstances] = useState<SubstanceIndexEntry[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [formulas, setFormulas] = useState<ComputableFormula[]>([]);
  const [constantsList, setConstantsList] = useState<PhysicalConstant[]>([]);
  const [indicatorRules, setIndicatorRules] = useState<IndicatorRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [acidId, setAcidId] = useState('');
  const [baseId, setBaseId] = useState('');
  const [acidMassFraction, setAcidMassFraction] = useState('10');
  const [acidSolutionMass, setAcidSolutionMass] = useState('100');
  const [baseMassFraction, setBaseMassFraction] = useState('5');
  const [baseSolutionMass, setBaseSolutionMass] = useState('200');
  const [indicatorId, setIndicatorId] = useState('ind:litmus');

  // Result
  const [result, setResult] = useState<ReasoningResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadSubstancesIndex(locale),
      loadElements(locale),
      loadFormulaLookup(),
      loadFormulas(),
      loadConstants(),
      loadDataFile<IndicatorRule[]>('rules/indicator_response_rules.json'),
    ])
      .then(([subs, elems, lookup, fmls, consts, indRules]) => {
        setSubstances(subs);
        setElements(elems);
        setFormulaLookup(lookup);
        setFormulas(fmls);
        setConstantsList(consts);
        setIndicatorRules(indRules);
        setLoading(false);

        // Default selections
        const acids = subs.filter(s => s.class === 'acid');
        const bases = subs.filter(s => s.class === 'base');
        if (acids.length > 0) setAcidId(acids[0].id);
        if (bases.length > 0) setBaseId(bases[0].id);
      })
      .catch(() => setLoading(false));
  }, []);

  const acids = useMemo(
    () => substances.filter(s => s.class === 'acid').sort((a, b) => a.formula.localeCompare(b.formula)),
    [substances],
  );
  const bases = useMemo(
    () => substances.filter(s => s.class === 'base').sort((a, b) => a.formula.localeCompare(b.formula)),
    [substances],
  );

  const acidSub = useMemo(() => substances.find(s => s.id === acidId), [substances, acidId]);
  const baseSub = useMemo(() => substances.find(s => s.id === baseId), [substances, baseId]);

  const canSolve =
    acidId &&
    baseId &&
    Number(acidMassFraction) > 0 &&
    Number(acidSolutionMass) > 0 &&
    Number(baseMassFraction) > 0 &&
    Number(baseSolutionMass) > 0;

  function handleSolve() {
    setError(null);
    setResult(null);

    try {
      // Build entity formula map from substances
      const entityFormulas = new Map<string, string>();
      for (const s of substances) {
        // sub:hcl -> substance:hcl, formula in ASCII
        const ref = `substance:${s.id.replace(/^sub:/, '')}`;
        // Convert Unicode formula to ASCII for parser
        const ascii = s.formula.replace(/[\u2080-\u2089]/g, ch =>
          String(ch.charCodeAt(0) - 0x2080),
        );
        entityFormulas.set(ref, ascii);
      }

      const ontology = {
        elements,
        parseFormula,
        entityFormulas,
      };

      const constants = toConstantsDict(constantsList);

      const acidEntityId = acidId.replace(/^sub:/, '');
      const baseEntityId = baseId.replace(/^sub:/, '');

      const query: ReasoningQuery = {
        system: {
          type: 'mixing',
          participants: [
            {
              role: 'acid',
              entity: `sub:${acidEntityId}`,
              given: [
                { quantity: 'q:mass_fraction', value: Number(acidMassFraction) / 100 },
                { quantity: 'q:mass', role: 'solution', value: Number(acidSolutionMass) },
              ],
            },
            {
              role: 'base',
              entity: `sub:${baseEntityId}`,
              given: [
                { quantity: 'q:mass_fraction', value: Number(baseMassFraction) / 100 },
                { quantity: 'q:mass', role: 'solution', value: Number(baseSolutionMass) },
              ],
            },
          ],
        },
        find: { fact: 'indicator_color', params: { indicator: indicatorId } },
      };

      const res = solveQuery(query, {
        formulas,
        constants,
        ontology,
        indicatorRules,
      });

      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return <div className="solver-loading">{m.loading()}</div>;
  }

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="solver-page">
        <h1 className="solver-page__title">{m.solver_title()}</h1>
        <p className="solver-page__intro">{m.solver_description()}</p>

        {/* Step 1: System type (currently only mixing) */}
        <div className="solver-step">
          <div className="solver-step__label">{m.solver_step_system()}</div>
          <div className="solver-radios">
            <label className="solver-radio solver-radio--active">
              <input type="radio" name="system" checked readOnly />
              {m.solver_mixing()}
            </label>
          </div>
        </div>

        {/* Step 2: Participants */}
        <div className="solver-step">
          <div className="solver-step__label">{m.solver_step_participants()}</div>
          <div className="solver-participants">
            {/* Acid card */}
            <div className="solver-card">
              <div className="solver-card__title">
                <span className="solver-card__role--acid">{m.solver_acid()}</span>
              </div>
              <div className="solver-card__field">
                <label>{m.solver_select_acid()}</label>
                <select value={acidId} onChange={e => setAcidId(e.target.value)}>
                  {acids.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.formula} {a.name ? `- ${a.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {acidSub && (
                <div className="solver-card__formula-preview">
                  <FormulaChip formula={acidSub.formula} substanceId={acidSub.id.replace(/^sub:/, '')} />
                </div>
              )}
              <div className="solver-card__field">
                <label>{m.solver_mass_fraction()}</label>
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={acidMassFraction}
                  onChange={e => setAcidMassFraction(e.target.value)}
                />
              </div>
              <div className="solver-card__field">
                <label>{m.solver_solution_mass()}</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={acidSolutionMass}
                  onChange={e => setAcidSolutionMass(e.target.value)}
                />
              </div>
            </div>

            {/* Base card */}
            <div className="solver-card">
              <div className="solver-card__title">
                <span className="solver-card__role--base">{m.solver_base()}</span>
              </div>
              <div className="solver-card__field">
                <label>{m.solver_select_base()}</label>
                <select value={baseId} onChange={e => setBaseId(e.target.value)}>
                  {bases.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.formula} {b.name ? `- ${b.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {baseSub && (
                <div className="solver-card__formula-preview">
                  <FormulaChip formula={baseSub.formula} substanceId={baseSub.id.replace(/^sub:/, '')} />
                </div>
              )}
              <div className="solver-card__field">
                <label>{m.solver_mass_fraction()}</label>
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={baseMassFraction}
                  onChange={e => setBaseMassFraction(e.target.value)}
                />
              </div>
              <div className="solver-card__field">
                <label>{m.solver_solution_mass()}</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={baseSolutionMass}
                  onChange={e => setBaseSolutionMass(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: What to find */}
        <div className="solver-step">
          <div className="solver-step__label">{m.solver_find()}</div>
          <div className="solver-indicator">
            <label>{m.solver_indicator()}</label>
            <select value={indicatorId} onChange={e => setIndicatorId(e.target.value)}>
              {INDICATOR_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Solve button */}
        <div className="solver-actions">
          <button
            type="button"
            className="solver-solve-btn"
            disabled={!canSolve}
            onClick={handleSolve}
          >
            {m.solver_solve()}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="solver-error">{error}</div>
        )}

        {/* Result */}
        {result && (
          <div className="solver-result">
            <div className="solver-result__header">
              <span className="solver-result__label">{m.solver_answer()}</span>
              <span className="solver-result__value">
                <ColorChip color={String(result.answer)} />
              </span>
            </div>

            <StepsTrace steps={result.steps} intermediates={result.intermediates} />
          </div>
        )}
      </div>
    </FormulaLookupProvider>
  );
}

function ColorChip({ color }: { color: string }) {
  const label = COLOR_LABELS[color]?.() ?? color;
  const cssClass = colorCssClass(color);
  return (
    <span className={`solver-color-chip ${cssClass}`}>
      <span className="solver-color-chip__dot" />
      {label}
    </span>
  );
}
