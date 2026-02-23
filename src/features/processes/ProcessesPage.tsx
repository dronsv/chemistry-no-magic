import { useState, useEffect, useMemo } from 'react';
import type { ProcessVocabEntry, ProcessKind } from '../../types/process-vocab';
import type { SupportedLocale } from '../../types/i18n';
import { loadProcessVocab } from '../../lib/data-loader';
import * as m from '../../paraglide/messages.js';
import './processes.css';

const KIND_ORDER: ProcessKind[] = ['chemical', 'physical', 'physchem', 'operation', 'constraint'];

const KIND_LABELS: Record<ProcessKind, () => string> = {
  chemical: m.proc_kind_chemical,
  operation: m.proc_kind_operation,
  physical: m.proc_kind_physical,
  physchem: m.proc_kind_physchem,
  constraint: m.proc_kind_constraint,
};

export default function ProcessesPage({
  locale = 'ru' as SupportedLocale,
}: {
  locale?: SupportedLocale;
}) {
  const [entries, setEntries] = useState<ProcessVocabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<ProcessKind>>(new Set(KIND_ORDER));

  useEffect(() => {
    loadProcessVocab(locale).then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, [locale]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter(
      e =>
        e.name_ru.toLowerCase().includes(q) ||
        e.description_ru.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const grouped = useMemo(() => {
    const map = new Map<ProcessKind, ProcessVocabEntry[]>();
    for (const kind of KIND_ORDER) {
      map.set(kind, []);
    }
    for (const e of filtered) {
      const list = map.get(e.kind);
      if (list) list.push(e);
    }
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [filtered]);

  function toggleGroup(kind: ProcessKind) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  if (loading) {
    return <div className="proc-page"><p>{m.loading()}</p></div>;
  }

  return (
    <div className="proc-page">
      <h1 className="proc-page__title">{m.proc_title()}</h1>
      <p className="proc-page__subtitle">{m.proc_desc()}</p>

      <div className="proc-page__search">
        <input
          type="text"
          className="proc-page__search-input"
          placeholder={m.proc_search_placeholder()}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {grouped.length === 0 && (
        <p className="proc-page__empty">{m.nothing_found()}</p>
      )}

      {grouped.map(([kind, items]) => {
        const isOpen = openGroups.has(kind);
        return (
          <div key={kind} className="proc-page__group">
            <div
              className="proc-page__group-header"
              onClick={() => toggleGroup(kind)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && toggleGroup(kind)}
            >
              <h2 className="proc-page__group-title">
                {KIND_LABELS[kind]?.() ?? kind}
              </h2>
              <span className="proc-page__group-count">{items.length}</span>
              <svg
                className={`proc-page__group-chevron${isOpen ? ' proc-page__group-chevron--open' : ''}`}
                width="12"
                height="8"
                viewBox="0 0 12 8"
                aria-hidden="true"
              >
                <path
                  d="M1 1l5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {isOpen && (
              <div className="proc-page__entries">
                {items.map(entry => (
                  <div key={entry.id} className="proc-page__entry">
                    <p className="proc-page__entry-name">{entry.name_ru}</p>
                    <p className="proc-page__entry-desc">
                      {entry.description_ru}
                    </p>
                    {entry.params && entry.params.length > 0 && (
                      <div className="proc-page__params">
                        {entry.params.map((p, i) => (
                          <span key={i} className="proc-page__param">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
