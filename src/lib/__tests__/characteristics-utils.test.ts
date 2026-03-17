import { describe, it, expect } from 'vitest';
import type { TypedCharacteristic } from '../../types/characteristic';
import { indexCharacteristicsBySubject, indexCharacteristicsByConcept, getCharacteristicValue } from '../characteristics-utils';

const sampleChars: TypedCharacteristic[] = [
  { id: 'char:Na_en', characteristic_concept_id: 'concept:electronegativity', subject_id: 'el:Na', value_kind: 'number', value: 0.93, source: { kind: 'asserted' } },
  { id: 'char:Na_am', characteristic_concept_id: 'concept:atomic_mass', subject_id: 'el:Na', value_kind: 'number', value: 22.99, unit: 'unit:u', source: { kind: 'asserted' } },
  { id: 'char:Cl_en', characteristic_concept_id: 'concept:electronegativity', subject_id: 'el:Cl', value_kind: 'number', value: 3.16, source: { kind: 'asserted' } },
  { id: 'char:h2so4_pka1', characteristic_concept_id: 'concept:pKa', subject_id: 'sub:h2so4', value_kind: 'number', value: -3, conditions: { dissociation_step: 1 }, source: { kind: 'asserted' } },
  { id: 'char:h2so4_pka2', characteristic_concept_id: 'concept:pKa', subject_id: 'sub:h2so4', value_kind: 'number', value: 1.99, conditions: { dissociation_step: 2 }, source: { kind: 'asserted' } },
];

describe('indexCharacteristicsBySubject', () => {
  it('groups by subject_id', () => {
    const map = indexCharacteristicsBySubject(sampleChars);
    expect(map.get('el:Na')).toHaveLength(2);
    expect(map.get('el:Cl')).toHaveLength(1);
    expect(map.get('sub:h2so4')).toHaveLength(2);
    expect(map.get('el:Fe')).toBeUndefined();
  });
});

describe('indexCharacteristicsByConcept', () => {
  it('groups by concept_id', () => {
    const map = indexCharacteristicsByConcept(sampleChars);
    expect(map.get('concept:electronegativity')).toHaveLength(2);
    expect(map.get('concept:atomic_mass')).toHaveLength(1);
    expect(map.get('concept:pKa')).toHaveLength(2);
  });
});

describe('getCharacteristicValue', () => {
  const map = indexCharacteristicsBySubject(sampleChars);

  it('returns value for known subject+concept', () => {
    expect(getCharacteristicValue(map.get('el:Na'), 'concept:electronegativity')).toBe(0.93);
  });

  it('returns undefined for unknown concept', () => {
    expect(getCharacteristicValue(map.get('el:Na'), 'concept:density')).toBeUndefined();
  });

  it('returns undefined for undefined chars array', () => {
    expect(getCharacteristicValue(undefined, 'concept:electronegativity')).toBeUndefined();
  });

  it('filters by dissociation step', () => {
    expect(getCharacteristicValue(map.get('sub:h2so4'), 'concept:pKa', 1)).toBe(-3);
    expect(getCharacteristicValue(map.get('sub:h2so4'), 'concept:pKa', 2)).toBe(1.99);
  });

  it('returns first pKa match when step not specified', () => {
    const val = getCharacteristicValue(map.get('sub:h2so4'), 'concept:pKa');
    expect(val).toBe(-3); // first match
  });
});
