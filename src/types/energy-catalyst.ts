export interface RateFactor {
  factor_id: string;
  name: string;
  effect: string;
  detail: string;
  applies_to: 'all' | 'homogeneous' | 'heterogeneous';
}

export interface CatalystProperties {
  changes: string[];
  does_not_change: string[];
}

export interface CommonCatalyst {
  catalyst: string;
  name: string;
  reaction: string;
}

export interface EquilibriumShift {
  factor: string;
  shift: string;
  explanation: string;
}

export interface HeatClassification {
  exothermic: string;
  endothermic: string;
  examples_exo: string[];
  examples_endo: string[];
}

export interface EnergyCatalystTheory {
  rate_factors: RateFactor[];
  catalyst_properties: CatalystProperties;
  common_catalysts: CommonCatalyst[];
  equilibrium_shifts: EquilibriumShift[];
  heat_classification: HeatClassification;
}
