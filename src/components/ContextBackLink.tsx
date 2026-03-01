import { useState, useEffect } from 'react';

/**
 * Known navigation contexts.
 * When linking to a concept/substance page, append ?from=<context> to the URL.
 * This component reads that param (or falls back to document.referrer) and
 * renders a contextual "back" button that returns the user to where they came from.
 */

interface BackContext {
  label: string;
  href: string;
}

const CONTEXT_PATTERNS: Array<{
  /** Matches ?from= value or referrer pathname substring */
  match: string;
  labelKey: 'exam' | 'practice' | 'diagnostics';
}> = [
  { match: 'exam', labelKey: 'exam' },
  { match: 'practice', labelKey: 'practice' },
  { match: 'competency', labelKey: 'practice' },
  { match: 'diagnostics', labelKey: 'diagnostics' },
  { match: 'diagnostyka', labelKey: 'diagnostics' },
  { match: 'diagnostico', labelKey: 'diagnostics' },
];

interface Props {
  labels: Record<string, string>;
}

export default function ContextBackLink({ labels }: Props) {
  const [ctx, setCtx] = useState<BackContext | null>(null);

  useEffect(() => {
    // 1. Check ?from= query param
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');

    if (from) {
      const pattern = CONTEXT_PATTERNS.find(p => from === p.match);
      if (pattern) {
        // Try to get referrer URL for back navigation, fall back to history.back
        const label = labels[pattern.labelKey] ?? labels.previous;
        setCtx({ label, href: '' });
        return;
      }
      // from= is a direct URL
      if (from.startsWith('/')) {
        setCtx({ label: labels.previous, href: from });
        return;
      }
    }

    // 2. Fall back to document.referrer (same-origin only)
    try {
      const ref = document.referrer;
      if (!ref) return;
      const refUrl = new URL(ref);
      if (refUrl.origin !== window.location.origin) return;

      const path = refUrl.pathname;
      const pattern = CONTEXT_PATTERNS.find(p => path.includes(p.match));
      if (pattern) {
        const label = labels[pattern.labelKey] ?? labels.previous;
        setCtx({ label, href: path });
      }
    } catch { /* invalid referrer */ }
  }, [labels]);

  if (!ctx) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (ctx.href) {
      window.location.href = ctx.href;
    } else {
      window.history.back();
    }
  };

  return (
    <a
      href={ctx.href || '#'}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        marginBottom: '0.75rem',
        fontSize: '0.8125rem',
        fontWeight: 500,
        color: '#2563eb',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '0.375rem',
        textDecoration: 'none',
        cursor: 'pointer',
        maxWidth: 'fit-content',
      }}
    >
      <span aria-hidden="true">&larr;</span>
      {ctx.label}
    </a>
  );
}
