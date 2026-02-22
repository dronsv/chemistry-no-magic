import { useState, useEffect, useMemo } from 'react';
import type { Ion } from '../../types/ion';
import type { SupportedLocale } from '../../types/i18n';
import { loadIons } from '../../lib/data-loader';
import FormulaChip from '../../components/FormulaChip';
import { IonDetailsProvider } from '../../components/IonDetailsProvider';
import * as m from '../../paraglide/messages.js';
import './ions-page.css';

type Filter = 'all' | 'cation' | 'anion';

export default function IonsPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [ions, setIons] = useState<Ion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadIons(locale).then(data => {
      setIons(data);
      setLoading(false);
    });
  }, [locale]);

  const filtered = useMemo(() => {
    let result = ions;
    if (filter !== 'all') {
      result = result.filter(ion => ion.type === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(ion =>
        ion.formula.toLowerCase().includes(q) ||
        ion.name_ru.toLowerCase().includes(q) ||
        ion.id.toLowerCase().includes(q),
      );
    }
    return result;
  }, [ions, filter, search]);

  const cations = useMemo(() => filtered.filter(i => i.type === 'cation'), [filtered]);
  const anions = useMemo(() => filtered.filter(i => i.type === 'anion'), [filtered]);

  if (loading) {
    return <div className="ions-page"><p>{m.loading()}</p></div>;
  }

  const filterButtons: { key: Filter; label: string }[] = [
    { key: 'all', label: m.ion_all() },
    { key: 'cation', label: m.ion_cations() },
    { key: 'anion', label: m.ion_anions() },
  ];

  return (
    <IonDetailsProvider locale={locale}>
      <div className="ions-page">
        <h1 className="ions-page__title">{m.ion_page_title()}</h1>

        <div className="ions-page__filters">
          {filterButtons.map(fb => (
            <button
              key={fb.key}
              type="button"
              className={`ions-page__filter-btn ${filter === fb.key ? 'ions-page__filter-btn--active' : ''}`}
              onClick={() => setFilter(fb.key)}
            >
              {fb.label}
            </button>
          ))}
          <input
            type="text"
            className="ions-page__search"
            placeholder={m.ion_search_placeholder()}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {(filter === 'all' || filter === 'cation') && cations.length > 0 && (
          <>
            {filter === 'all' && <h2 className="ions-page__group-title">{m.ion_cations()}</h2>}
            <div className="ion-grid">
              {cations.map(ion => (
                <IonCard key={ion.id} ion={ion} />
              ))}
            </div>
          </>
        )}

        {(filter === 'all' || filter === 'anion') && anions.length > 0 && (
          <>
            {filter === 'all' && <h2 className="ions-page__group-title">{m.ion_anions()}</h2>}
            <div className="ion-grid">
              {anions.map(ion => (
                <IonCard key={ion.id} ion={ion} />
              ))}
            </div>
          </>
        )}

        {filtered.length === 0 && (
          <p>{m.nothing_found()}</p>
        )}
      </div>
    </IonDetailsProvider>
  );
}

function IonCard({ ion }: { ion: Ion }) {
  return (
    <div className="ion-card">
      <div className="ion-card__formula">
        <FormulaChip
          formula={ion.formula}
          ionType={ion.type}
          ionId={ion.id}
          name={ion.name_ru}
        />
      </div>
      <div className="ion-card__name">{ion.name_ru}</div>
      <span className={`ion-card__charge ion-card__charge--${ion.type}`}>
        {ion.charge > 0 ? `+${ion.charge}` : ion.charge}
      </span>
    </div>
  );
}
