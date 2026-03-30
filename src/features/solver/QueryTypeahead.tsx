/**
 * QueryTypeahead — single text input with live autocomplete over sentence templates.
 *
 * As the user types, matching templates are shown in a dropdown.
 * Selecting a template triggers onSelect with the template id.
 *
 * Matching logic: each template has a label and a "search text" (the sentence
 * with slots replaced by their placeholders). The input is matched against
 * the beginning of each word in the search text, case-insensitive.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { SentenceTemplate } from './sentence-templates';

interface Props {
  templates: SentenceTemplate[];
  onSelect: (templateId: string) => void;
  placeholder?: string;
}

/** Build a flat searchable text from a sentence template. */
function buildSearchText(tpl: SentenceTemplate): string {
  const parts: string[] = [];
  for (const part of tpl.sentence) {
    if (typeof part === 'string') {
      parts.push(part);
    } else {
      parts.push(part.placeholder ?? part.id);
    }
  }
  return parts.join('').toLowerCase();
}

/** Check if query matches the template (prefix match on any word boundary). */
function matchesQuery(query: string, searchText: string, label: string): boolean {
  if (!query) return true; // show all when empty
  const q = query.toLowerCase().trim();
  if (!q) return true;

  // Match against label
  if (label.toLowerCase().includes(q)) return true;

  // Match against sentence text
  if (searchText.includes(q)) return true;

  // Match each word of the query
  const words = q.split(/\s+/);
  return words.every(w => searchText.includes(w) || label.toLowerCase().includes(w));
}

export default function QueryTypeahead({ templates, onSelect, placeholder }: Props) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pre-compute search texts
  const searchData = useRef(
    templates.map(tpl => ({
      id: tpl.id,
      label: tpl.label,
      searchText: buildSearchText(tpl),
      preview: tpl.sentence
        .map(p => (typeof p === 'string' ? p : `[${p.placeholder ?? p.id}]`))
        .join(''),
    })),
  );

  const filtered = searchData.current.filter(d =>
    matchesQuery(input, d.searchText, d.label),
  );

  // Reset focus when filtered list changes
  useEffect(() => {
    setFocusIdx(0);
  }, [input]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      setOpen(false);
      setInput('');
      onSelect(id);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusIdx(i => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIdx(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[focusIdx]) handleSelect(filtered[focusIdx].id);
          break;
        case 'Escape':
          setOpen(false);
          break;
      }
    },
    [open, filtered, focusIdx, handleSelect],
  );

  return (
    <div className="query-typeahead" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        className="query-typeahead__input"
        value={input}
        onChange={e => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Начните вводить вопрос...'}
        autoComplete="off"
        spellCheck={false}
      />

      {open && filtered.length > 0 && (
        <ul className="query-typeahead__dropdown">
          {filtered.map((item, i) => (
            <li
              key={item.id}
              className={`query-typeahead__item ${i === focusIdx ? 'query-typeahead__item--focused' : ''}`}
              onMouseEnter={() => setFocusIdx(i)}
              onMouseDown={e => {
                e.preventDefault();
                handleSelect(item.id);
              }}
            >
              <span className="query-typeahead__item-label">{item.label}</span>
              <span className="query-typeahead__item-preview">{item.preview}</span>
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && input.trim() && (
        <div className="query-typeahead__empty">Нет подходящих шаблонов</div>
      )}
    </div>
  );
}
