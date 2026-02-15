import type { CompetencyId } from '../types/competency';

const STORAGE_KEY = 'chemistry_bkt_state';

interface StoredEntry {
  P_L: number;
  updated_at: string;
}

type StoredState = Record<string, StoredEntry>;

/** Load all P(L) values from localStorage. */
export function loadBktState(): Map<CompetencyId, number> {
  const map = new Map<CompetencyId, number>();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return map;
    const parsed: StoredState = JSON.parse(raw);
    for (const [id, entry] of Object.entries(parsed)) {
      map.set(id as CompetencyId, entry.P_L);
    }
  } catch {
    // corrupted data — return empty
  }
  return map;
}

/** Save updated P(L) for one competency. */
export function saveBktPL(competencyId: CompetencyId, pL: number): void {
  const state = loadStoredState();
  state[competencyId] = { P_L: pL, updated_at: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Save full state (used after diagnostics completes). */
export function saveBktState(state: Map<CompetencyId, number>): void {
  const stored: StoredState = {};
  const now = new Date().toISOString();
  for (const [id, pL] of state) {
    stored[id] = { P_L: pL, updated_at: now };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/** Check if diagnostics have been completed at least once. */
export function hasDiagnosticsResult(): boolean {
  return loadBktState().size > 0;
}

/** Clear all BKT state. */
export function clearBktState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredState;
  } catch {
    return {};
  }
}
