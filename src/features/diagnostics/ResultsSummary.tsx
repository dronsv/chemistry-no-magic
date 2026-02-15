import type { CompetencyId, CompetencyNode } from '../../types/competency';
import type { CompetencyLevel } from '../../lib/bkt-engine';
import { getLevel } from '../../lib/bkt-engine';

const LEVEL_LABELS: Record<CompetencyLevel, string> = {
  none: 'Начальный',
  basic: 'Базовый',
  confident: 'Уверенный',
  automatic: 'Автоматизм',
};

interface ResultsSummaryProps {
  results: Map<CompetencyId, number>;
  competencies: CompetencyNode[];
}

export default function ResultsSummary({ results, competencies }: ResultsSummaryProps) {
  // Only show competencies that have results
  const shown = competencies.filter(c => results.has(c.id));

  return (
    <div className="diag-results">
      <h2 className="diag-results__title">Результаты диагностики</h2>
      <p className="diag-results__subtitle">
        Ваш профиль компетенций по химии на основе стартового теста
      </p>

      <div className="diag-results__list">
        {shown.map((c) => {
          const pL = results.get(c.id) ?? 0.25;
          const level = getLevel(pL);
          const percent = Math.round(pL * 100);

          return (
            <div key={c.id} className="comp-bar">
              <span className="comp-bar__name">{c.name_ru}</span>
              <div className="comp-bar__track">
                <div
                  className={`comp-bar__fill comp-bar__fill--${level}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="comp-bar__value">{percent}%</span>
              <span className={`comp-bar__level comp-bar__level--${level}`}>
                {LEVEL_LABELS[level]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="diag-results__actions">
        <a href="/profile/" className="btn btn-primary">
          Открыть профиль
        </a>
      </div>
    </div>
  );
}
