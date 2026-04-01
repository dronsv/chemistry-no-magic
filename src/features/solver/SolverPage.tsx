import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { Element } from '../../types/element';
import type { FormulaLookup } from '../../types/formula-lookup';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { ReasoningQuery, ReasoningResult } from '../../types/derivation';
import type { SupportedLocale } from '../../types/i18n';
import type { Ion } from '../../types/ion';
import {
  loadSubstancesIndex,
  loadElements,
  loadFormulaLookup,
  loadFormulas,
  loadConstants,
  loadDataFile,
  loadIons,
  loadProperties,
  loadSolubilityRules,
  loadActivitySeries,
  loadPredicateRegistry,
  loadResolutionIndex,
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
import { isEnabled } from '../../config/feature-flags.js';
import QueryBuilder from './QueryBuilder.js';
import DslEditor from './DslEditor.js';
import { resolveQuery, type ResolverEnv } from '../../lib/resolver/resolve-query.js';
import type { PredicateDef } from '../../types/predicate.js';
import type { ResolutionDef } from '../../types/resolution.js';
import type { QueryExpr, ResolverResult as DslResolverResult } from '../../types/query-ast.js';
import type { OntologyData } from '../../lib/task-engine/types.js';
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
  const [ions, setIons] = useState<Ion[]>([]);
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

  // DSL QueryBuilder state
  const [predicates, setPredicates] = useState<PredicateDef[]>([]);
  const [resolutionIndex, setResolutionIndex] = useState<Record<string, ResolutionDef[]>>({});
  const [dslResult, setDslResult] = useState<DslResolverResult | null>(null);
  const [dslText, setDslText] = useState('');
  const [ontologyData, setOntologyData] = useState<OntologyData | null>(null);

  useEffect(() => {
    Promise.all([
      loadSubstancesIndex(locale),
      loadElements(locale),
      loadFormulaLookup(),
      loadFormulas(),
      loadConstants(),
      loadDataFile<IndicatorRule[]>('rules/indicator_response_rules.json'),
      loadIons(locale),
      loadPredicateRegistry(),
      loadResolutionIndex(),
      loadProperties(),
      loadSolubilityRules(),
      loadActivitySeries(locale),
    ])
      .then(([subs, elems, lookup, fmls, consts, indRules, ionList, preds, resIdx, props, solPairs, actSeries]) => {
        setSubstances(subs);
        setElements(elems);
        setFormulaLookup(lookup);
        setFormulas(fmls);
        setConstantsList(consts);
        setIndicatorRules(indRules);
        setIons(ionList);
        setPredicates(preds);
        setResolutionIndex(resIdx);
        // Assemble minimal OntologyData for rule handler
        setOntologyData({
          core: { elements: elems, ions: ionList, properties: props },
          rules: { solubilityPairs: solPairs, activitySeries: actSeries },
          data: {
            substances: subs,
            foundations: { formulas: fmls, constantsDict: toConstantsDict(consts) },
          },
          i18n: { morphology: null, promptTemplates: {}, labels: {} },
        } as OntologyData);
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
      .sort((a, b) => a.Z - b.Z)
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

  // DSL solve handler for new QueryBuilder
  const handleDslSolve = useCallback((query: QueryExpr) => {
    setDslResult(null);

    const entityFormulas = new Map<string, string>();
    for (const s of substances) {
      const ref = `substance:${s.id.replace(/^sub:/, '')}`;
      const ascii = s.formula.replace(/[\u2080-\u2089]/g, ch =>
        String(ch.charCodeAt(0) - 0x2080),
      );
      entityFormulas.set(ref, ascii);
    }

    const env: ResolverEnv = {
      predicateRegistry: predicates,
      resolutionIndex,
      formulaRegistry: formulas,
      constants: toConstantsDict(constantsList),
      indicatorRules,
      ontology: {
        formulas,
        constants: toConstantsDict(constantsList),
        ontologyData: ontologyData!,
        elements: elements.map(el => ({
          Z: el.Z,
          symbol: el.symbol,
          characteristics: el.characteristics as Record<string, { value: number }> | undefined,
        })),
        substances: substances.map(s => ({
          id: s.id,
          formula: s.formula,
          class: s.class,
        })),
        ions: ions.map(ion => ({
          id: ion.id,
          formula: ion.formula,
          type: ion.type,
        })),
      },
      policy: { max_depth: 6 },
      queryCache: new Map(),
      activeQueryStack: new Set(),
    };

    const res = resolveQuery(query, env);
    setDslResult(res);
  }, [predicates, resolutionIndex, formulas, constantsList, indicatorRules, substances, elements, ions, ontologyData]);

  if (loading) return <div className="solver-loading">{m.loading()}</div>;

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="solver-page">
        <h1 className="solver-page__title">{m.solver_title()}</h1>

        {isEnabled('newQueryBuilder') ? (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <DslEditor
                predicates={predicates}
                dataSources={{
                  substances: dataSources.substances,
                  elements: dataSources.elements,
                  ions: ions.map(ion => ({ id: ion.id, label: ion.name ?? ion.formula, formula: ion.formula })),
                }}
                locale={locale}
                value={dslText}
                onChange={setDslText}
                onSubmit={() => {/* TODO: parse DSL text → QueryExpr → handleDslSolve */}}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.375rem' }}>
                Tab/Enter — выбрать подсказку, Enter без подсказок — решить
              </div>
            </div>

            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Пошаговый ввод
              </summary>
              <div style={{ marginTop: '0.75rem' }}>
                <QueryBuilder
                  predicates={predicates}
                  resolutionIndex={resolutionIndex}
                  locale={locale}
                  dataSources={{
                    substances: dataSources.substances,
                    elements: dataSources.elements,
                    ions: ions.map(ion => ({ id: ion.id, label: ion.name ?? ion.formula, formula: ion.formula })),
                  }}
                  onSolve={handleDslSolve}
                />
              </div>
            </details>
            {dslResult && (
              <div className="dsl-result" style={{ marginTop: '1rem' }}>
                {dslResult.trace.status === 'success' ? (
                  <>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Результат</h3>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{renderDslAnswer(dslResult)}</div>
                    {dslResult.certainty && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        {dslResult.certainty}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#dc2626', fontSize: '0.88rem' }}>
                    {dslResult.trace.output?.kind === 'value' ? String(dslResult.trace.output.value) : 'Не удалось решить'}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
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
          </>
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

function renderDslAnswer(result: DslResolverResult): string {
  if (result.answer.kind === 'value') {
    const v = result.answer;
    return v.unit ? `${v.value} ${v.unit}` : String(v.value);
  }
  return JSON.stringify(result.answer);
}
