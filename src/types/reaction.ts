import type { CompetencyId } from './competency';

export interface ReactionMolecularItem {
  formula: string;
  name?: string;
  coeff: number;
}

export interface ReactionIonic {
  full?: string;
  net?: string;
  spectators?: string[];
  note_key?: string;
}

// ── Observation types (v2 ontology-derived) ──────────────────────

export interface GasObservation {
  ref: string;
  formula: string;
  produced?: boolean;
  consumed?: boolean;
  appearance?: string;
  source: string;
  rule_id: string;
}

export interface PrecipitateObservation {
  ref: string;
  formula: string;
  formed: boolean;
  solubility: string;
  color?: string;
  texture?: string;
  source: string;
  rule_id: string;
}

export interface HeatIntensityObs {
  intensity: string;
  rule_id: string;
  source: string;
}

export interface SmellObs {
  kind: string;
  ref?: string;
  rule_id: string;
  source: string;
}

export interface ColorChangeObservation {
  type: string;
  ion_ref?: string;
  deposit?: { ref: string; color: string; surface_ref?: string };
  rule_id: string;
  source: string;
}

export interface OtherObservation {
  facet: string;
  surface_ref?: string;
  deposit_ref?: string;
  rule_id: string;
  source: string;
}

export interface ReactionObservations {
  gas?: GasObservation[];
  precipitate?: PrecipitateObservation[];
  heat_intensity?: HeatIntensityObs;
  smell?: SmellObs;
  color_change?: ColorChangeObservation[];
  other?: OtherObservation[];
}

// ── Rate tips & safety (v2 structured) ───────────────────────────

export interface SpeedupAction {
  action: string;
  note?: string;
  target_ref?: string;
  rule_id: string;
  source: string;
}

export interface SlowdownFactor {
  factor: string;
  intensity?: string;
  rule_id: string;
  source: string;
}

export interface ReactionRateTips {
  how_to_speed_up: SpeedupAction[];
  what_slows_down?: SlowdownFactor[];
}

export interface SafetyNote {
  hazard: string;
  agents?: string[];
  ref?: string;
  ppe?: string[];
  rule_id: string;
  source: string;
}

// ── Core types ───────────────────────────────────────────────────

export type HeatEffect = 'exo' | 'endo' | 'negligible' | 'unknown';

export interface RedoxInfo {
  oxidizer: { formula: string; element: string; from: number; to: number };
  reducer: { formula: string; element: string; from: number; to: number };
}

export interface Reaction {
  reaction_id: string;
  equation: string;
  template_id?: string;
  phase: { medium: 'aq' | 's' | 'l' | 'g' | 'mixed'; note_key?: string };
  conditions?: { temperature?: string; catalyst?: string; pressure?: string; excess_note_key?: string };
  type_tags: string[];
  driving_forces: string[];
  molecular: {
    reactants: ReactionMolecularItem[];
    products: ReactionMolecularItem[];
  };
  ionic: ReactionIonic;
  observations: ReactionObservations;
  rate_tips: ReactionRateTips;
  heat_effect: HeatEffect;
  safety_notes: SafetyNote[];
  competencies: Partial<Record<CompetencyId, 'P' | 'S'>>;
  redox?: RedoxInfo;
  schema_version: number;
}

export type MechanismFilter = 'all' | 'exchange' | 'substitution' | 'decomposition';
export type RedoxFilter = 'all' | 'redox' | 'non_redox';

export interface FacetState {
  mechanism: MechanismFilter;
  redox: RedoxFilter;
  drivingForces: Set<string>;
  substanceClasses: Set<string>;
  educationalGoals: Set<string>;
}
