import { useState, useEffect, useCallback } from 'react';

interface CollapsibleSectionProps {
  id: string;
  pageKey: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
}

function getStorageKey(pageKey: string): string {
  return `theory_sections:${pageKey}`;
}

function readCollapsed(pageKey: string): Record<string, true> {
  try {
    const raw = localStorage.getItem(getStorageKey(pageKey));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCollapsed(pageKey: string, collapsed: Record<string, true>): void {
  try {
    const filtered = Object.fromEntries(
      Object.entries(collapsed).filter(([, v]) => v),
    );
    if (Object.keys(filtered).length === 0) {
      localStorage.removeItem(getStorageKey(pageKey));
    } else {
      localStorage.setItem(getStorageKey(pageKey), JSON.stringify(filtered));
    }
  } catch {
    // localStorage unavailable
  }
}

export default function CollapsibleSection({
  id,
  pageKey,
  title,
  children,
  defaultOpen = true,
  forceOpen = false,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(() => {
    const collapsed = readCollapsed(pageKey);
    return collapsed[id] ? false : defaultOpen;
  });

  // forceOpen: when transitions to true, open the section
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
    }
  }, [forceOpen]);

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      const collapsed = readCollapsed(pageKey);
      if (next) {
        delete collapsed[id];
      } else {
        collapsed[id] = true;
      }
      writeCollapsed(pageKey, collapsed);
      return next;
    });
  }, [id, pageKey]);

  return (
    <div className={`theory-section ${open ? 'theory-section--open' : ''}`}>
      <button
        type="button"
        className="theory-section__toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="theory-section__title">{title}</span>
        <span className="theory-section__arrow">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="theory-section__body">{children}</div>}
    </div>
  );
}

/** Read/write the main theory panel open/closed state */
export function useTheoryPanelState(page: string): [boolean, () => void] {
  const key = `theory_panel:${page}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== 'false';
    } catch {
      return true;
    }
  });

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      try {
        if (next) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, 'false');
        }
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, [key]);

  return [open, toggle];
}
