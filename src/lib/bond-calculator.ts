import { parseFormula } from './formula-parser';
import type { MetalType } from '../types/element';

// --- Types ---

export type BondType = 'ionic' | 'covalent_polar' | 'covalent_nonpolar' | 'metallic';
export type CrystalStructure = 'ionic' | 'molecular' | 'atomic' | 'metallic';

export interface BondAnalysis {
  elementA: string;
  elementB: string;
  chiA: number | null;
  chiB: number | null;
  deltaChi: number | null;
  bondType: BondType;
  crystalStructure: CrystalStructure;
}

export interface FormulaAnalysis {
  formula: string;
  bonds: BondAnalysis[];
  crystalStructure: CrystalStructure;
}

/** Minimal element-like object required by bond functions. */
export interface ElementLike {
  symbol: string;
  electronegativity: number | null;
  metal_type: MetalType;
}

// --- Constants ---

/** Elements that form atomic (covalent) crystal lattices as simple substances. */
const ATOMIC_CRYSTAL_ELEMENTS = new Set(['C', 'Si', 'B', 'Ge']);

/** Compounds known to form atomic (covalent) crystal lattices. */
const ATOMIC_CRYSTAL_COMPOUNDS = new Set(['SiO2', 'B2O3', 'SiC', 'Al2O3']);

// --- Electronegativity thresholds ---
const IONIC_THRESHOLD = 1.7;
const POLAR_THRESHOLD = 0.4;

// --- Core functions ---

/** Determine bond type between two elements based on electronegativity and metal type. */
export function determineBondType(elA: ElementLike, elB: ElementLike): BondType {
  const sameElement = elA.symbol === elB.symbol;

  if (sameElement) {
    return elA.metal_type === 'metal' ? 'metallic' : 'covalent_nonpolar';
  }

  if (elA.metal_type === 'metal' && elB.metal_type === 'metal') {
    return 'metallic';
  }

  if (elA.electronegativity !== null && elB.electronegativity !== null) {
    const deltaChi = Math.abs(elA.electronegativity - elB.electronegativity);

    if (deltaChi >= IONIC_THRESHOLD) return 'ionic';
    if (deltaChi > POLAR_THRESHOLD) return 'covalent_polar';
    return 'covalent_nonpolar';
  }

  // Fallback when electronegativity data is missing
  const hasMetal = elA.metal_type === 'metal' || elB.metal_type === 'metal';
  const hasNonmetal = elA.metal_type === 'nonmetal' || elB.metal_type === 'nonmetal';

  if (hasMetal && hasNonmetal) return 'ionic';
  return 'covalent_nonpolar';
}

/** Determine crystal structure from bond type, formula, and element symbols. */
export function determineCrystalStructure(
  bondType: BondType,
  formula: string,
  symbols: string[],
): CrystalStructure {
  if (bondType === 'ionic') return 'ionic';
  if (bondType === 'metallic') return 'metallic';

  // Single-element atomic crystals (C, Si, B, Ge)
  if (symbols.length === 1 && ATOMIC_CRYSTAL_ELEMENTS.has(symbols[0])) {
    return 'atomic';
  }

  // Known atomic crystal compounds (SiO2, Al2O3, etc.)
  if (ATOMIC_CRYSTAL_COMPOUNDS.has(formula)) {
    return 'atomic';
  }

  return 'molecular';
}

/** Analyze a chemical formula: determine bonds and crystal structure. */
export function analyzeFormula(
  formula: string,
  elementMap: Map<string, ElementLike>,
): FormulaAnalysis {
  const parsed = parseFormula(formula);
  const symbols = Object.keys(parsed);

  if (symbols.length === 0) {
    return { formula, bonds: [], crystalStructure: 'molecular' };
  }

  // Single element: bond with itself
  if (symbols.length === 1) {
    const el = elementMap.get(symbols[0]);
    if (!el) {
      return { formula, bonds: [], crystalStructure: 'molecular' };
    }

    const bondType = determineBondType(el, el);
    const crystalStructure = determineCrystalStructure(bondType, formula, symbols);

    return {
      formula,
      bonds: [{
        elementA: el.symbol,
        elementB: el.symbol,
        chiA: el.electronegativity,
        chiB: el.electronegativity,
        deltaChi: 0,
        bondType,
        crystalStructure,
      }],
      crystalStructure,
    };
  }

  // Compound: find the pair with the largest electronegativity difference
  const elements = symbols
    .map(s => elementMap.get(s))
    .filter((el): el is ElementLike => el !== undefined);

  if (elements.length < 2) {
    return { formula, bonds: [], crystalStructure: 'molecular' };
  }

  const bond = findMaxDeltaChiPair(elements);
  const crystalStructure = determineCrystalStructure(bond.bondType, formula, symbols);

  return {
    formula,
    bonds: [{ ...bond, crystalStructure }],
    crystalStructure,
  };
}

// --- Helpers ---

/** Find the element pair with the largest electronegativity difference. */
function findMaxDeltaChiPair(elements: ElementLike[]): BondAnalysis {
  let bestPair: [ElementLike, ElementLike] = [elements[0], elements[1]];
  let bestDelta = computeDeltaChi(elements[0], elements[1]);

  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const delta = computeDeltaChi(elements[i], elements[j]);
      if (delta !== null && (bestDelta === null || delta > bestDelta)) {
        bestDelta = delta;
        bestPair = [elements[i], elements[j]];
      }
    }
  }

  const [elA, elB] = bestPair;
  const bondType = determineBondType(elA, elB);

  return {
    elementA: elA.symbol,
    elementB: elB.symbol,
    chiA: elA.electronegativity,
    chiB: elB.electronegativity,
    deltaChi: bestDelta,
    bondType,
    crystalStructure: 'molecular', // placeholder, overridden by caller
  };
}

/** Compute |chiA - chiB|, or null if either value is missing. */
function computeDeltaChi(elA: ElementLike, elB: ElementLike): number | null {
  if (elA.electronegativity === null || elB.electronegativity === null) {
    return null;
  }
  return Math.abs(elA.electronegativity - elB.electronegativity);
}
