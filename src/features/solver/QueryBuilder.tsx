import { useState, useCallback } from 'react';
import type { Intent, QueryExpr, EqualityExpr, CallExpr, SymbolExpr } from '../../types/query-ast.js';
import type { PredicateDef } from '../../types/predicate.js';
import type { ResolutionDef } from '../../types/resolution.js';
import { renderCanonical, suggestGivens } from '../../lib/resolver/query-utils.js';
import IntentSelector from './IntentSelector.js';
import PredicateTypeahead from './PredicateTypeahead.js';

interface GivenEntry {
  predicate: string;
  value: string;
  unit: string;
}

interface Props {
  predicates: PredicateDef[];
  resolutionIndex: Record<string, ResolutionDef[]>;
  locale: string;
  onSolve: (query: QueryExpr) => void;
}

let _queryCounter = 0;
function nextQueryId(): string {
  return `q_${++_queryCounter}`;
}

/** Build a QueryExpr from current state, or return null if incomplete. */
function buildQuery(
  intent: Intent | null,
  predicate: PredicateDef | null,
  argValues: Record<string, string>,
  givens: GivenEntry[],
): QueryExpr | null {
  if (!intent || !predicate) return null;

  // Check required args are filled
  for (const arg of predicate.positional_args) {
    if (!arg.optional && !argValues[arg.name]?.trim()) return null;
  }

  // Build positional args as SymbolExprs
  const args: SymbolExpr[] = predicate.positional_args
    .filter(arg => argValues[arg.name]?.trim())
    .map(arg => ({
      kind: 'symbol' as const,
      ref: { kind: 'substance' as const, id: argValues[arg.name].trim() },
    }));

  const target: CallExpr = {
    kind: 'call',
    predicate: predicate.id,
    args,
  };

  // Build givens from filled entries
  const givenExprs: EqualityExpr[] = givens
    .filter(g => g.value.trim() && !isNaN(parseFloat(g.value)))
    .map(g => ({
      kind: 'equality' as const,
      left: {
        kind: 'call' as const,
        predicate: g.predicate,
        args: args.slice(0, 1), // first arg as entity ref
      },
      right: {
        kind: 'value' as const,
        value: parseFloat(g.value),
        unit: g.unit || undefined,
      },
    }));

  return {
    kind: 'query',
    id: nextQueryId(),
    intent,
    target,
    givens: givenExprs.length > 0 ? givenExprs : undefined,
    meta: { origin: 'query_builder' },
  };
}

/** Section header label style */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.8rem',
        fontWeight: 600,
        color: 'var(--color-primary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.5rem',
      }}
    >
      {children}
    </div>
  );
}

