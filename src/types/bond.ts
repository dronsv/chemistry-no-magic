export interface BondTypeInfo {
  id: string;
  name_ru: string;
  description_ru: string;
  rule_ru: string;
  examples: string[];
  properties_ru: string;
}

export interface CrystalStructureInfo {
  id: string;
  name_ru: string;
  bond_type: string;
  description_ru: string;
  properties: {
    melting_point_ru: string;
    hardness_ru: string;
    conductivity_ru: string;
    solubility_ru: string;
  };
  examples: string[];
}

export interface BondTheory {
  bond_types: BondTypeInfo[];
  crystal_structures: CrystalStructureInfo[];
}
