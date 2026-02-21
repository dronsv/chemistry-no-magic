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

// ---------------------------------------------------------------------------
// Cross-exam progress (lightweight per-system counters, not BKT)
// ---------------------------------------------------------------------------

const CROSS_EXAM_KEY = 'chemistry_cross_exam';

interface CrossExamEntry {
  attempted: number;
  correct: number;
}

type CrossExamState = Record<string, Record<string, CrossExamEntry>>;

/** Save a cross-exam attempt (systemId + topicId). */
export function saveCrossExamAttempt(systemId: string, topicId: string, correct: boolean): void {
  const state = loadCrossExamState();
  if (!state[systemId]) state[systemId] = {};
  if (!state[systemId][topicId]) state[systemId][topicId] = { attempted: 0, correct: 0 };
  state[systemId][topicId].attempted++;
  if (correct) state[systemId][topicId].correct++;
  try {
    localStorage.setItem(CROSS_EXAM_KEY, JSON.stringify(state));
  } catch { /* storage full */ }
}

/** Load all cross-exam progress. */
export function loadCrossExamProgress(): CrossExamState {
  return loadCrossExamState();
}

function loadCrossExamState(): CrossExamState {
  try {
    const raw = localStorage.getItem(CROSS_EXAM_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CrossExamState;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------

function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredState;
  } catch {
    return {};
  }
}
