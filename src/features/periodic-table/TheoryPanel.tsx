import { useState, useEffect } from 'react';
import type { PeriodicTableTheory, PropertyTrend, ExceptionConsequence } from '../../types/periodic-table-theory';
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

function TrendCard({ trend }: { trend: PropertyTrend }) {
  return (
    <CollapsibleSection title={trend.title_ru} icon={trend.icon}>
      <div className="theory-trend">
        <div className="theory-trend__directions">
          <div className="theory-trend__dir">
            <span className="theory-trend__arrow-label">→ В периоде:</span>
            <span>{trend.trend_period_ru}</span>
          </div>
          <div className="theory-trend__dir">
            <span className="theory-trend__arrow-label">↓ В группе:</span>
            <span>{trend.trend_group_ru}</span>
          </div>
        </div>

        <div className="theory-trend__why">
          <strong>Почему в периоде?</strong>
          <p>{trend.why_period_ru}</p>
        </div>
        <div className="theory-trend__why">
          <strong>Почему в группе?</strong>
          <p>{trend.why_group_ru}</p>
        </div>

        {trend.examples_ru.length > 0 && (
          <div className="theory-trend__examples">
            <strong>Примеры:</strong>
            <ul>
              {trend.examples_ru.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
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

export default function TheoryPanel() {
  const [theory, setTheory] = useState<PeriodicTableTheory | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || theory) return;
    setLoading(true);
    loadPeriodicTableTheory()
      .then(data => {
        setTheory(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        setLoading(false);
      });
  }, [open, theory]);

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>📖</span>
        <span>Теория: свойства и тренды</span>
        <span className="theory-panel__trigger-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">Загрузка...</div>}
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
              <h3 className="theory-panel__heading">Тренды свойств</h3>
              <p className="theory-panel__hint">
                Нажмите кнопку <strong>Тренды</strong> над таблицей, чтобы увидеть направления изменения свойств на самой таблице.
              </p>
              {theory.property_trends.map(trend => (
                <TrendCard key={trend.id} trend={trend} />
              ))}

              {/* Exception consequences */}
              <h3 className="theory-panel__heading">Последствия провала электрона</h3>
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
