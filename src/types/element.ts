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
}
