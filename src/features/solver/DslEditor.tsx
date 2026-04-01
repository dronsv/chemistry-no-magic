import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { PredicateDef } from '../../types/predicate.js';
import type { AutocompleteOption } from './SlotAutocomplete.js';
import FormulaChip from '../../components/FormulaChip.js';

// ── Context detection ────────────────────────────────────────

type CursorContext =
  | { kind: 'intent'; prefix: string }
  | { kind: 'predicate'; prefix: string; intent: string }
  | { kind: 'entity'; prefix: string; predicateId: string; argIndex: number }
  | { kind: 'given_predicate'; prefix: string }
  | { kind: 'given_value'; prefix: string }
  | { kind: 'none' };

const INTENTS = ['find', 'derive', 'check'];

/**
 * Analyze text up to cursor position to determine what kind of completion to offer.
 */
function detectContext(text: string, cursor: number): CursorContext {
  const before = text.slice(0, cursor);

  // No opening paren yet → typing intent
  if (!before.includes('(')) {
    return { kind: 'intent', prefix: before.trim() };
  }

  // Inside given=[ ... ] → given context
  const givenMatch = before.match(/given=\[([^\]]*)$/);
  if (givenMatch) {
    const givenContent = givenMatch[1];
    // After "= " → value
    if (givenContent.match(/=\s*[^,]*$/)) {
      const valMatch = givenContent.match(/=\s*([^,]*)$/);
      return { kind: 'given_value', prefix: valMatch?.[1]?.trim() ?? '' };
    }
    // After ", " or start → predicate for given
    const lastComma = givenContent.lastIndexOf(',');
    const prefix = lastComma >= 0 ? givenContent.slice(lastComma + 1).trim() : givenContent.trim();
    return { kind: 'given_predicate', prefix };
  }

  // Extract intent
  const intentMatch = before.match(/^(\w+)\(/);
  if (!intentMatch) return { kind: 'none' };
  const intent = intentMatch[1];

  // After "intent(" → count depth to determine if we're in predicate or entity position
  const afterIntent = before.slice(intentMatch[0].length);

  // If no predicate-level paren yet → typing predicate
  if (!afterIntent.includes('(')) {
    // Could be "derive(quanti..." or "derive(quantity.mass" (not yet opened args paren)
    // Check if there's a comma after predicate (meaning given section)
    const prefix = afterIntent.replace(/,.*$/, '').trim();
    return { kind: 'predicate', prefix, intent };
  }

  // We have "intent(predicate(" → inside entity args
  const predMatch = afterIntent.match(/^([a-z_.]+)\(/);
  if (predMatch) {
    const predicateId = predMatch[1];
    const argsSection = afterIntent.slice(predMatch[0].length);

    // Count commas to determine arg index
    // But also check if we closed the predicate paren
    let depth = 1;
    let argIndex = 0;
    let lastArgStart = 0;
    for (let i = 0; i < argsSection.length; i++) {
      if (argsSection[i] === '(') depth++;
      if (argsSection[i] === ')') depth--;
      if (depth === 0) {
        // We closed the predicate args — now in top-level (given= section?)
        const afterClose = argsSection.slice(i + 1).trim();
        if (afterClose.startsWith(',')) {
          // After comma → could be "given=[..." or just more text
          const rest = afterClose.slice(1).trim();
          if (rest.startsWith('given=')) {
            // Already handled above
            return { kind: 'none' };
          }
          return { kind: 'none' };
        }
        return { kind: 'none' };
      }
      if (argsSection[i] === ',' && depth === 1) {
        argIndex++;
        lastArgStart = i + 1;
      }
    }

    // Still inside predicate args
    const prefix = argsSection.slice(lastArgStart).trim();
    return { kind: 'entity', prefix, predicateId, argIndex };
  }

  return { kind: 'none' };
}

// ── Suggestion types ─────────────────────────────────────────

interface Suggestion {
  label: string;
  insertText: string;
  detail?: string;
  formula?: string;
}

// ── Props ────────────────────────────────────────────────────

export interface EntityDataSources {
  substances: AutocompleteOption[];
  elements: AutocompleteOption[];
  ions: AutocompleteOption[];
}

interface Props {
  predicates: PredicateDef[];
  dataSources: EntityDataSources;
  locale: string;
  value: string;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
}

export default function DslEditor({ predicates, dataSources, locale, value, onChange, onSubmit }: Props) {
  const [focusIdx, setFocusIdx] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const cursorPos = inputRef.current?.selectionStart ?? value.length;
  const context = useMemo(() => detectContext(value, cursorPos), [value, cursorPos]);

  // Build suggestions based on context
  const suggestions: Suggestion[] = useMemo(() => {
    switch (context.kind) {
      case 'intent': {
        const q = context.prefix.toLowerCase();
        return INTENTS
          .filter(i => i.startsWith(q) || !q)
          .map(i => ({
            label: i,
            insertText: `${i}(`,
            detail: i === 'find' ? 'Найти' : i === 'derive' ? 'Вычислить' : 'Проверить',
          }));
      }

      case 'predicate': {
        const q = context.prefix.toLowerCase();
        return predicates
          .filter(p => p.role !== 'context')
          .filter(p => {
            if (context.intent === 'derive' && !p.returns.startsWith('scalar:')) return false;
            return true;
          })
          .filter(p => {
            if (!q) return true;
            const aliases = p.aliases?.[locale] ?? p.aliases?.['ru'] ?? [];
            const tokens = p.search_tokens?.[locale] ?? p.search_tokens?.['ru'] ?? [];
            return (
              p.id.toLowerCase().includes(q) ||
              aliases.some(a => a.toLowerCase().includes(q)) ||
              tokens.some(t => t.toLowerCase().startsWith(q))
            );
          })
          .slice(0, 15)
          .map(p => {
            const name = p.aliases?.[locale]?.[0] ?? p.aliases?.['ru']?.[0] ?? p.id;
            const hasArgs = p.positional_args.length > 0;
            return {
              label: name,
              insertText: hasArgs ? `${p.id}(` : `${p.id}()`,
              detail: p.namespace,
            };
          });
      }

      case 'entity': {
        const q = context.prefix.toLowerCase();
        const pred = predicates.find(p => p.id === context.predicateId);
        const argDef = pred?.positional_args[context.argIndex];
        const argType = argDef?.type ?? '';

        let options: AutocompleteOption[];
        if (argType.includes('Element')) options = dataSources.elements;
        else if (argType.includes('Ion')) options = dataSources.ions;
        else if (argType.includes('Substance')) options = dataSources.substances;
        else options = [...dataSources.elements, ...dataSources.substances];

        return options
          .filter(o => {
            if (!q) return true;
            return (
              o.label.toLowerCase().includes(q) ||
              (o.formula && o.formula.toLowerCase().includes(q)) ||
              o.id.toLowerCase().includes(q)
            );
          })
          .slice(0, 15)
          .map(o => ({
            label: o.formula ?? o.label,
            insertText: o.id,
            detail: o.label,
            formula: o.formula,
          }));
      }

      case 'given_predicate': {
        const q = context.prefix.toLowerCase();
        return predicates
          .filter(p => p.namespace === 'quantity')
          .filter(p => {
            if (!q) return true;
            const aliases = p.aliases?.[locale] ?? p.aliases?.['ru'] ?? [];
            return p.id.includes(q) || aliases.some(a => a.toLowerCase().includes(q));
          })
          .slice(0, 10)
          .map(p => {
            const name = p.aliases?.[locale]?.[0] ?? p.id;
            return {
              label: name,
              insertText: `${p.id}(`,
              detail: 'quantity',
            };
          });
      }

      default:
        return [];
    }
  }, [context, predicates, dataSources, locale]);

  // Reset focus when suggestions change
  useEffect(() => { setFocusIdx(0); }, [suggestions]);

  // Show suggestions when we have them and context is active
  useEffect(() => {
    setShowSuggestions(suggestions.length > 0 && context.kind !== 'none');
  }, [suggestions, context]);

  // Scroll focused item into view
  useEffect(() => {
    if (!showSuggestions || !listRef.current) return;
    const item = listRef.current.children[focusIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx, showSuggestions]);

  const handleSelect = useCallback((suggestion: Suggestion) => {
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);

    // Replace the current prefix with the suggestion
    let newBefore: string;
    switch (context.kind) {
      case 'intent':
        newBefore = suggestion.insertText;
        break;
      case 'predicate': {
        const intentParen = before.indexOf('(');
        newBefore = before.slice(0, intentParen + 1) + suggestion.insertText;
        break;
      }
      case 'entity': {
        // Find last comma or opening paren in args section
        const lastSep = Math.max(before.lastIndexOf(','), before.lastIndexOf('('));
        newBefore = before.slice(0, lastSep + 1) + suggestion.insertText;
        break;
      }
      case 'given_predicate': {
        const givenStart = before.lastIndexOf('[');
        const lastComma = before.lastIndexOf(',');
        const start = Math.max(givenStart, lastComma) + 1;
        newBefore = before.slice(0, start) + suggestion.insertText;
        break;
      }
      default:
        newBefore = before + suggestion.insertText;
    }

    const newText = newBefore + after;
    onChange(newText);
    setShowSuggestions(false);

    // Move cursor to end of insertion
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.selectionStart = newBefore.length;
        inputRef.current.selectionEnd = newBefore.length;
        inputRef.current.focus();
      }
    }, 0);
  }, [value, cursorPos, context, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelect(suggestions[focusIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    // Ctrl+Enter or plain Enter when no suggestions → submit
    if (e.key === 'Enter' && !showSuggestions) {
      e.preventDefault();
      onSubmit(value);
    }
  }, [showSuggestions, suggestions, focusIdx, handleSelect, onSubmit, value]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(suggestions.length > 0 && context.kind !== 'none')}
        placeholder="derive(quantity.mass(NaCl), given=[quantity.amount(NaCl) = 2 mol])"
        style={{
          width: '100%',
          padding: '0.625rem 0.875rem',
          border: '1px solid var(--color-border, #d1d5db)',
          borderRadius: '0.5rem',
          fontSize: '0.95rem',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          background: 'var(--color-bg, #fff)',
          color: 'var(--color-text, #1f2937)',
          outline: 'none',
        }}
        autoComplete="off"
        spellCheck={false}
      />

      {showSuggestions && suggestions.length > 0 && (
        <ul
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 30,
            margin: '2px 0 0',
            padding: '4px 0',
            listStyle: 'none',
            background: 'var(--color-bg, #fff)',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            maxHeight: '240px',
            overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.insertText + i}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setFocusIdx(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.375rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.88rem',
                background: i === focusIdx ? 'var(--color-bg-muted, #f3f4f6)' : 'transparent',
              }}
            >
              {s.formula ? (
                <FormulaChip formula={s.formula} />
              ) : (
                <span style={{ fontWeight: 500 }}>{s.label}</span>
              )}
              {s.detail && (
                <span style={{ color: 'var(--color-text-muted, #9ca3af)', fontSize: '0.8rem', marginLeft: 'auto' }}>
                  {s.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
