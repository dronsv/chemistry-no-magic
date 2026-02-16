export type MetalType = 'metal' | 'nonmetal' | 'metalloid';

export type ElementGroup =
  | 'alkali_metal'
  | 'alkaline_earth'
  | 'transition_metal'
  | 'post_transition_metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble_gas'
  | 'lanthanide'
  | 'actinide';

export interface ElementDiscovery {
  year?: number;
  scientist_ru?: string;
  country_ru?: string;
}

export interface ElectronException {
  config_override: [number, string, number][];
  expected_formula: string;
  actual_formula: string;
  rule: string;
  reason_ru: string;
}

export interface Element {
  Z: number;
  symbol: string;
  name_ru: string;
  name_en: string;
  name_latin: string;
  group: number;
  period: number;
  metal_type: MetalType;
  element_group: ElementGroup;
  atomic_mass: number;
  typical_oxidation_states: number[];
  electronegativity: number | null;
  melting_point_C?: number | null;
  boiling_point_C?: number | null;
  density_g_cm3?: number | null;
  discovery?: ElementDiscovery;
  hazards_ru?: string[];
  storage_ru?: string;
  industrial_ru?: string;
  production_ru?: string;
  abundance_ru?: string;
  fun_facts_ru?: string[];
  electron_exception?: ElectronException;
}
