import type { RichText } from './ontology-ref';

// ---------------------------------------------------------------------------
// Frame arg types (for Language Frame blocks)
// ---------------------------------------------------------------------------

export type FrameArg =
  | { t: 'substance_ref'; formula: string; substanceId?: string }
  | { t: 'ion_ref'; formula: string; ionId?: string }
  | { t: 'concept_ref'; id: string }
  | { t: 'value'; v: string | number }
  | { t: 'enum'; key: string };

// ---------------------------------------------------------------------------
// Table helper types
// ---------------------------------------------------------------------------

export interface TableRow {
  cells: string[];
}

// ---------------------------------------------------------------------------
// TheoryBlock union — all block types supported by TheoryModulePanel
// ---------------------------------------------------------------------------

export type TheoryBlock =
  // Legacy / concept blocks
  | { t: 'concept_card'; conceptId: string; reactivity_rules?: RichText;
      examples: { mode: 'filter'; limit?: number } }
  | { t: 'text_block'; content: RichText }
  // Text content
  | { t: 'heading'; level: 2 | 3 | 4; text: string }
  | { t: 'paragraph'; text: string }
  | { t: 'ordered_list'; items: string[] }
  | { t: 'equation'; text: string }
  // Formula display
  | { t: 'formula_list'; formulas: string[] }
  // Structured cards
  | { t: 'rule_card'; title: string; rule: string; description?: string; examples?: string[] }
  | { t: 'example_block'; label: string; content: string }
  // Table
  | { t: 'table'; columns: string[]; rows: TableRow[] }
  // Embedded React component (SolubilityTable, ActivitySeriesBar, etc.)
  | { t: 'component_slot'; component: string; props?: Record<string, unknown> }
  // Language frame (semantic event → localized sentence)
  | { t: 'frame'; frame_id: string; args: Record<string, FrameArg> }
  // Oxidation rule reference (renders from oxidation_rules.json, localized via its own overlays)
  | { t: 'ox_rule'; rule_id: string };

// ---------------------------------------------------------------------------
// Section and Module
// ---------------------------------------------------------------------------

export interface TheorySection {
  id: string;
  title: string;
  /** Legacy: concept ref for title */
  title_ref?: string;
  blocks: TheoryBlock[];
}

export interface TheoryModule {
  id: string;
  kind: 'theory_module';
  applies_to: string[];
  sections: TheorySection[];
}

export interface Course {
  id: string;
  title: string;
  modules: string[];
}
