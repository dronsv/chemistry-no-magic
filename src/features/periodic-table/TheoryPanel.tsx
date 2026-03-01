import { useState, useEffect } from 'react';
import * as m from '../../paraglide/messages.js';
import type {
  PeriodicTableTheory,
  PropertyTrend,
  ExceptionConsequence,
  TrendExample,
  TrendExampleElement,
} from '../../types/periodic-table-theory';
import type { SupportedLocale } from '../../types/i18n';
import { loadPeriodicTableTheory } from '../../lib/data-loader';

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
  const display = el.value || el.value_ru || '';
  return (
    <span className="theory-element-chip" title={el.symbol}>
      <span className="theory-element-chip__symbol">{el.symbol}</span>
      {display && <span className="theory-element-chip__value">{display}</span>}
    </span>
  );
}

function TrendExamples({
  examples,
  fallback,
}: {
  examples?: TrendExample[];
  fallback: string[];
}) {
  if (!examples || examples.length === 0) {
    return (
      <ul>
        {fallback.map((ex, i) => (
          <li key={i}>{ex}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="theory-trend__examples-list">
      {examples.map((ex, i) => {
        if (ex.type === 'text') {
          return (
            <p key={i} className="theory-trend__example-text">
              {ex.text_ru}
            </p>
          );
        }
        return (
          <div key={i} className="theory-trend__example-series">
            <span className="theory-trend__example-label">{ex.label_ru}:</span>
            <div className="theory-trend__example-chain">
              {ex.elements.map((el, j) => (
                <span key={`${el.symbol}-${j}`}>
                  {j > 0 && <span className="theory-trend__arrow-sep">{'\u2192'}</span>}
                  <ElementChip el={el} />
                </span>
              ))}
            </div>
            {ex.comment_ru && (
              <span className="theory-trend__example-comment">— {ex.comment_ru}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrendCard({ trend }: { trend: PropertyTrend }) {
  return (
    <CollapsibleSection title={trend.title_ru} icon={trend.icon}>
      <div className="theory-trend">
        <div className="theory-trend__directions">
          <div className="theory-trend__dir">
            <span className="theory-trend__arrow-label">{m.theory_pt_period()}</span>
            <span>{trend.trend_period_ru}</span>
          </div>
          <div className="theory-trend__dir">
            <span className="theory-trend__arrow-label">{m.theory_pt_group()}</span>
            <span>{trend.trend_group_ru}</span>
          </div>
        </div>

        <div className="theory-trend__why">
          <strong>{m.theory_pt_why_period()}</strong>
          <p>{trend.why_period_ru}</p>
        </div>
        <div className="theory-trend__why">
          <strong>{m.theory_pt_why_group()}</strong>
          <p>{trend.why_group_ru}</p>
        </div>

        {(trend.examples || trend.examples_ru.length > 0) && (
          <div className="theory-trend__examples">
            <strong>{m.theory_examples_label()}</strong>
            <TrendExamples examples={trend.examples} fallback={trend.examples_ru} />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function ExceptionCard({ exc }: { exc: ExceptionConsequence }) {
  return (
    <CollapsibleSection title={`${exc.symbol} (Z=${exc.element_Z})`} icon="⚛">
      <div className="theory-exception">
        <div className="theory-exception__config">
          <s>{exc.config_change_ru.split(' → ')[0]}</s>
          {' → '}
          <strong>{exc.config_change_ru.split(' → ')[1]}</strong>
        </div>
        <ul className="theory-exception__list">
          {exc.consequences_ru.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
    </CollapsibleSection>
  );
}

export default function TheoryPanel({ locale }: { locale?: SupportedLocale }) {
  const [theory, setTheory] = useState<PeriodicTableTheory | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || theory) return;
    setLoading(true);
    loadPeriodicTableTheory(locale)
      .then(data => {
        setTheory(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : m.error_loading_short());
        setLoading(false);
      });
  }, [open, theory, locale]);

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
              <div className="theory-principle">
                <strong>{theory.general_principle_ru.title_ru}</strong>
                <p>{theory.general_principle_ru.text_ru}</p>
                <code className="theory-principle__formula">{theory.general_principle_ru.formula_ru}</code>
              </div>

              {/* Property trends */}
              <h3 className="theory-panel__heading">{m.theory_pt_trends_heading()}</h3>
              <p className="theory-panel__hint">
                {m.theory_pt_trends_hint()}
              </p>
              {theory.property_trends.map(trend => (
                <TrendCard key={trend.id} trend={trend} />
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
