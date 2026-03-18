import { describe, it, expect } from 'vitest';
import type { EntityCharacteristics } from '../../types/characteristic';
import { getEntityCharValue, getEntityCharEntry } from '../characteristics-utils';

const entityChars: EntityCharacteristics = {
  'concept:electronegativity': { value: 0.93 },
  'concept:atomic_mass': { value: 22.99, unit: 'unit:u' },
  'concept:pKa': [
    { value: -3, conditions: { dissociation_step: 1, solvent: 'water', temperature_C: 25 } },
    { value: 1.99, conditions: { dissociation_step: 2, solvent: 'water', temperature_C: 25 } },
  ],
};

describe('getEntityCharValue', () => {
  it('returns value for simple characteristic', () => {
    expect(getEntityCharValue(entityChars, 'concept:electronegativity')).toBe(0.93);
  });
  it('returns undefined for missing concept', () => {
    expect(getEntityCharValue(entityChars, 'concept:density')).toBeUndefined();
  });
  it('returns undefined for undefined characteristics', () => {
    expect(getEntityCharValue(undefined, 'concept:electronegativity')).toBeUndefined();
  });
  it('returns first array entry when no step specified', () => {
    expect(getEntityCharValue(entityChars, 'concept:pKa')).toBe(-3);
  });
  it('returns specific step value', () => {
    expect(getEntityCharValue(entityChars, 'concept:pKa', 1)).toBe(-3);
    expect(getEntityCharValue(entityChars, 'concept:pKa', 2)).toBe(1.99);
  });
});

describe('getEntityCharEntry', () => {
  it('returns full entry with unit', () => {
    const entry = getEntityCharEntry(entityChars, 'concept:atomic_mass');
    expect(entry?.value).toBe(22.99);
    expect(entry?.unit).toBe('unit:u');
  });
  it('returns array entry with conditions', () => {
    const entry = getEntityCharEntry(entityChars, 'concept:pKa', 2);
    expect(entry?.value).toBe(1.99);
    expect(entry?.conditions?.dissociation_step).toBe(2);
  });
});