export default function QueryBuilder({ predicates, resolutionIndex, locale, onSolve }: Props) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [predicate, setPredicate] = useState<PredicateDef | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [givens, setGivens] = useState<GivenEntry[]>([]);

  // Reset dependent state when intent changes
  const handleIntentChange = useCallback((newIntent: Intent) => {
    setIntent(newIntent);
    setPredicate(null);
    setArgValues({});
    setGivens([]);
  }, []);

  // Reset dependent state when predicate changes
  const handlePredicateChange = useCallback(
    (newPred: PredicateDef | null) => {
      setPredicate(newPred);
      setArgValues({});
      if (newPred && intent === 'derive') {
        const suggested = suggestGivens(newPred.id, resolutionIndex);
        setGivens(
          suggested.map(s => ({
            predicate: s.predicate,
            value: '',
            unit: s.unit ?? '',
          })),
        );
      } else {
        setGivens([]);
      }
    },
    [intent, resolutionIndex],
  );

  const handleArgChange = useCallback((name: string, val: string) => {
    setArgValues(prev => ({ ...prev, [name]: val }));
  }, []);

  const handleGivenValueChange = useCallback((idx: number, val: string) => {
    setGivens(prev => prev.map((g, i) => (i === idx ? { ...g, value: val } : g)));
  }, []);

  const handleGivenUnitChange = useCallback((idx: number, unit: string) => {
    setGivens(prev => prev.map((g, i) => (i === idx ? { ...g, unit } : g)));
  }, []);

  const query = buildQuery(intent, predicate, argValues, givens);

  const handleSolve = useCallback(() => {
    if (query) onSolve(query);
  }, [query, onSolve]);

  // Suggested givens with suggestion_kind for UI rendering
  const suggestedGivens =
    predicate && intent === 'derive'
      ? suggestGivens(predicate.id, resolutionIndex)
      : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Step 1: Intent */}
      <div>
        <SectionLabel>Что сделать?</SectionLabel>
        <IntentSelector value={intent} onChange={handleIntentChange} />
      </div>

      {/* Step 2: Predicate (shown when intent selected) */}
      {intent && (
        <div>
          <SectionLabel>Что именно?</SectionLabel>
          <PredicateTypeahead
            predicates={predicates}
            intent={intent}
            locale={locale}
            value={predicate}
            onChange={handlePredicateChange}
          />
        </div>
      )}

      {/* Step 3: Positional args (shown when predicate selected) */}
      {predicate && predicate.positional_args.length > 0 && (
        <div>
          <SectionLabel>Аргументы</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {predicate.positional_args.map(arg => (
              <div key={arg.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label
                  style={{
                    fontSize: '0.88rem',
                    color: 'var(--color-text-muted)',
                    minWidth: '7rem',
                    flexShrink: 0,
                  }}
                >
                  {arg.name}
                  {!arg.optional && (
                    <span style={{ color: '#ef4444', marginLeft: '0.2rem' }}>*</span>
                  )}
                </label>
                <input
                  type="text"
                  value={argValues[arg.name] ?? ''}
                  onChange={e => handleArgChange(arg.name, e.target.value)}
                  placeholder={arg.description ?? arg.type}
                  style={{
                    flex: 1,
                    padding: '0.375rem 0.625rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.375rem',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Givens panel (shown when predicate selected AND intent is derive) */}
      {predicate && intent === 'derive' && suggestedGivens.length > 0 && (
        <div>
          <SectionLabel>Известные данные</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {suggestedGivens.map((sg, idx) => {
              const givenEntry = givens[idx];
              if (!givenEntry) return null;

              if (sg.suggestion_kind === 'usually_derived') {
                return (
                  <div
                    key={sg.predicate}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      opacity: 0.6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--color-text-muted)',
                        minWidth: '10rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      {sg.predicate}
                    </span>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--color-text-muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      будет вычислено
                    </span>
                  </div>
                );
              }

              // likely_given or optional
              return (
                <div
                  key={sg.predicate}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                >
                  <label
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--color-text-muted)',
                      minWidth: '10rem',
                      flexShrink: 0,
                      fontFamily: 'monospace',
                    }}
                  >
                    {sg.predicate}
                  </label>
                  <input
                    type="number"
                    value={givenEntry.value}
                    onChange={e => handleGivenValueChange(idx, e.target.value)}
                    placeholder="0"
                    style={{
                      width: '6rem',
                      padding: '0.375rem 0.5rem',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.375rem',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      outline: 'none',
                      textAlign: 'right',
                      MozAppearance: 'textfield',
                    } as React.CSSProperties}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  />
                  <input
                    type="text"
                    value={givenEntry.unit}
                    onChange={e => handleGivenUnitChange(idx, e.target.value)}
                    placeholder="ед."
                    style={{
                      width: '4rem',
                      padding: '0.375rem 0.5rem',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.375rem',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text-muted)',
                      outline: 'none',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 5: Canonical preview (shown when query is buildable) */}
      {query && (
        <div>
          <SectionLabel>Запрос</SectionLabel>
          <div
            style={{
              padding: '0.625rem 0.875rem',
              borderRadius: '0.5rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              fontSize: '0.82rem',
              color: '#1e40af',
              lineHeight: 1.5,
              wordBreak: 'break-all',
            }}
          >
            {renderCanonical(query)}
          </div>
        </div>
      )}

      {/* Step 6: Solve button */}
      {predicate && (
        <div style={{ marginTop: '0.25rem' }}>
          <button
            type="button"
            disabled={!query}
            onClick={handleSolve}
            className="solver-solve-btn"
          >
            Решить
          </button>
        </div>
      )}
    </div>
  );
}
