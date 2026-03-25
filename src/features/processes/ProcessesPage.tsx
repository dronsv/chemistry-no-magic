import { useState, useEffect, useMemo } from 'react';
import type { ProcessVocabEntry, ProcessKind, EffectsVocabEntry, EffectRef } from '../../types/process-vocab';
import type { SupportedLocale } from '../../types/i18n';
import { loadProcessVocab, loadEffectsVocab, loadFormulaLookup, loadConcepts, loadConceptOverlay, loadConceptLookup } from '../../lib/data-loader';
import * as m from '../../paraglide/messages.js';
import ChemText, { FormulaLookupProvider } from '../../components/ChemText';
import { ConceptProvider, type ConceptContextValue } from '../../components/ConceptProvider';
import RichTextRenderer from '../../components/RichTextRenderer';
import type { RichText } from '../../types/ontology-ref';
import type { FormulaLookup } from '../../types/formula-lookup';
import './processes.css';

const KIND_ORDER: ProcessKind[] = ['chemical', 'driving_force', 'physical', 'operation', 'constraint'];

function searchableText(desc: string | RichText): string {
  if (typeof desc === 'string') return desc;
  return desc.filter(s => s.t === 'text').map(s => (s as { t: 'text'; v: string }).v).join('');
}

function renderDescription(desc: string | RichText, locale: SupportedLocale) {
  if (Array.isArray(desc)) {
    return <RichTextRenderer segments={desc} locale={locale} />;
  }
  return <ChemText text={desc} />;
}

const KIND_LABELS: Record<ProcessKind, () => string> = {
  chemical: m.proc_kind_chemical,
  driving_force: m.proc_kind_driving_force,
  operation: m.proc_kind_operation,
  physical: m.proc_kind_physical,
  constraint: m.proc_kind_constraint,
};

export default function ProcessesPage({
  locale = 'ru' as SupportedLocale,
}: {
  locale?: SupportedLocale;
}) {
  const [entries, setEntries] = useState<ProcessVocabEntry[]>([]);
  const [effectsMap, setEffectsMap] = useState<Map<string, EffectsVocabEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<ProcessKind>>(new Set(KIND_ORDER));
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);
  const [conceptCtx, setConceptCtx] = useState<ConceptContextValue | null>(null);

  useEffect(() => {
    Promise.all([
      loadProcessVocab(locale),
      loadEffectsVocab(locale),
      loadFormulaLookup(),
      loadConcepts(),
      loadConceptOverlay(locale),
      loadConceptLookup(locale).catch(() => ({})),
    ]).then(([vocab, effects, fl, registry, overlay, lookup]) => {
      setEntries(vocab);
      setEffectsMap(new Map(effects.map(e => [e.id, e])));
      setFormulaLookup(fl);
      if (registry && overlay) {
        setConceptCtx({ registry, overlay, lookup: lookup ?? {} });
      }
      setLoading(false);
    });
  }, [locale]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter(
      e => e.name.toLowerCase().includes(q) || searchableText(e.description).toLowerCase().includes(q),
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

  // Build a name lookup for parent links
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) {
      map.set(e.id, e.name);
    }
    return map;
  }, [entries]);

  function toggleGroup(kind: ProcessKind) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function renderEffectRef(ref: EffectRef, i: number) {
    if (typeof ref === 'string') {
      const eff = effectsMap.get(ref);
      return (
        <span key={i} className="proc-page__effect">
          {eff?.name ?? ref}
        </span>
      );
    }
    const eff = effectsMap.get(ref.id);
    return (
      <span key={i} className="proc-page__effect proc-page__effect--conditional">
        {eff?.name ?? ref.id}
        <span className="proc-page__effect-when">{ref.when}</span>
      </span>
    );
  }

  if (loading) {
    return <div className="proc-page"><p>{m.loading()}</p></div>;
  }

  return (
    <ConceptProvider value={conceptCtx}>
      <FormulaLookupProvider value={formulaLookup}>
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
                        <p className="proc-page__entry-name">{entry.name}</p>
                        <div className="proc-page__entry-desc">
                          {renderDescription(entry.description, locale)}
                        </div>
                        {entry.parent && (
                          <p className="proc-page__parent">
                            ← {nameById.get(entry.parent) ?? entry.parent}
                          </p>
                        )}
                        {entry.effects && entry.effects.length > 0 && (
                          <div className="proc-page__effects">
                            {entry.effects.map((eff, i) => renderEffectRef(eff, i))}
                          </div>
                        )}
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
      </FormulaLookupProvider>
    </ConceptProvider>
  );
}
