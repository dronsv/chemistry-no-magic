import type { Intent } from '../../types/query-ast.js';

interface Props {
  value: Intent | null;
  onChange: (intent: Intent) => void;
}

interface IntentOption {
  value: Intent;
  label: string;
  description: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  { value: 'find', label: 'Найти', description: 'класс, свойство' },
  { value: 'derive', label: 'Вычислить', description: 'числовую величину' },
  { value: 'check', label: 'Проверить', description: 'условие или факт' },
];

export default function IntentSelector({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {INTENT_OPTIONS.map(opt => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.125rem',
              padding: '0.5rem 1rem',
              border: isActive
                ? '2px solid var(--color-primary)'
                : '2px solid var(--color-border)',
              borderRadius: '0.5rem',
              background: isActive
                ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                : 'var(--color-bg)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              transition: 'border-color 0.15s, background 0.15s',
              boxShadow: isActive
                ? '0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent)'
                : 'none',
            }}
          >
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
              }}
            >
              {opt.label}
            </span>
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
              }}
            >
              {opt.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
