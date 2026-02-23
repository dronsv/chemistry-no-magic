import type { CompetencyId, CompetencyNode } from '../../types/competency';
import type { SupportedLocale } from '../../types/i18n';
import { localizeUrl } from '../../lib/i18n';
import * as m from '../../paraglide/messages.js';
import CompetencyBar from '../profile/CompetencyBar';

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
        {shown.map((c) => (
          <CompetencyBar
            key={c.id}
            name={c.name_ru}
            pL={results.get(c.id) ?? 0.25}
            href={localizeUrl(`/competency/${c.id}/`, locale)}
          />
        ))}
      </div>

      <div className="diag-results__actions">
        <a href={localizeUrl('/profile/', locale)} className="btn btn-primary">
          {m.diag_open_profile()}
        </a>
      </div>
    </div>
  );
}
