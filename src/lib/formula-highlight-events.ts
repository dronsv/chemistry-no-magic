/**
 * Cross-island communication for formula highlighting.
 * Uses DOM CustomEvents since Astro islands can't share React context.
 */

const EVENT_NAME = 'formula:highlight';

export interface FormulaHighlightDetail {
  /** Element symbols present in the formula (e.g. ['Na', 'Cl']) */
  elements: string[];
  /** Raw formula string (e.g. 'NaCl') for solubility table reverse-index lookup */
  formula?: string;
  /** Ion ID (e.g. 'Na_plus') for direct row/column selection in solubility table */
  ionId?: string;
}

export function dispatchHighlight(detail: FormulaHighlightDetail | null): void {
  document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

/** Subscribe to highlight events. Returns cleanup function for useEffect. */
export function onHighlight(callback: (detail: FormulaHighlightDetail | null) => void): () => void {
  const handler = (e: Event) => callback((e as CustomEvent<FormulaHighlightDetail | null>).detail);
  document.addEventListener(EVENT_NAME, handler);
  return () => document.removeEventListener(EVENT_NAME, handler);
}
