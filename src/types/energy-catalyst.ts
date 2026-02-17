export interface RateFactor {
  factor_id: string;
  name_ru: string;
  effect_ru: string;
  detail_ru: string;
  applies_to: 'all' | 'homogeneous' | 'heterogeneous';
}

export interface CatalystProperties {
  changes_ru: string[];
  does_not_change_ru: string[];
}

export interface CommonCatalyst {
  catalyst: string;
  name_ru: string;
  reaction_ru: string;
}

export interface EquilibriumShift {
  factor: string;
  shift_ru: string;
  explanation_ru: string;
}

export interface HeatClassification {
  exothermic_ru: string;
  endothermic_ru: string;
  examples_exo_ru: string[];
  examples_endo_ru: string[];
}

export interface EnergyCatalystTheory {
  rate_factors: RateFactor[];
  catalyst_properties: CatalystProperties;
  common_catalysts: CommonCatalyst[];
  equilibrium_shifts: EquilibriumShift[];
  heat_classification: HeatClassification;
}
