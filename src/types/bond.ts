export interface BondTypeInfo {
  id: string;
  name_ru: string;
  description_ru: string;
  rule_ru: string;
  examples: string[];
  properties_ru: string;
}

import type { MatterRef } from './matter';

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
  examples: MatterRef[];
}

export interface BondTheory {
  bond_types: BondTypeInfo[];
  crystal_structures: CrystalStructureInfo[];
}

export interface BondExampleEntry {
  formula: string;
  bond_type: string;
  crystal_type: string;
}

export interface BondExamplesData {
  examples: BondExampleEntry[];
  crystal_melting_rank: Record<string, number>;
}
