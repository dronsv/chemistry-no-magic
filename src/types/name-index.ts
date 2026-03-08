import type { EntityRef } from './matter';

export interface NameIndexEntry {
  ref: EntityRef;
  /** Source of this name: 'term' | 'element' | 'ion' | 'substance' */
  source: string;
  /** Original name or translated name (lowercase) */
  name: string;
}

/** Per-locale mapping: lowercase name → matching entities */
export type NameIndex = Record<string, NameIndexEntry[]>;
