import { describe, it, expect, beforeAll } from 'vitest';
import {
  setConfigOverrides,
  toSuperscript,
  getNobleGasCore,
  getElectronConfig,
  getElectronFormula,
  getShorthandFormula,
  getValenceElectrons,
  isException,
  getOrbitalBoxes,
  getEnergyLevels,
} from '../electron-config.ts';

const TEST_ELEMENTS = [
  { Z: 1, symbol: 'H' },
  { Z: 2, symbol: 'He' },
  { Z: 8, symbol: 'O' },
  { Z: 11, symbol: 'Na' },
  { Z: 17, symbol: 'Cl' },
  {
    Z: 24,
    symbol: 'Cr',
    electron_exception: {
      config_override: [[4, 's', 1], [3, 'd', 5]] as [number, string, number][],
      expected_formula: '',
      actual_formula: '',
      rule: 'half-filled d',
      reason_ru: '',
    },
  },
  { Z: 26, symbol: 'Fe' },
  {
    Z: 29,
    symbol: 'Cu',
    electron_exception: {
      config_override: [[4, 's', 1], [3, 'd', 10]] as [number, string, number][],
      expected_formula: '',
      actual_formula: '',
      rule: 'filled d',
      reason_ru: '',
    },
  },
];

beforeAll(() => {
  setConfigOverrides(TEST_ELEMENTS);
});

describe('toSuperscript', () => {
  it('converts single digits', () => {
    expect(toSuperscript(2)).toBe('\u00B2');
    expect(toSuperscript(0)).toBe('\u2070');
    expect(toSuperscript(1)).toBe('\u00B9');
  });

  it('converts multi-digit numbers', () => {
    expect(toSuperscript(10)).toBe('\u00B9\u2070');
    expect(toSuperscript(14)).toBe('\u00B9\u2074');
  });
});

describe('getNobleGasCore', () => {
  it('returns null for H (Z=1)', () => {
    expect(getNobleGasCore(1)).toBeNull();
  });

  it('returns null for He (Z=2) since no noble gas is strictly below Z=2', () => {
    expect(getNobleGasCore(2)).toBeNull();
  });

  it('returns He for Li (Z=3)', () => {
    expect(getNobleGasCore(3)).toEqual({ Z: 2, symbol: 'He' });
  });

  it('returns Ne for Cl (Z=17)', () => {
    expect(getNobleGasCore(17)).toEqual({ Z: 10, symbol: 'Ne' });
  });

  it('returns Ar for Cr (Z=24)', () => {
    expect(getNobleGasCore(24)).toEqual({ Z: 18, symbol: 'Ar' });
  });

  it('returns Ar for Cu (Z=29)', () => {
    expect(getNobleGasCore(29)).toEqual({ Z: 18, symbol: 'Ar' });
  });
});

describe('getElectronConfig', () => {
  it('returns [1s1] for H (Z=1)', () => {
    const config = getElectronConfig(1);
    expect(config).toEqual([
      { n: 1, l: 's', electrons: 1, max: 2 },
    ]);
  });

  it('returns [1s2] for He (Z=2)', () => {
    const config = getElectronConfig(2);
    expect(config).toEqual([
      { n: 1, l: 's', electrons: 2, max: 2 },
    ]);
  });

  it('returns correct config for O (Z=8)', () => {
    const config = getElectronConfig(8);
    expect(config).toEqual([
      { n: 1, l: 's', electrons: 2, max: 2 },
      { n: 2, l: 's', electrons: 2, max: 2 },
      { n: 2, l: 'p', electrons: 4, max: 6 },
    ]);
  });

  it('returns correct config for Na (Z=11)', () => {
    const config = getElectronConfig(11);
    expect(config).toEqual([
      { n: 1, l: 's', electrons: 2, max: 2 },
      { n: 2, l: 's', electrons: 2, max: 2 },
      { n: 2, l: 'p', electrons: 6, max: 6 },
      { n: 3, l: 's', electrons: 1, max: 2 },
    ]);
  });

  it('returns correct config for Cl (Z=17)', () => {
    const config = getElectronConfig(17);
    expect(config).toEqual([
      { n: 1, l: 's', electrons: 2, max: 2 },
      { n: 2, l: 's', electrons: 2, max: 2 },
      { n: 2, l: 'p', electrons: 6, max: 6 },
      { n: 3, l: 's', electrons: 2, max: 2 },
      { n: 3, l: 'p', electrons: 5, max: 6 },
    ]);
  });

  it('applies Cr exception: 4s1 3d5 instead of 4s2 3d4', () => {
    const config = getElectronConfig(24);
    const s4 = config.find(e => e.n === 4 && e.l === 's');
    const d3 = config.find(e => e.n === 3 && e.l === 'd');
    expect(s4?.electrons).toBe(1);
    expect(d3?.electrons).toBe(5);
  });

  it('applies Cu exception: 4s1 3d10 instead of 4s2 3d9', () => {
    const config = getElectronConfig(29);
    const s4 = config.find(e => e.n === 4 && e.l === 's');
    const d3 = config.find(e => e.n === 3 && e.l === 'd');
    expect(s4?.electrons).toBe(1);
    expect(d3?.electrons).toBe(10);
  });

  it('total electrons equals Z', () => {
    for (const el of TEST_ELEMENTS) {
      const config = getElectronConfig(el.Z);
      const total = config.reduce((sum, e) => sum + e.electrons, 0);
      expect(total).toBe(el.Z);
    }
  });

  it('no subshell exceeds its capacity', () => {
    for (const el of TEST_ELEMENTS) {
      const config = getElectronConfig(el.Z);
      for (const entry of config) {
        expect(entry.electrons).toBeLessThanOrEqual(entry.max);
        expect(entry.electrons).toBeGreaterThan(0);
      }
    }
  });
});

