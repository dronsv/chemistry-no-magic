import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { Element } from '../../types/element';
import type { FormulaLookup } from '../../types/formula-lookup';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { ReasoningQuery, ReasoningResult, QueryParticipant, FactGoal } from '../../types/derivation';
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

// ── Query templates (models) ────────────────────────────────

interface QueryTemplate {
  id: string;
  label: () => string;
  description: () => string;
  build: () => ReasoningQuery;
}

const TEMPLATES: QueryTemplate[] = [
  {
    id: 'mixing_indicator',
    label: () => m.solver_tpl_mixing(),
    description: () => m.solver_tpl_mixing_desc(),
    build: () => ({
      system: {
        type: 'mixing',
        participants: [
          { role: 'acid', entity: 'sub:hcl', given: [
            { quantity: 'q:mass_fraction', value: 0.1 },
            { quantity: 'q:mass', role: 'solution', value: 100 },
          ]},
          { role: 'base', entity: 'sub:naoh', given: [
            { quantity: 'q:mass_fraction', value: 0.05 },
            { quantity: 'q:mass', role: 'solution', value: 200 },
          ]},
        ],
      },
      find: { fact: 'indicator_color', params: { indicator: 'ind:litmus' } },
    }),
  },
  {
    id: 'mixing_medium',
    label: () => m.solver_tpl_medium(),
    description: () => m.solver_tpl_medium_desc(),
    build: () => ({
      system: {
        type: 'mixing',
        participants: [
          { role: 'acid', entity: 'sub:h2so4', given: [
            { quantity: 'q:mass_fraction', value: 0.049 },
            { quantity: 'q:mass', role: 'solution', value: 100 },
          ]},
          { role: 'base', entity: 'sub:koh', given: [
            { quantity: 'q:mass_fraction', value: 0.056 },
            { quantity: 'q:mass', role: 'solution', value: 100 },
          ]},
        ],
      },
      find: { fact: 'medium' },
    }),
  },
];

// ── Color display ───────────────────────────────────────────

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

// ── Main component ──────────────────────────────────────────

