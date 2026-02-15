export type SubshellType = 's' | 'p' | 'd' | 'f';
export type Spin = 'up' | 'down' | 'empty';

/** One subshell in the full electron configuration. */
export interface OrbitalFilling {
  n: number;
  l: SubshellType;
  electrons: number;
  max: number; // 2, 6, 10, or 14
}

/** One orbital box (for box diagram rendering with Hund's rule). */
export interface OrbitalBox {
  n: number;
  l: SubshellType;
  index: number; // orbital index within subshell (0-based)
  spins: [Spin, Spin];
}

/** Subshell on the energy level diagram. */
export interface EnergyLevel {
  n: number;
  l: SubshellType;
  energy_order: number; // Klechkowski filling position
  electrons: number;
  is_valence: boolean;
}

/** Exception element data (loaded from JSON). */
export interface ElectronConfigException {
  Z: number;
  symbol: string;
  expected_formula: string;
  actual_formula: string;
  rule: 'half_filled_stability' | 'full_filled_stability' | 'exchange_energy';
  reason_ru: string;
}
