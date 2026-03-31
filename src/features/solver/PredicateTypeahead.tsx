import { useState, useRef, useEffect, useCallback } from 'react';
import type { Intent } from '../../types/query-ast.js';
import type { PredicateDef } from '../../types/predicate.js';

interface Props {
  predicates: PredicateDef[];
  intent: Intent | null;
  locale: string;
  value: PredicateDef | null;
  onChange: (predicate: PredicateDef | null) => void;
}

/** Human-readable label for a returns string. */
function returnKindLabel(returns: string): string {
  if (/boolean/i.test(returns)) return 'да/нет';
  if (/^categorical/.test(returns)) return 'категория';
  if (/^set/.test(returns)) return 'список';
  if (/^scalar/.test(returns)) return 'число';
  return returns;
}

/** Rough background color for the result kind badge. */
function returnKindColor(returns: string): { bg: string; text: string } {
  if (/boolean/i.test(returns)) return { bg: '#fef9c3', text: '#854d0e' };
  if (/^categorical/.test(returns)) return { bg: '#f5f3ff', text: '#5b21b6' };
  if (/^set/.test(returns)) return { bg: '#eff6ff', text: '#1e40af' };
  if (/^scalar/.test(returns)) return { bg: '#f0fdf4', text: '#15803d' };
  return { bg: '#f9fafb', text: '#374151' };
}

/** Return true if a predicate should be shown for the given intent. */
function matchesIntent(pred: PredicateDef, intent: Intent | null): boolean {
  if (!intent) return true;
  // Never show context/constructor predicates as goals
  if (pred.role === 'context') return false;
  if (intent === 'derive') return /^scalar/.test(pred.returns);
  if (intent === 'find') return pred.role === 'goal';
  if (intent === 'check') {
    return /boolean/i.test(pred.returns) || /^categorical/.test(pred.returns) || pred.role === 'goal';
  }
  return true;
}

/** Return true if a predicate matches the text search query. */
function matchesText(pred: PredicateDef, query: string, locale: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  const aliases = pred.aliases[locale] ?? pred.aliases['ru'] ?? [];
  const tokens = pred.search_tokens[locale] ?? pred.search_tokens['ru'] ?? [];
  return (
    pred.id.toLowerCase().includes(q) ||
    aliases.some(a => a.toLowerCase().includes(q)) ||
    tokens.some(t => t.toLowerCase().includes(q))
  );
}

/** Get the primary display name for a predicate. */
function predicateLabel(pred: PredicateDef, locale: string): string {
  const aliases = pred.aliases[locale] ?? pred.aliases['ru'] ?? [];
  return aliases[0] ?? pred.id;
}

export default function PredicateTypeahead({ predicates, intent, locale, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusIdx, setFocusIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = predicates.filter(
    p => matchesIntent(p, intent) && matchesText(p, search, locale),
  );

  // Reset focus index when filter changes
  useEffect(() => {
    setFocusIdx(0);
  }, [search, intent]);

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

  // Focus input when dropdown opens
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

  const handleSelect = useCallback(
    (pred: PredicateDef) => {
      onChange(pred);
      setOpen(false);
      setSearch('');
    },
    [onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setOpen(false);
          setSearch('');
          break;
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
          if (filtered[focusIdx]) handleSelect(filtered[focusIdx]);
          break;
      }
    },
    [filtered, focusIdx, handleSelect],
  );

  // Selected chip
  if (value) {
    const kindColors = returnKindColor(value.returns);
    return (
      <div style={{ marginBottom: '1rem' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.375rem 0.75rem',
            border: '1px solid var(--color-primary)',
            borderRadius: '0.5rem',
            background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
            fontSize: '0.95rem',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              fontSize: '0.7rem',
              padding: '0.1rem 0.35rem',
              borderRadius: '0.25rem',
              background: '#f3f4f6',
              color: '#6b7280',
              fontWeight: 400,
              fontFamily: 'monospace',
            }}
          >
            {value.namespace}
          </span>
          <span style={{ color: 'var(--color-text)' }}>{predicateLabel(value, locale)}</span>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '0.25rem',
              background: kindColors.bg,
              color: kindColors.text,
              fontWeight: 500,
            }}
          >
            {returnKindLabel(value.returns)}
          </span>
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 0.125rem',
              color: 'var(--color-text-muted)',
              fontSize: '1rem',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Очистить"
          >
            ×
          </button>
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: '1rem' }}>
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setOpen(true);
          setFocusIdx(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Введите что вычислить..."
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '100%',
          padding: '0.625rem 1rem',
          border: open
            ? '2px solid var(--color-primary)'
            : '2px solid var(--color-border)',
          borderRadius: '0.5rem',
          fontSize: '0.95rem',
          fontFamily: 'inherit',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
          boxShadow: open
            ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent)'
            : 'none',
        }}
      />

      {open && (
        <ul
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.5rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            listStyle: 'none',
            margin: 0,
            padding: '0.25rem 0',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 && (
            <li
              style={{
                padding: '0.75rem 1rem',
                color: 'var(--color-text-muted)',
                fontSize: '0.88rem',
                textAlign: 'center',
              }}
            >
              Ничего не найдено
            </li>
          )}
          {filtered.map((pred, i) => {
            const kindColors = returnKindColor(pred.returns);
            const isFocused = i === focusIdx;
            return (
              <li
                key={pred.id}
                onMouseEnter={() => setFocusIdx(i)}
                onMouseDown={e => {
                  e.preventDefault();
                  handleSelect(pred);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  background: isFocused
                    ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)'
                    : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '0.25rem',
                    background: '#f3f4f6',
                    color: '#6b7280',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {pred.namespace}
                </span>
                <span
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--color-text)',
                    fontWeight: 500,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {predicateLabel(pred, locale)}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '0.25rem',
                    background: kindColors.bg,
                    color: kindColors.text,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {returnKindLabel(pred.returns)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