export default function SolverPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);
  const [substances, setSubstances] = useState<SubstanceIndexEntry[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [formulas, setFormulas] = useState<ComputableFormula[]>([]);
  const [constantsList, setConstantsList] = useState<PhysicalConstant[]>([]);
  const [indicatorRules, setIndicatorRules] = useState<IndicatorRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Query state — editable JSON
  const [queryJson, setQueryJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');

  // Parsed query for visual editor
  const [query, setQuery] = useState<ReasoningQuery | null>(null);

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

  // Sync query ↔ JSON
  const updateQuery = useCallback((q: ReasoningQuery) => {
    setQuery(q);
    setQueryJson(JSON.stringify(q, null, 2));
    setJsonError(null);
    setResult(null);
    setSolveError(null);
  }, []);

  const handleJsonChange = useCallback((text: string) => {
    setQueryJson(text);
    try {
      const parsed = JSON.parse(text) as ReasoningQuery;
      if (parsed.system && parsed.find) {
        setQuery(parsed);
        setJsonError(null);
      } else {
        setJsonError('Missing "system" or "find" field');
      }
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, []);

  // Load template
  const handleTemplate = useCallback((tpl: QueryTemplate) => {
    updateQuery(tpl.build());
  }, [updateQuery]);

  // Visual editor: update participant
  const updateParticipant = useCallback((index: number, updates: Partial<QueryParticipant>) => {
    if (!query) return;
    const participants = [...query.system.participants];
    participants[index] = { ...participants[index], ...updates };
    updateQuery({ ...query, system: { ...query.system, participants } });
  }, [query, updateQuery]);

  // Visual editor: update participant given value
  const updateGiven = useCallback((pIdx: number, gIdx: number, value: number) => {
    if (!query) return;
    const participants = [...query.system.participants];
    const given = [...participants[pIdx].given];
    given[gIdx] = { ...given[gIdx], value };
    participants[pIdx] = { ...participants[pIdx], given };
    updateQuery({ ...query, system: { ...query.system, participants } });
  }, [query, updateQuery]);

  // Add participant
  const addParticipant = useCallback(() => {
    if (!query) return;
    const p: QueryParticipant = {
      role: 'participant',
      entity: '',
      given: [{ quantity: 'q:mass', value: 0 }],
    };
    updateQuery({
      ...query,
      system: { ...query.system, participants: [...query.system.participants, p] },
    });
  }, [query, updateQuery]);

  // Remove participant
  const removeParticipant = useCallback((index: number) => {
    if (!query) return;
    const participants = query.system.participants.filter((_, i) => i !== index);
    updateQuery({ ...query, system: { ...query.system, participants } });
  }, [query, updateQuery]);

  // Add given to participant
  const addGiven = useCallback((pIdx: number) => {
    if (!query) return;
    const participants = [...query.system.participants];
    participants[pIdx] = {
      ...participants[pIdx],
      given: [...participants[pIdx].given, { quantity: 'q:mass', value: 0 }],
    };
    updateQuery({ ...query, system: { ...query.system, participants } });
  }, [query, updateQuery]);

  // Remove given from participant
  const removeGiven = useCallback((pIdx: number, gIdx: number) => {
    if (!query) return;
    const participants = [...query.system.participants];
    participants[pIdx] = {
      ...participants[pIdx],
      given: participants[pIdx].given.filter((_, i) => i !== gIdx),
    };
    updateQuery({ ...query, system: { ...query.system, participants } });
  }, [query, updateQuery]);

  // Solve
  const handleSolve = useCallback(() => {
    if (!query) return;
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

      const res = solveQuery(query, {
        formulas,
        constants: toConstantsDict(constantsList),
        ontology: { elements, parseFormula, entityFormulas },
        indicatorRules,
      });
      setResult(res);
    } catch (e) {
      setSolveError(e instanceof Error ? e.message : String(e));
    }
  }, [query, substances, elements, formulas, constantsList, indicatorRules]);

  // Substance options
  const substanceOptions = useMemo(() =>
    substances
      .filter(s => s.class && s.class !== 'other')
      .sort((a, b) => a.formula.localeCompare(b.formula)),
    [substances],
  );

  const QUANTITY_OPTIONS = [
    'q:mass', 'q:amount', 'q:mass_fraction', 'q:molar_mass',
    'q:volume', 'q:molar_concentration', 'q:density',
  ];

  const ROLE_OPTIONS = [
    '', 'solution', 'solute', 'reactant', 'product', 'actual', 'theoretical',
  ];

  const FIND_FACT_OPTIONS = [
    { value: 'indicator_color', label: () => m.solver_find_indicator() },
    { value: 'medium', label: () => m.solver_find_medium() },
  ];

  if (loading) return <div className="solver-loading">{m.loading()}</div>;

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="solver-page">
        <h1 className="solver-page__title">{m.solver_title()}</h1>

        {/* Template selector */}
        <div className="solver-templates">
          <div className="solver-templates__label">{m.solver_model()}</div>
          <div className="solver-templates__list">
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                className="solver-template-btn"
                onClick={() => handleTemplate(tpl)}
              >
                <span className="solver-template-btn__title">{tpl.label()}</span>
                <span className="solver-template-btn__desc">{tpl.description()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* View mode toggle */}
        {query && (
          <div className="solver-view-toggle">
            <button
              type="button"
              className={viewMode === 'visual' ? 'active' : ''}
              onClick={() => setViewMode('visual')}
            >
              {m.solver_visual()}
            </button>
            <button
              type="button"
              className={viewMode === 'json' ? 'active' : ''}
              onClick={() => setViewMode('json')}
            >
              JSON
            </button>
          </div>
        )}

        {/* JSON editor */}
        {query && viewMode === 'json' && (
          <div className="solver-json">
            <textarea
              className="solver-json__editor"
              value={queryJson}
              onChange={e => handleJsonChange(e.target.value)}
              rows={Math.max(10, queryJson.split('\n').length + 2)}
              spellCheck={false}
            />
            {jsonError && <div className="solver-json__error">{jsonError}</div>}
          </div>
        )}

        {/* Visual editor */}
        {query && viewMode === 'visual' && (
          <div className="solver-visual">
            {/* System type */}
            <div className="solver-section">
              <div className="solver-section__label">{m.solver_step_system()}</div>
              <input
                type="text"
                className="solver-input--inline"
                value={query.system.type}
                onChange={e => updateQuery({ ...query, system: { ...query.system, type: e.target.value } })}
              />
            </div>

            {/* Participants */}
            <div className="solver-section">
              <div className="solver-section__label">
                {m.solver_step_participants()}
                <button type="button" className="solver-btn-add" onClick={addParticipant}>+</button>
              </div>
              <div className="solver-participants">
                {query.system.participants.map((p, pIdx) => (
                  <div key={pIdx} className="solver-card">
                    <div className="solver-card__header">
                      <input
                        type="text"
                        className="solver-input--role"
                        value={p.role}
                        onChange={e => updateParticipant(pIdx, { role: e.target.value })}
                        placeholder="role"
                      />
                      <select
                        className="solver-input--entity"
                        value={p.entity}
                        onChange={e => updateParticipant(pIdx, { entity: e.target.value })}
                      >
                        <option value="">—</option>
                        {substanceOptions.map(s => (
                          <option key={s.id} value={s.id}>{s.formula} ({s.class})</option>
                        ))}
                      </select>
                      {p.entity && (
                        <FormulaChip
                          formula={substances.find(s => s.id === p.entity)?.formula ?? p.entity}
                          substanceId={p.entity.replace(/^sub:/, '')}
                        />
                      )}
                      {query.system.participants.length > 1 && (
                        <button type="button" className="solver-btn-remove" onClick={() => removeParticipant(pIdx)}>×</button>
                      )}
                    </div>

                    {/* Given values */}
                    <div className="solver-card__givens">
                      {p.given.map((g, gIdx) => (
                        <div key={gIdx} className="solver-given-row">
                          <select
                            value={g.quantity}
                            onChange={e => {
                              const given = [...p.given];
                              given[gIdx] = { ...given[gIdx], quantity: e.target.value };
                              updateParticipant(pIdx, { given });
                            }}
                          >
                            {QUANTITY_OPTIONS.map(q => (
                              <option key={q} value={q}>{q.replace('q:', '')}</option>
                            ))}
                          </select>
                          <select
                            value={g.role ?? ''}
                            onChange={e => {
                              const given = [...p.given];
                              given[gIdx] = { ...given[gIdx], role: e.target.value || undefined } as typeof g;
                              updateParticipant(pIdx, { given });
                            }}
                          >
                            {ROLE_OPTIONS.map(r => (
                              <option key={r} value={r}>{r || '(no role)'}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="any"
                            className="solver-input--value"
                            value={g.value}
                            onChange={e => updateGiven(pIdx, gIdx, Number(e.target.value))}
                          />
                          <button type="button" className="solver-btn-remove-sm" onClick={() => removeGiven(pIdx, gIdx)}>×</button>
                        </div>
                      ))}
                      <button type="button" className="solver-btn-add-sm" onClick={() => addGiven(pIdx)}>+ {m.solver_add_given()}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Find */}
            <div className="solver-section">
              <div className="solver-section__label">{m.solver_find()}</div>
              {'fact' in query.find ? (
                <div className="solver-find-row">
                  <select
                    value={(query.find as FactGoal).fact}
                    onChange={e => updateQuery({ ...query, find: { fact: e.target.value, params: (query.find as FactGoal).params } })}
                  >
                    {FIND_FACT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label()}</option>
                    ))}
                  </select>
                  {(query.find as FactGoal).fact === 'indicator_color' && (
                    <select
                      value={(query.find as FactGoal).params?.indicator ?? 'ind:litmus'}
                      onChange={e => updateQuery({ ...query, find: { fact: 'indicator_color', params: { indicator: e.target.value } } })}
                    >
                      <option value="ind:litmus">{m.solver_ind_litmus()}</option>
                      <option value="ind:phenolphthalein">{m.solver_ind_phenolphthalein()}</option>
                      <option value="ind:methyl_orange">{m.solver_ind_methyl_orange()}</option>
                    </select>
                  )}
                </div>
              ) : (
                <div className="solver-find-row">
                  <span>quantity: {(query.find as { quantity: string }).quantity}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Solve */}
        {query && (
          <div className="solver-actions">
            <button
              type="button"
              className="solver-solve-btn"
              disabled={!query || !!jsonError}
              onClick={handleSolve}
            >
              {m.solver_solve()}
            </button>
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
