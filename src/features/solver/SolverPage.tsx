import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { Element } from '../../types/element';
import type { FormulaLookup } from '../../types/formula-lookup';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { ReasoningQuery, ReasoningResult } from '../../types/derivation';
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
import { solveQuery } from '../../lib/derivation/query-solver';
import { toConstantsDict } from '../../lib/formula-evaluator';
import { parseFormula } from '../../lib/formula-parser';
import * as m from '../../paraglide/messages.js';
import type { AutocompleteOption } from './SlotAutocomplete';
import type { SlotDataSources } from './sentence-templates';
import { SENTENCE_TEMPLATES, getDefaults } from './sentence-templates';
import SentenceEditor from './SentenceEditor';
import QueryTypeahead from './QueryTypeahead';
import StepsTrace from './StepsTrace';
import './solver.css';

interface IndicatorRule {
  id: string;
  indicator: string;
  mapping: Array<{ input: string; output_color: string }>;
}

// ── Color / medium display ─────────────────────────────────

const COLOR_LABELS: Record<string, () => string> = {
  'color:red': () => m.solver_color_red(),
  'color:blue': () => m.solver_color_blue(),
  'color:violet': () => m.solver_color_violet(),
  'color:crimson': () => m.solver_color_crimson(),
  'color:colorless': () => m.solver_color_colorless(),
  'color:orange': () => m.solver_color_orange(),
  'color:yellow': () => m.solver_color_yellow(),
  'medium:acidic': () => m.solver_medium_acidic(),
  'medium:neutral': () => m.solver_medium_neutral(),
  'medium:alkaline': () => m.solver_medium_alkaline(),
};

function answerDisplay(answer: string | number): { label: string; cssClass: string } {
  if (typeof answer === 'number') return { label: String(answer), cssClass: '' };
  const label = COLOR_LABELS[answer]?.() ?? answer;
  const name = answer.replace(/^(color|medium):/, '');
  return { label, cssClass: `solver-color-chip--${name}` };
}

// ── Indicator names ────────────────────────────────────────

const INDICATOR_LABELS: Record<string, () => string> = {
  'ind:litmus': () => m.solver_ind_litmus(),
  'ind:phenolphthalein': () => m.solver_ind_phenolphthalein(),
  'ind:methyl_orange': () => m.solver_ind_methyl_orange(),
};

// ── Main component ─────────────────────────────────────────

