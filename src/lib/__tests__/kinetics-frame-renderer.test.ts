import { describe, it, expect } from 'vitest';
import { renderKineticsFrame } from '../kinetics-frame-renderer';
import type { KineticsRule } from '../../types/kinetics';

const PROP_NAMES = {
  'prop:temperature': 'температура',
  'prop:reactant_concentration': 'концентрация реагентов',
  'prop:reaction_rate': 'скорость реакции',
  'prop:surface_area': 'площадь поверхности',
  'prop:activation_energy': 'энергия активации',
  'prop:catalyst_presence': 'катализатор',
};

const CONCENTRATION_RULE: KineticsRule = {
  id: 'rule:kinetics.concentration.rate',
  kind: 'directional_influence',
  category: 'kinetics',
  domain: 'chemical_kinetics',
  source_property: 'prop:reactant_concentration',
  source_change: { operator: 'increase' },
  target_property: 'prop:reaction_rate',
  target_response: { mode: 'direction', direction: 'increase' },
};

const VANTHOFF_RULE: KineticsRule = {
  id: 'rule:vanthoff.school.temperature_rate',
  kind: 'quantified_influence',
  category: 'kinetics',
  domain: 'chemical_kinetics',
  source_property: 'prop:temperature',
  source_change: { operator: 'increase_by', value: 10, unit: 'unit:K' },
  target_property: 'prop:reaction_rate',
  target_response: { mode: 'multiplier_range', min: 2, max: 4 },
};

const CATALYST_EA_RULE: KineticsRule = {
  id: 'rule:kinetics.catalyst.activation_energy',
  kind: 'directional_influence',
  category: 'kinetics',
  domain: 'chemical_kinetics',
  source_property: 'prop:catalyst_presence',
  source_change: { operator: 'enable' },
  target_property: 'prop:activation_energy',
  target_response: { mode: 'direction', direction: 'decrease' },
};

const LAW: KineticsRule = {
  id: 'law:vanthoff_rule',
  kind: 'empirical_rule',
  category: 'kinetics',
  domain: 'chemical_kinetics',
};

describe('renderKineticsFrame', () => {
  it('returns null for empirical_rule kind', () => {
    expect(renderKineticsFrame(LAW, PROP_NAMES)).toBeNull();
  });

  it('renders directional_influence with increase', () => {
    const frame = renderKineticsFrame(CONCENTRATION_RULE, PROP_NAMES);
    expect(frame).not.toBeNull();
    expect(frame!.source).toBe('концентрация реагентов');
    expect(frame!.sourceSymbol).toBe('↑');
    expect(frame!.delta).toBeUndefined();
    expect(frame!.target).toBe('скорость реакции');
    expect(frame!.targetSymbol).toBe('↑');
    expect(frame!.compact).toContain('→');
  });

  it('renders quantified_influence with delta and multiplier range', () => {
    const frame = renderKineticsFrame(VANTHOFF_RULE, PROP_NAMES);
    expect(frame).not.toBeNull();
    expect(frame!.source).toBe('температура');
    expect(frame!.sourceSymbol).toBe('↑');
    expect(frame!.delta).toBe('10\u202fK'); // unit:K not in propNames → stripNs fallback → "K"
    expect(frame!.targetSymbol).toBe('×\u202f2–4');
  });

  it('resolves unit name from propNames when unit:K is explicitly mapped', () => {
    const propsWithUnit = { ...PROP_NAMES, 'unit:K': 'Kelvin' };
    const frame = renderKineticsFrame(VANTHOFF_RULE, propsWithUnit);
    expect(frame!.delta).toBe('10\u202fKelvin');
  });

  it('renders enable operator as "+"', () => {
    const frame = renderKineticsFrame(CATALYST_EA_RULE, PROP_NAMES);
    expect(frame!.sourceSymbol).toBe('+');
    expect(frame!.targetSymbol).toBe('↓');
  });

  it('compact contains source and target names', () => {
    const frame = renderKineticsFrame(CONCENTRATION_RULE, PROP_NAMES);
    expect(frame!.compact).toContain('концентрация реагентов');
    expect(frame!.compact).toContain('скорость реакции');
  });

  it('falls back to stripped id for unknown prop', () => {
    const frame = renderKineticsFrame(CONCENTRATION_RULE, {});
    expect(frame!.source).toBe('reactant\u00a0concentration');
  });
});
