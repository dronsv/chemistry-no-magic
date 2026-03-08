import { useState, useEffect } from 'react';
import * as m from '../../paraglide/messages.js';
import type {
  PeriodicTableTheory,
  PropertyTrend,
  ExceptionConsequence,
  TrendExample,
  TrendExampleElement,
} from '../../types/periodic-table-theory';
import type { TrendAnomaly, AnomalyReason } from '../../types/storage';
import type { SupportedLocale } from '../../types/i18n';
import { loadPeriodicTableTheory, loadPeriodicTrendAnomalies, loadReasonVocab } from '../../lib/data-loader';
import FormulaChip from '../../components/FormulaChip';

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`theory-section ${open ? 'theory-section--open' : ''}`}>
      <button
        type="button"
        className="theory-section__toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {icon && <span className="theory-section__icon">{icon}</span>}
        <span className="theory-section__title">{title}</span>
        <span className="theory-section__arrow">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="theory-section__body">{children}</div>}
    </div>
  );
}

function ElementChip({ el }: { el: TrendExampleElement }) {
  const display = el.value || el.value || '';
  return (
    <span className="theory-trend-element">
      <FormulaChip formula={el.symbol} elementId={el.symbol} />
      {display && <span className="theory-trend-element__value">{display}</span>}
    </span>
  );
}

function TrendExamples({
  examples,
}: {
  examples: TrendExample[];
}) {
  return (
    <div className="theory-trend__examples-list">
      {examples.map((ex, i) => {
        if (ex.type === 'text') {
          return (
            <p key={i} className="theory-trend__example-text">
              {ex.text}
            </p>
          );
        }
        return (
          <div key={i} className="theory-trend__example-series">
            <span className="theory-trend__example-label">{ex.label}:</span>
            <div className="theory-trend__example-chain">
              {ex.elements.map((el, j) => (
                <span key={`${el.symbol}-${j}`}>
                  {j > 0 && <span className="theory-trend__arrow-sep">{'\u2192'}</span>}
                  <ElementChip el={el} />
                </span>
              ))}
            </div>
            {ex.comment && (
              <span className="theory-trend__example-comment">— {ex.comment}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrendAnomalies({
  trendId,
  anomalies,
  reasonsById,
  locale,
}: {
  trendId: string;
  anomalies: TrendAnomaly[];
  reasonsById: Record<string, AnomalyReason>;
  locale: string;
}) {
  const pairs = anomalies.filter(a => a.property === trendId);
  if (pairs.length === 0) return null;
  return (
    <div className="theory-trend__examples">
      <strong>{m.theory_anomalies_label()}</strong>
      <div className="theory-trend__anomaly-list">
        {pairs.map((a, i) => {
          const reason = reasonsById[a.reason]?.labels[locale] ?? reasonsById[a.reason]?.labels['ru'] ?? '';
          return (
            <div key={i} className="theory-trend__anomaly-pair">
              <FormulaChip formula={a.from} elementId={a.from} />
              <span className="theory-trend__arrow-sep">{'→'}</span>
              <FormulaChip formula={a.to} elementId={a.to} />
              {reason && <span className="theory-trend__anomaly-reason">({reason})</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendCard({
  trend,
  anomalies,
  reasonsById,
  locale,
}: {
  trend: PropertyTrend;
  anomalies: TrendAnomaly[];
  reasonsById: Record<string, AnomalyReason>;
  locale: string;
}) {
  return (
    <CollapsibleSection title={trend.title} icon={trend.icon}>
      <div className="theory-trend">
        <div className="theory-trend__directions">
          <div className="theory-trend__dir">
            <span className="theory-trend__arrow-label">{m.theory_pt_period()}</span>
            <span>{trend.trend_period}</span>
          </div>
          <div className="theory-trend__dir">
            <span className="theory-trend__arrow-label">{m.theory_pt_group()}</span>
            <span>{trend.trend_group}</span>
          </div>
        </div>

        <div className="theory-trend__why">
          <strong>{m.theory_pt_why_period()}</strong>
          <p>{trend.why_period}</p>
        </div>
        <div className="theory-trend__why">
          <strong>{m.theory_pt_why_group()}</strong>
          <p>{trend.why_group}</p>
        </div>

        {trend.examples && trend.examples.length > 0 && (
          <div className="theory-trend__examples">
            <strong>{m.theory_examples_label()}</strong>
            <TrendExamples examples={trend.examples} />
          </div>
        )}

        <TrendAnomalies
          trendId={trend.id}
          anomalies={anomalies}
          reasonsById={reasonsById}
          locale={locale}
        />
      </div>
    </CollapsibleSection>
  );
}

function ExceptionCard({ exc }: { exc: ExceptionConsequence }) {
  return (
    <CollapsibleSection title={`${exc.symbol} (Z=${exc.element_Z})`} icon="⚛">
      <div className="theory-exception">
        <div className="theory-exception__config">
          <s>{exc.config_change.split(' → ')[0]}</s>
          {' → '}
          <strong>{exc.config_change.split(' → ')[1]}</strong>
        </div>
        <ul className="theory-exception__list">
          {exc.consequences.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
    </CollapsibleSection>
  );
}

export default function TheoryPanel({ locale }: { locale?: SupportedLocale }) {
  const [theory, setTheory] = useState<PeriodicTableTheory | null>(null);
  const [anomalies, setAnomalies] = useState<TrendAnomaly[]>([]);
  const [reasonsById, setReasonsById] = useState<Record<string, AnomalyReason>>({});
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || theory) return;
    setLoading(true);
    Promise.all([
      loadPeriodicTableTheory(locale),
      loadPeriodicTrendAnomalies(),
      loadReasonVocab(),
    ])
      .then(([data, anomalyData, reasonData]) => {
        setTheory(data);
        setAnomalies(anomalyData);
        setReasonsById(Object.fromEntries(reasonData.map(r => [r.id, r])));
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : m.error_loading_short());
        setLoading(false);
      });
  }, [open, theory, locale]);

  const resolvedLocale = locale ?? 'ru';

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>📖</span>
        <span>{m.theory_pt_trigger()}</span>
        <span className="theory-panel__trigger-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">{m.loading()}</div>}
          {error && <div className="theory-panel__error">{error}</div>}

          {theory && (
            <>
              {/* General principle */}
              {theory.general_principle && (
                <div className="theory-principle">
                  <strong>{theory.general_principle.title}</strong>
                  <p>{theory.general_principle.text}</p>
                  <code className="theory-principle__formula">{theory.general_principle.formula}</code>
                </div>
              )}

              {/* Property trends */}
              <h3 className="theory-panel__heading">{m.theory_pt_trends_heading()}</h3>
              <p className="theory-panel__hint">
                {m.theory_pt_trends_hint()}
              </p>
              {theory.property_trends.map(trend => (
                <TrendCard
                  key={trend.id}
                  trend={trend}
                  anomalies={anomalies}
                  reasonsById={reasonsById}
                  locale={resolvedLocale}
                />
              ))}

              {/* Exception consequences */}
              <h3 className="theory-panel__heading">{m.theory_pt_exceptions_heading()}</h3>
              {theory.exception_consequences.map(exc => (
                <ExceptionCard key={exc.id} exc={exc} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
