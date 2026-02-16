import { useState, useEffect, useMemo } from 'react';
import type { SubstanceIndexEntry } from '../../types/classification';
import { loadSubstancesIndex } from '../../lib/data-loader';

const CLASS_LABELS: Record<string, string> = {
  oxide: 'Оксид',
  acid: 'Кислота',
  base: 'Основание',
  salt: 'Соль',
  other: 'Другое',
};

const FILTER_BUTTONS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'oxide', label: 'Оксиды' },
  { key: 'acid', label: 'Кислоты' },
  { key: 'base', label: 'Основания' },
  { key: 'salt', label: 'Соли' },
];

export default function SubstanceCatalog() {
  const [substances, setSubstances] = useState<SubstanceIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSubstancesIndex()
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
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        s =>
          s.formula.toLowerCase().includes(q) ||
          (s.name_ru && s.name_ru.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [substances, filter, search]);

  if (loading) return <div className="subst-catalog__loading">Загрузка каталога...</div>;

  return (
    <section className="subst-catalog">
      <h2 className="subst-catalog__title">Каталог веществ</h2>

      <div className="subst-catalog__controls">
        <div className="subst-catalog__filters">
          {FILTER_BUTTONS.map(btn => (
            <button
              key={btn.key}
              type="button"
              className={`subst-catalog__filter-btn ${filter === btn.key ? 'subst-catalog__filter-btn--active' : ''}`}
              onClick={() => setFilter(btn.key)}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="subst-catalog__search"
          placeholder="Поиск по формуле или названию..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="subst-catalog__count">
        {filtered.length} из {substances.length} веществ
      </div>

      <div className="subst-catalog__grid">
        {filtered.map(s => (
          <a key={s.id} href={`/substances/${s.id}/`} className="subst-card">
            <span className="subst-card__formula">{s.formula}</span>
            {s.name_ru && <span className="subst-card__name">{s.name_ru}</span>}
            <span className={`subst-card__badge subst-card__badge--${s.class}`}>
              {CLASS_LABELS[s.class] ?? s.class}
            </span>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="subst-catalog__empty">Ничего не найдено</div>
      )}
    </section>
  );
}
