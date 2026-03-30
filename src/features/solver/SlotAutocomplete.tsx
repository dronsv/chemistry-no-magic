import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import FormulaChip from '../../components/FormulaChip';

export interface AutocompleteOption {
  id: string;
  label: string;
  formula?: string;
  substanceClass?: string;
}

interface Props {
  options: AutocompleteOption[];
  value: string;
  onChange: (id: string) => void;
  renderSelected: (opt: AutocompleteOption | undefined) => ReactNode;
  placeholder?: string;
}

/**
 * Inline autocomplete dropdown for entity slots.
 * Opens on click, filters by typing, closes on selection or escape.
 */
export default function SlotAutocomplete({ options, value, onChange, renderSelected, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const containerRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find(o => o.id === value);

  const filtered = search
    ? options.filter(o => {
        const q = search.toLowerCase();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.formula && o.formula.toLowerCase().includes(q)) ||
          o.id.toLowerCase().includes(q)
        );
      })
    : options;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[focusIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx, open]);

  const handleSelect = useCallback((id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(i => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[focusIdx]) {
        handleSelect(filtered[focusIdx].id);
      }
      return;
    }
  }, [filtered, focusIdx, handleSelect]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setFocusIdx(0);
  }, []);

  return (
    <span className="slot-autocomplete" ref={containerRef}>
      <span
        className={`slot-chip ${open ? 'slot-chip--active' : ''}`}
        onClick={() => { setOpen(o => !o); setFocusIdx(0); }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
      >
        {selected ? renderSelected(selected) : (placeholder ?? '...')}
        <span className="slot-chip__arrow">{'\u25BE'}</span>
      </span>

      {open && (
        <span className="slot-dropdown">
          <input
            ref={inputRef}
            className="slot-dropdown__search"
            type="text"
            value={search}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? '...'}
          />
          <ul className="slot-dropdown__list" ref={listRef}>
            {filtered.length === 0 && (
              <li className="slot-dropdown__empty">{'\u2014'}</li>
            )}
            {filtered.map((opt, i) => (
              <li
                key={opt.id}
                className={`slot-dropdown__item ${i === focusIdx ? 'slot-dropdown__item--focused' : ''}`}
                onClick={() => handleSelect(opt.id)}
                onMouseEnter={() => setFocusIdx(i)}
              >
                {opt.formula ? (
                  <FormulaChip formula={opt.formula} />
                ) : (
                  <span>{opt.label}</span>
                )}
                {opt.formula && opt.label && (
                  <span className="slot-dropdown__secondary">{opt.label}</span>
                )}
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}