describe('getElectronFormula', () => {
  it('formats H correctly', () => {
    expect(getElectronFormula(1)).toBe('1s\u00B9');
  });

  it('formats O correctly', () => {
    expect(getElectronFormula(8)).toBe('1s\u00B22s\u00B22p\u2074');
  });

  it('formats Na correctly', () => {
    expect(getElectronFormula(11)).toBe('1s\u00B22s\u00B22p\u20763s\u00B9');
  });

  it('formats Cr with exception, sorted by n,l', () => {
    // Cr config in filling order: ...3p6 4s1 3d5
    // Sorted by n,l: ...3p6 3d5 4s1
    expect(getElectronFormula(24)).toBe(
      '1s\u00B22s\u00B22p\u2076' +
      '3s\u00B23p\u20763d\u2075' +
      '4s\u00B9',
    );
  });

  it('formats Cu with exception, sorted by n,l', () => {
    expect(getElectronFormula(29)).toBe(
      '1s\u00B22s\u00B22p\u2076' +
      '3s\u00B23p\u20763d\u00B9\u2070' +
      '4s\u00B9',
    );
  });
});

describe('getShorthandFormula', () => {
  it('returns full formula for H (no noble gas core)', () => {
    expect(getShorthandFormula(1)).toBe('1s\u00B9');
  });

  it('returns [Ne] 3s1 for Na', () => {
    expect(getShorthandFormula(11)).toBe('[Ne] 3s\u00B9');
  });

  it('returns [Ne] 3s2 3p5 for Cl', () => {
    expect(getShorthandFormula(17)).toBe('[Ne] 3s\u00B23p\u2075');
  });

  it('returns [Ar] 3d5 4s1 for Cr', () => {
    expect(getShorthandFormula(24)).toBe('[Ar] 3d\u20754s\u00B9');
  });

  it('returns [Ar] 3d10 4s1 for Cu', () => {
    expect(getShorthandFormula(29)).toBe('[Ar] 3d\u00B9\u20704s\u00B9');
  });

  it('returns just [He] for He (noble gas itself)', () => {
    expect(getShorthandFormula(2)).toBe('1s\u00B2');
  });
});

describe('getValenceElectrons', () => {
  it('returns [3s1] for Na (1 valence electron)', () => {
    const valence = getValenceElectrons(11);
    expect(valence).toEqual([
      { n: 3, l: 's', electrons: 1, max: 2 },
    ]);
  });

  it('returns [3s2, 3p5] for Cl (7 valence electrons)', () => {
    const valence = getValenceElectrons(17);
    expect(valence).toEqual([
      { n: 3, l: 's', electrons: 2, max: 2 },
      { n: 3, l: 'p', electrons: 5, max: 6 },
    ]);
  });

  it('includes partially filled 3d and 4s for Fe (Z=26)', () => {
    const valence = getValenceElectrons(26);
    // Fe: [Ar] 3d6 4s2 — 3d is partially filled, so included
    const subshells = valence.map(v => `${v.n}${v.l}`);
    expect(subshells).toContain('3d');
    expect(subshells).toContain('4s');
  });

  it('returns [1s1] for H', () => {
    const valence = getValenceElectrons(1);
    expect(valence).toEqual([
      { n: 1, l: 's', electrons: 1, max: 2 },
    ]);
  });

  it('returns [1s2] for He', () => {
    const valence = getValenceElectrons(2);
    expect(valence).toEqual([
      { n: 1, l: 's', electrons: 2, max: 2 },
    ]);
  });
});

describe('isException', () => {
  it('returns true for Cr (Z=24)', () => {
    expect(isException(24)).toBe(true);
  });

  it('returns true for Cu (Z=29)', () => {
    expect(isException(29)).toBe(true);
  });

  it('returns false for H (Z=1)', () => {
    expect(isException(1)).toBe(false);
  });

  it('returns false for Na (Z=11)', () => {
    expect(isException(11)).toBe(false);
  });

  it('returns false for Fe (Z=26)', () => {
    expect(isException(26)).toBe(false);
  });
});

