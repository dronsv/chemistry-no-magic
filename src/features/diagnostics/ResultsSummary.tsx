import type { CompetencyId, CompetencyNode } from '../../types/competency';
import type { CompetencyLevel } from '../../lib/bkt-engine';
import type { SupportedLocale } from '../../types/i18n';
import { getLevel } from '../../lib/bkt-engine';
import { localizeUrl } from '../../lib/i18n';
import * as m from '../../paraglide/messages.js';

const LEVEL_LABELS: Record<CompetencyLevel, () => string> = {
  none: m.level_none,
  basic: m.level_basic,
  confident: m.level_confident,
  automatic: m.level_automatic,
};

interface ResultsSummaryProps {
  results: Map<CompetencyId, number>;
  competencies: CompetencyNode[];
  locale?: SupportedLocale;
}

export default function ResultsSummary({ results, competencies, locale = 'ru' }: ResultsSummaryProps) {
  // Only show competencies that have results
  const shown = competencies.filter(c => results.has(c.id));

  return (
    <div className="diag-results">
      <h2 className="diag-results__title">{m.diag_results_title()}</h2>
      <p className="diag-results__subtitle">
        {m.diag_results_subtitle()}
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
                {LEVEL_LABELS[level]?.() ?? m.level_none()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="diag-results__actions">
        <a href={localizeUrl('/profile/', locale)} className="btn btn-primary">
          {m.diag_open_profile()}
        </a>
      </div>
    </div>
  );
}
