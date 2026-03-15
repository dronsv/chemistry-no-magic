export interface BondTypeInfo {
  id: string;
  name: string;
  description: string;
  rule: string;
  examples: string[];
  properties: string;
}

import type { MatterRef } from './matter';

export interface CrystalStructureInfo {
  id: string;
  name: string;
  bond_type: string;
  description: string;
  properties: {
    melting_point: string;
    hardness: string;
    conductivity: string;
    solubility: string;
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
  entity_ref?: string;
}

export interface BondExamplesData {
  examples: BondExampleEntry[];
  crystal_melting_rank: Record<string, number>;
}
