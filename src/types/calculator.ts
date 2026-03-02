/** Calculator registry entry (from data-src/calculators.json). */
export interface CalculatorDef {
  id: string;
  entity_type: 'substance' | 'element' | 'reaction';
  inputs: string[];
  outputs: string[];
  trace: boolean;
  notes?: string[];
}

/** Calculator registry file format. */
export interface CalculatorRegistry {
  version: number;
  calculators: CalculatorDef[];
}

/** Bond energy record in the table. */
export interface BondEnergyRecord {
  avg: number;
  min?: number;
  max?: number;
  source?: string;
}

/** Bond energy averages table (v1). */
export interface BondEnergyTableV1 {
  version: number;
  unit: 'kJ/mol';
  bonds: Record<string, BondEnergyRecord>;
}

/** Single line in a bond energy trace. */
export interface BondEnergyTraceLine {
  bond: string;
  count: number;
  E: number;
  subtotal: number;
  source: string;
}

/** Full trace for a bond energy calculation. */
export interface CalcTrace {
  calc_id: string;
  entity_id: string;
  table_version: number;
  unit: 'kJ/mol';
  total: number;
  quality: 'estimated' | 'partial' | 'missing';
  lines: BondEnergyTraceLine[];
  notes: string[];
}

/** Result of calcBondEnergyV1. */
export interface BondEnergyResult {
  bond_energy_total_est_kj_mol: number;
  bond_types: string[];
  bond_energy_quality: 'estimated' | 'partial' | 'missing';
  trace: CalcTrace;
}
