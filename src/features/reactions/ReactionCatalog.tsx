import { useState, useEffect } from 'react';
import type { ReactionTemplate } from '../../types/templates';
import { loadReactionTemplates } from '../../lib/data-loader';
import * as m from '../../paraglide/messages.js';

const TYPE_LABELS: Record<string, () => string> = {
  exchange: m.rxn_catalog_exchange,
  substitution: m.rxn_catalog_substitution,
  combination: m.rxn_catalog_combination,
  decomposition: m.rxn_catalog_decomposition,
};

const FILTER_VALUES = ['all', 'exchange', 'substitution', 'combination', 'decomposition'] as const;

const FILTER_LABELS: Record<string, () => string> = {
  all: m.rxn_filter_all,
  exchange: m.rxn_catalog_exchange,
  substitution: m.rxn_catalog_substitution,
  combination: m.rxn_catalog_combination,
  decomposition: m.rxn_catalog_decomposition,
};

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
          {TYPE_LABELS[template.type]?.() ?? template.type}
        </span>
        <span className="rxn-card__title">{template.description_ru}</span>
        <span className="rxn-card__arrow">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="rxn-card__body">
          <div className="rxn-card__pattern">
            <span className="rxn-card__pattern-label">{m.rxn_tpl_scheme()}</span> {template.pattern}
          </div>
          {template.conditions && (
            <div className="rxn-card__conditions">
              <span className="rxn-card__conditions-label">{m.rxn_tpl_conditions()}</span> {template.conditions}
            </div>
          )}
          {template.catalyst && (
            <div className="rxn-card__conditions">
              <span className="rxn-card__conditions-label">{m.rxn_tpl_catalyst()}</span> {template.catalyst}
            </div>
          )}
          <div className="rxn-card__examples">
            <span className="rxn-card__examples-label">{m.rxn_tpl_examples()}</span>
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
    return <div className="rxn-catalog__loading">{m.loading()}</div>;
  }

  const filtered = filter === 'all'
    ? templates
    : templates.filter(t => t.type === filter);

  return (
    <section>
      <h2 className="rxn-catalog__title">{m.rxn_catalog_title()}</h2>

      <div className="rxn-catalog__filters">
        {FILTER_VALUES.map(value => (
          <button
            key={value}
            type="button"
            className={`rxn-catalog__filter-btn ${filter === value ? 'rxn-catalog__filter-btn--active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {FILTER_LABELS[value]?.() ?? value}
          </button>
        ))}
      </div>

      <div className="rxn-catalog__count">
        {m.rxn_shown_count({ filtered: String(filtered.length), total: String(templates.length) })}
      </div>

      <div className="rxn-catalog__list">
        {filtered.map(t => (
          <ReactionCard key={t.id} template={t} />
        ))}
      </div>
    </section>
  );
}
