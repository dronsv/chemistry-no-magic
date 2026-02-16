import { useState, useEffect } from 'react';
import type { ReactionTemplate } from '../../types/templates';
import { loadReactionTemplates } from '../../lib/data-loader';

const TYPE_LABELS: Record<string, string> = {
  exchange: 'Обмена',
  substitution: 'Замещения',
  combination: 'Соединения',
  decomposition: 'Разложения',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'exchange', label: 'Обмена' },
  { value: 'substitution', label: 'Замещения' },
  { value: 'combination', label: 'Соединения' },
  { value: 'decomposition', label: 'Разложения' },
];

function ReactionCard({ template }: { template: ReactionTemplate }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rxn-card ${expanded ? 'rxn-card--open' : ''}`}>
      <button
        type="button"
        className="rxn-card__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`rxn-card__type-badge rxn-card__type-badge--${template.type}`}>
          {TYPE_LABELS[template.type] ?? template.type}
        </span>
        <span className="rxn-card__title">{template.description_ru}</span>
        <span className="rxn-card__arrow">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="rxn-card__body">
          <div className="rxn-card__pattern">
            <span className="rxn-card__pattern-label">Схема:</span> {template.pattern}
          </div>
          {template.conditions && (
            <div className="rxn-card__conditions">
              <span className="rxn-card__conditions-label">Условия:</span> {template.conditions}
            </div>
          )}
          {template.catalyst && (
            <div className="rxn-card__conditions">
              <span className="rxn-card__conditions-label">Катализатор:</span> {template.catalyst}
            </div>
          )}
          <div className="rxn-card__examples">
            <span className="rxn-card__examples-label">Примеры:</span>
            {template.examples.map((ex, i) => (
              <div key={i} className="rxn-card__equation">
                {ex.reactants.join(' + ')} → {ex.products.join(' + ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReactionCatalog() {
  const [templates, setTemplates] = useState<ReactionTemplate[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReactionTemplates().then(data => {
      setTemplates(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="rxn-catalog__loading">Загрузка...</div>;
  }

  const filtered = filter === 'all'
    ? templates
    : templates.filter(t => t.type === filter);

  return (
    <section>
      <h2 className="rxn-catalog__title">Каталог реакций</h2>

      <div className="rxn-catalog__filters">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`rxn-catalog__filter-btn ${filter === opt.value ? 'rxn-catalog__filter-btn--active' : ''}`}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="rxn-catalog__count">
        Показано: {filtered.length} из {templates.length}
      </div>

      <div className="rxn-catalog__list">
        {filtered.map(t => (
          <ReactionCard key={t.id} template={t} />
        ))}
      </div>
    </section>
  );
}
