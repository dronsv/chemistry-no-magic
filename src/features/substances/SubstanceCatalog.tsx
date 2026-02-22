import { useState, useEffect, useMemo } from 'react';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { SupportedLocale } from '../../types/i18n';
import { loadSubstancesIndex } from '../../lib/data-loader';
import { localizeUrl } from '../../lib/i18n';
import * as m from '../../paraglide/messages.js';

const CLASS_LABELS: Record<string, () => string> = {
  oxide: m.class_oxide,
  acid: m.class_acid,
  base: m.class_base,
  salt: m.class_salt,
  other: m.class_other,
};

const FILTER_BUTTONS: Array<{ key: string; label: () => string }> = [
  { key: 'all', label: m.class_all },
  { key: 'oxide', label: m.class_oxides },
  { key: 'acid', label: m.class_acids },
  { key: 'base', label: m.class_bases },
  { key: 'salt', label: m.class_salts },
];

export default function SubstanceCatalog({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [substances, setSubstances] = useState<SubstanceIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSubstancesIndex(locale)
      .then(subs => {
        setSubstances(subs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = substances;
    if (filter !== 'all') {
      list = list.filter(s => s.class === filter);
    }
    const raw = search.trim();
    if (raw) {
      const q = raw.toLowerCase();
      const hasUpper = raw !== q;
      list = list.filter(
        s =>
          (hasUpper ? s.formula.includes(raw) : s.formula.toLowerCase().includes(q)) ||
          (s.name_ru && s.name_ru.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [substances, filter, search]);

  if (loading) return <div className="subst-catalog__loading">{m.loading_catalog()}</div>;

  return (
    <section className="subst-catalog">
      <h2 className="subst-catalog__title">{m.subst_catalog_title()}</h2>

      <div className="subst-catalog__controls">
        <div className="subst-catalog__filters">
          {FILTER_BUTTONS.map(btn => (
            <button
              key={btn.key}
              type="button"
              className={`subst-catalog__filter-btn ${filter === btn.key ? 'subst-catalog__filter-btn--active' : ''}`}
              onClick={() => setFilter(btn.key)}
            >
              {btn.label()}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="subst-catalog__search"
          placeholder={m.subst_search_placeholder()}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="subst-catalog__count">
        {m.subst_count({ filtered: String(filtered.length), total: String(substances.length) })}
      </div>

      <div className="subst-catalog__grid">
        {filtered.map(s => (
          <a key={s.id} href={localizeUrl(`/substances/${s.id}/`, locale)} className="subst-card">
            <span className="subst-card__formula">{s.formula}</span>
            {s.name_ru && <span className="subst-card__name">{s.name_ru}</span>}
            <span className={`subst-card__badge subst-card__badge--${s.class}`}>
              {CLASS_LABELS[s.class]?.() ?? s.class}
            </span>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="subst-catalog__empty">{m.nothing_found()}</div>
      )}
    </section>
  );
}