describe('getOrbitalBoxes', () => {
  it('returns 1 box for H with [up, empty]', () => {
    const boxes = getOrbitalBoxes(1);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toEqual({ n: 1, l: 's', index: 0, spins: ['up', 'empty'] });
  });

  it('returns 1 box for He with [up, down]', () => {
    const boxes = getOrbitalBoxes(2);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toEqual({ n: 1, l: 's', index: 0, spins: ['up', 'down'] });
  });

  it('applies Hund rule for O 2p4: first 3 up, then pair from left', () => {
    const boxes = getOrbitalBoxes(8);
    // O config: 1s2, 2s2, 2p4
    // 1s: 1 box [up, down]
    // 2s: 1 box [up, down]
    // 2p: 3 boxes, 4 electrons => [up,down], [up,empty], [up,empty]
    const p2boxes = boxes.filter(b => b.n === 2 && b.l === 'p');
    expect(p2boxes).toHaveLength(3);
    expect(p2boxes[0].spins).toEqual(['up', 'down']);
    expect(p2boxes[1].spins).toEqual(['up', 'empty']);
    expect(p2boxes[2].spins).toEqual(['up', 'empty']);
  });

  it('fills all orbitals with up before pairing for N 2p3', () => {
    // N (Z=7): 1s2, 2s2, 2p3 — half-filled, all up no pairing
    const boxes = getOrbitalBoxes(7);
    const p2boxes = boxes.filter(b => b.n === 2 && b.l === 'p');
    expect(p2boxes).toHaveLength(3);
    expect(p2boxes[0].spins).toEqual(['up', 'empty']);
    expect(p2boxes[1].spins).toEqual(['up', 'empty']);
    expect(p2boxes[2].spins).toEqual(['up', 'empty']);
  });

  it('fully pairs all orbitals for Ne 2p6', () => {
    // Ne (Z=10): 1s2, 2s2, 2p6 — fully paired
    const boxes = getOrbitalBoxes(10);
    const p2boxes = boxes.filter(b => b.n === 2 && b.l === 'p');
    expect(p2boxes).toHaveLength(3);
    for (const box of p2boxes) {
      expect(box.spins).toEqual(['up', 'down']);
    }
  });

  it('total box count matches sum of subshell orbital counts', () => {
    // Na (Z=11): 1s(1) + 2s(1) + 2p(3) + 3s(1) = 6 boxes
    const boxes = getOrbitalBoxes(11);
    expect(boxes).toHaveLength(6);
  });

  it('applies exception for Cr 3d5: all 5 d-orbitals half-filled', () => {
    const boxes = getOrbitalBoxes(24);
    const d3boxes = boxes.filter(b => b.n === 3 && b.l === 'd');
    expect(d3boxes).toHaveLength(5);
    for (const box of d3boxes) {
      expect(box.spins).toEqual(['up', 'empty']);
    }
  });
});

describe('getEnergyLevels', () => {
  it('returns levels in filling order with energy_order indices', () => {
    const levels = getEnergyLevels(11);
    // Na: 1s, 2s, 2p, 3s
    expect(levels).toHaveLength(4);
    expect(levels[0]).toMatchObject({ n: 1, l: 's', energy_order: 0 });
    expect(levels[1]).toMatchObject({ n: 2, l: 's', energy_order: 1 });
    expect(levels[2]).toMatchObject({ n: 2, l: 'p', energy_order: 2 });
    expect(levels[3]).toMatchObject({ n: 3, l: 's', energy_order: 3 });
  });

  it('marks 3s as valence for Na', () => {
    const levels = getEnergyLevels(11);
    const s3 = levels.find(l => l.n === 3 && l.l === 's');
    expect(s3?.is_valence).toBe(true);
  });

  it('marks inner shells as non-valence for Na', () => {
    const levels = getEnergyLevels(11);
    const inner = levels.filter(l => !(l.n === 3 && l.l === 's'));
    for (const level of inner) {
      expect(level.is_valence).toBe(false);
    }
  });

  it('marks partially filled 3d as valence for Fe', () => {
    const levels = getEnergyLevels(26);
    const d3 = levels.find(l => l.n === 3 && l.l === 'd');
    const s4 = levels.find(l => l.n === 4 && l.l === 's');
    expect(d3?.is_valence).toBe(true);
    expect(s4?.is_valence).toBe(true);
  });

  it('returns correct electron counts', () => {
    const levels = getEnergyLevels(17);
    const total = levels.reduce((sum, l) => sum + l.electrons, 0);
    expect(total).toBe(17);
  });
});
