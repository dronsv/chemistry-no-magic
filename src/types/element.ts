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
  scientist?: string;
  country?: string;
}

export interface ElectronExceptionMove {
  from: [number, string];
  to: [number, string];
  count: number;
}

export type ElectronExceptionFamily =
  | 'half_filled_stability'
  | 'full_filled_stability'
  | 'exchange_energy'
  | 'energy_proximity';

export interface ElectronExceptionStabilization {
  family: ElectronExceptionFamily;
  target_subshell: string;
  target_pattern: 'half_filled' | 'full_filled' | 'high_exchange' | 'proximity';
  mechanism_ids?: string[];
  bridge_id?: string;
}

export interface ElectronException {
  config_override: [number, string, number][];
  expected_formula: string;
  actual_formula: string;
  rule: string;
  reason?: string;
  moves?: ElectronExceptionMove[];
  stabilization?: ElectronExceptionStabilization;
}

export interface Element {
  Z: number;
  symbol: string;
  name?: string;
  name_latin: string;
  group: number;
  period: number;
  metal_type: MetalType;
  element_group: ElementGroup;
  amphoteric?: boolean;
  atomic_mass: number;
  typical_oxidation_states: number[];
  electronegativity: number | null;
  melting_point_C?: number | null;
  boiling_point_C?: number | null;
  density_g_cm3?: number | null;
  discovery?: ElementDiscovery;
  hazards?: string[];
  storage_profiles?: string[];
  industrial?: string;
  production?: string;
  abundance?: string;
  fun_facts?: string[];
  electron_exception?: ElectronException;
}
