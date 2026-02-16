import type { CompetencyId } from './competency';

export interface ReactionMolecularItem {
  formula: string;
  name?: string;
  coeff: number;
}

export interface ReactionIonic {
  full?: string;
  net?: string;
  notes?: string;
}

export interface ReactionObservations {
  gas?: string[];
  precipitate?: string[];
  heat?: string;
  color_change?: string;
  smell?: string;
  other?: string[];
}

export interface ReactionRateTips {
  how_to_speed_up: string[];
  what_slows_down?: string[];
}

export type HeatEffect = 'exo' | 'endo' | 'negligible' | 'unknown';

export interface Reaction {
  reaction_id: string;
  title: string;
  equation: string;
  template_id?: string;
  phase: { medium: 'aq' | 's' | 'l' | 'g' | 'mixed'; notes?: string };
  conditions?: { temperature?: string; catalyst?: string; pressure?: string; excess?: string };
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
  safety_notes: string[];
  competencies: Partial<Record<CompetencyId, 'P' | 'S'>>;
  oge?: { topics?: string[]; typical_tasks?: string[] };
}
