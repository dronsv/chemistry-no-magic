import { useState, useRef, useEffect, useCallback } from 'react';
import type { AutocompleteOption } from './SlotAutocomplete.js';
import FormulaChip from '../../components/FormulaChip.js';

interface Props {
  options: AutocompleteOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

/**
 * Inline text input with typeahead suggestions.
 * User types → filtered suggestions appear below → arrow keys + Enter to select.
 * Selected entity shown as text with formula badge, click to re-edit.
 */
export default function InlineEntityInput({ options, value, onChange, placeholder }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = value ? options.find(o => o.id === value) : null;

  const filtered = text.trim()
    ? options.filter(o => {
        const q = text.toLowerCase().trim();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.formula && o.formula.toLowerCase().includes(q)) ||
          o.id.toLowerCase().includes(q)
        );
      }).slice(0, 15)
    : [];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[focusIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx, open]);

  const handleSelect = useCallback((opt: AutocompleteOption) => {
    onChange(opt.id);
    setText('');
    setOpen(false);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[focusIdx]) handleSelect(filtered[focusIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [open, filtered, focusIdx, handleSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    setFocusIdx(0);
    setOpen(val.trim().length > 0);
    // Clear selection when user starts editing
    if (value) onChange('');
  }, [value, onChange]);

  const handleClearAndEdit = useCallback(() => {
    onChange('');
    setText(selected?.label ?? selected?.formula ?? '');
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onChange, selected]);

  // If selected, show inline display
  if (selected) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.625rem',
          border: '1px solid var(--color-border)',
          borderRadius: '0.375rem',
          background: 'var(--color-bg)',
          cursor: 'text',
          minHeight: '2rem',
        }}
        onClick={handleClearAndEdit}
      >
        {selected.formula && (
          <FormulaChip formula={selected.formula} />
        )}
        <span style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>
          {selected.label}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (text.trim()) setOpen(true); }}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '0.375rem 0.625rem',
          border: '1px solid var(--color-border)',
          borderRadius: '0.375rem',
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          outline: 'none',
        }}
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            margin: '2px 0 0',
            padding: '4px 0',
            listStyle: 'none',
            background: 'var(--color-bg, #fff)',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: '0.375rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {filtered.map((opt, i) => (
            <li
              key={opt.id}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setFocusIdx(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.375rem 0.625rem',
                cursor: 'pointer',
                fontSize: '0.88rem',
                background: i === focusIdx ? 'var(--color-bg-muted, #f3f4f6)' : 'transparent',
              }}
            >
              {opt.formula && (
                <FormulaChip formula={opt.formula} />
              )}
              <span style={{ color: 'var(--color-text)' }}>{opt.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
