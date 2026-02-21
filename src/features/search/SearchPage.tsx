import { useState, useEffect, useRef, useCallback } from 'react';
import { loadSearchIndex } from '../../lib/data-loader';
import { search } from './search-engine';
import * as m from '../../paraglide/messages.js';
import type { SearchIndexEntry, SearchCategory } from '../../types/search';
import type { SearchResultGroup } from './search-engine';
import './search.css';

const CLASS_LABELS: Record<string, () => string> = {
  oxide: m.class_oxide,
  acid: m.class_acid,
  base: m.class_base,
  salt: m.class_salt,
  other: m.class_other,
};

const TAG_LABELS: Record<string, () => string> = {
  exchange: m.tag_exchange,
  neutralization: m.tag_neutralization,
  precipitation: m.tag_precipitation,
  gas_evolution: m.tag_gas_evolution,
  substitution: m.tag_substitution,
  redox: m.tag_redox,
  decomposition: m.tag_decomposition,
  qualitative_test: m.tag_qualitative_test,
  amphoteric: m.tag_amphoteric,
  acidic_oxide: m.tag_acidic_oxide,
  complexation: m.tag_complexation,
  gas_absorption: m.tag_gas_absorption,
};

function ResultItem({ entry }: { entry: SearchIndexEntry }) {
  const cat = entry.category;

  return (
    <a
      href={entry.url}
      className={`search-result${cat === 'element' && entry.meta?.group ? ` search-result--${entry.meta.group}` : ''}`}
    >
      {cat === 'element' && entry.meta?.Z && (
        <span className="search-badge search-badge--z">{entry.meta.Z}</span>
      )}
      {cat === 'competency' && entry.meta?.block && (
        <span className="search-badge search-badge--block">{entry.meta.block}</span>
      )}
      <span className="search-result__title">{entry.title}</span>
      <span className="search-result__subtitle">{entry.subtitle}</span>
      {cat === 'substance' && entry.meta?.class && (
        <span className="search-badge search-badge--class">
          {CLASS_LABELS[entry.meta.class]?.() || entry.meta.class}
        </span>
      )}
      {cat === 'reaction' && entry.meta?.tags && (
        <>
          {entry.meta.tags.split(',').slice(0, 2).map(tag => (
            <span key={tag} className="search-badge search-badge--tag">
              {TAG_LABELS[tag]?.() || tag}
            </span>
          ))}
        </>
      )}
    </a>
  );
}

function ResultGroup({ group }: { group: SearchResultGroup }) {
  return (
    <div className="search-group">
      <h2 className="search-group__label">{group.label}</h2>
      {group.results.map(entry => (
        <ResultItem key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export default function SearchPage({ locale }: { locale?: string }) {
  const [index, setIndex] = useState<SearchIndexEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultGroup[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load locale-specific search index
  useEffect(() => {
    loadSearchIndex(locale as 'ru' | 'en' | 'pl' | 'es' | undefined).then(setIndex);
  }, [locale]);

  // Read initial query from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setQuery(q);
  }, []);

  // Autofocus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  const doSearch = useCallback(
    (q: string) => {
      if (!index) return;
      setResults(search(index, q));
    },
    [index],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Update URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set('q', query);
    } else {
      url.searchParams.delete('q');
    }
    history.replaceState(null, '', url.toString());
  }, [query]);

  // Handle Enter — navigate to first result
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0 && results[0].results.length > 0) {
      window.location.href = results[0].results[0].url;
    }
  };

  const totalResults = results.reduce((sum, g) => sum + g.results.length, 0);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="search-page">
      <h1 className="search-page__title">{m.search_title()}</h1>

      <div className="search-input-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={m.search_placeholder()}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="search-kbd">Ctrl+K</span>
      </div>

      {!index && <div className="search-loading">{m.loading()}</div>}

      {index && hasQuery && totalResults === 0 && (
        <div className="search-empty">
          <div className="search-empty__text">{m.search_not_found({ query })}</div>
        </div>
      )}

      {results.map(group => (
        <ResultGroup key={group.category} group={group} />
      ))}
    </div>
  );
}