export default function SolverPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);
  const [substances, setSubstances] = useState<SubstanceIndexEntry[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [formulas, setFormulas] = useState<ComputableFormula[]>([]);
  const [constantsList, setConstantsList] = useState<PhysicalConstant[]>([]);
  const [indicatorRules, setIndicatorRules] = useState<IndicatorRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Template + slot state
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [slotValues, setSlotValues] = useState<Record<string, string | number>>({});

  // JSON toggle (power-user mode)
  const [showJson, setShowJson] = useState(false);

  // Result
  const [result, setResult] = useState<ReasoningResult | null>(null);
  const [solveError, setSolveError] = useState<string | null>(null);

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
      })
      .catch(() => setLoading(false));
  }, []);

  // Data sources for autocomplete slots
  const dataSources: SlotDataSources = useMemo(() => {
    const substanceOpts: (AutocompleteOption & { substanceClass?: string })[] = substances
      .filter(s => s.class && s.class !== 'other')
      .sort((a, b) => a.formula.localeCompare(b.formula))
      .map(s => ({
        id: s.id,
        label: s.name ?? s.formula,
        formula: s.formula,
        substanceClass: s.class,
      }));

    const indicatorOpts: AutocompleteOption[] = [
      { id: 'ind:litmus', label: INDICATOR_LABELS['ind:litmus']() },
      { id: 'ind:phenolphthalein', label: INDICATOR_LABELS['ind:phenolphthalein']() },
      { id: 'ind:methyl_orange', label: INDICATOR_LABELS['ind:methyl_orange']() },
    ];

    const elementOpts: AutocompleteOption[] = elements
      .sort((a, b) => a.number - b.number)
      .map(el => ({
        id: `el:${el.symbol}`,
        label: `${el.symbol} — ${el.name}`,
      }));

    return { substances: substanceOpts, indicators: indicatorOpts, elements: elementOpts };
  }, [substances, elements]);

  // Select template
  const handleSelectTemplate = useCallback((id: string) => {
    const tpl = SENTENCE_TEMPLATES.find(t => t.id === id);
    if (!tpl) return;
    setTemplateId(id);
    setSlotValues(getDefaults(tpl));
    setResult(null);
    setSolveError(null);
  }, []);

  const selectedTemplate = SENTENCE_TEMPLATES.find(t => t.id === templateId);

  // Build query from current slot values
  const currentQuery = useMemo(() => {
    if (!selectedTemplate) return null;
    try {
      return selectedTemplate.buildQuery(slotValues);
    } catch {
      return null;
    }
  }, [selectedTemplate, slotValues]);

  // Solve
  const handleSolve = useCallback(() => {
    if (!currentQuery) return;
    setSolveError(null);
    setResult(null);

    try {
      const entityFormulas = new Map<string, string>();
      for (const s of substances) {
        const ref = `substance:${s.id.replace(/^sub:/, '')}`;
        const ascii = s.formula.replace(/[\u2080-\u2089]/g, ch =>
          String(ch.charCodeAt(0) - 0x2080),
        );
        entityFormulas.set(ref, ascii);
      }

      const res = solveQuery(currentQuery, {
        formulas,
        constants: toConstantsDict(constantsList),
        ontology: { elements, parseFormula, entityFormulas },
        indicatorRules,
      });
      setResult(res);
    } catch (e) {
      setSolveError(e instanceof Error ? e.message : String(e));
    }
  }, [currentQuery, substances, elements, formulas, constantsList, indicatorRules]);

  if (loading) return <div className="solver-loading">{m.loading()}</div>;

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="solver-page">
        <h1 className="solver-page__title">{m.solver_title()}</h1>

        {/* Typeahead query input */}
        <QueryTypeahead
          templates={SENTENCE_TEMPLATES}
          onSelect={handleSelectTemplate}
          placeholder={m.solver_typeahead_placeholder()}
        />

        {/* Sentence editor */}
        {selectedTemplate && (
          <SentenceEditor
            template={selectedTemplate}
            values={slotValues}
            onChange={setSlotValues}
            dataSources={dataSources}
          />
        )}

        {/* Actions: Solve + JSON toggle */}
        {selectedTemplate && (
          <div className="solver-actions">
            <button
              type="button"
              className="solver-solve-btn"
              disabled={!currentQuery}
              onClick={handleSolve}
            >
              {m.solver_solve()}
            </button>
            <button
              type="button"
              className={`solver-json-toggle ${showJson ? 'solver-json-toggle--active' : ''}`}
              onClick={() => setShowJson(o => !o)}
            >
              JSON
            </button>
          </div>
        )}

        {/* JSON view (power users) */}
        {showJson && currentQuery && (
          <div className="solver-json">
            <pre className="solver-json__preview">
              {JSON.stringify(currentQuery, null, 2)}
            </pre>
          </div>
        )}

        {/* Error */}
        {solveError && <div className="solver-error">{solveError}</div>}

        {/* Result */}
        {result && (
          <div className="solver-result">
            <div className="solver-result__header">
              <span className="solver-result__label">{m.solver_answer()}</span>
              <AnswerChip answer={result.answer} />
            </div>
            <StepsTrace steps={result.steps} intermediates={result.intermediates} />
          </div>
        )}
      </div>
    </FormulaLookupProvider>
  );
}

function AnswerChip({ answer }: { answer: string | number }) {
  const { label, cssClass } = answerDisplay(answer);
  return (
    <span className={`solver-color-chip ${cssClass}`}>
      {cssClass && <span className="solver-color-chip__dot" />}
      {label}
    </span>
  );
}
