import { useState, useEffect, useCallback, useRef } from 'react';

interface PanelState {
  isOpen: boolean;
  pos: { x: number; y: number };
  hasMoved: boolean;
}

const STORAGE_PREFIX = 'panel:';
/** Minimum visible area (px) that must stay in viewport on each edge. */
const VIEWPORT_MARGIN = 48;

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

/** Clamp position so the panel header stays reachable within the viewport. */
function clampToViewport(p: { x: number; y: number }): { x: number; y: number } {
  if (typeof window === 'undefined') return p;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.max(VIEWPORT_MARGIN - 200, Math.min(p.x, vw - VIEWPORT_MARGIN)),
    y: Math.max(0, Math.min(p.y, vh - VIEWPORT_MARGIN)),
  };
}

/**
 * Hook that persists floating panel open/closed state and drag position
 * across Astro ViewTransitions page navigations via sessionStorage.
 *
 * Uses two-pass render to avoid hydration mismatch:
 * 1st render uses defaults (matches server), then useEffect restores stored state.
 *
 * Clamps position to viewport on restore and window resize so the panel
 * never gets lost offscreen.
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
      setPos(stored.hasMoved ? clampToViewport(stored.pos) : stored.pos);
      setHasMoved(stored.hasMoved);
    }
  }, [key]);

  // Clamp position on window resize (only for panels that were dragged)
  useEffect(() => {
    if (!isOpen || !hasMoved) return;
    function handleResize() {
      setPos(prev => clampToViewport(prev));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, hasMoved]);

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
