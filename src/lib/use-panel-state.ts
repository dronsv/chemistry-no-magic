import { useState, useEffect, useCallback, useRef } from 'react';

interface PanelState {
  isOpen: boolean;
  pos: { x: number; y: number };
  hasMoved: boolean;
}

const STORAGE_PREFIX = 'panel:';

function load(key: string): PanelState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(key: string, state: PanelState) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Hook that persists floating panel open/closed state and drag position
 * across Astro ViewTransitions page navigations via sessionStorage.
 *
 * Uses two-pass render to avoid hydration mismatch:
 * 1st render uses defaults (matches server), then useEffect restores stored state.
 */
export function usePanelState(key: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const restoredRef = useRef(false);

  // Restore from sessionStorage after hydration (client-only)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stored = load(key);
    if (stored) {
      setIsOpen(stored.isOpen);
      setPos(stored.pos);
      setHasMoved(stored.hasMoved);
    }
  }, [key]);

  // Persist on every change (skip the initial default-state write)
  useEffect(() => {
    if (!restoredRef.current) return;
    save(key, { isOpen, pos, hasMoved });
  }, [key, isOpen, pos, hasMoved]);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return { isOpen, setIsOpen, pos, setPos, hasMoved, setHasMoved, toggle, close };
}
