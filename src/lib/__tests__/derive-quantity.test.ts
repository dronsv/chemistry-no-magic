import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { toConstantsDict } from '../formula-evaluator';
import { parseFormula } from '../formula-parser';
import { deriveQuantity } from '../derivation/derive-quantity';
import { qrefKey } from '../derivation/qref';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { Element } from '../../types/element';
import type { QRef, ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from '../derivation/resolvers';

// ── Data setup ───────────────────────────────────────────────────

const DATA_DIR = join(import.meta.dirname, '../../../data-src');
const formulas: ComputableFormula[] = JSON.parse(
  readFileSync(join(DATA_DIR, 'foundations/formulas.json'), 'utf8'),
);
const constants = toConstantsDict(
  JSON.parse(readFileSync(join(DATA_DIR, 'foundations/constants.json'), 'utf8')) as PhysicalConstant[],
);
const elements: Element[] = JSON.parse(
  readFileSync(join(DATA_DIR, 'elements.json'), 'utf8'),
);

// Build ontology access with a few test substances
const entityFormulas = new Map<string, string>([
  ['substance:H2SO4', 'H2SO4'],
  ['substance:H2O', 'H2O'],
  ['substance:NaCl', 'NaCl'],
  ['substance:CO2', 'CO2'],
  ['substance:NH3', 'NH3'],
]);

const ontology: OntologyAccess = { elements, parseFormula, entityFormulas };

// ── Helpers ──────────────────────────────────────────────────────

function molarMassTarget(entityRef: string): QRef {
  return { quantity: 'q:molar_mass', context: { system_type: 'substance', entity_ref: entityRef } };
}

function traceHas(trace: ReasonStep[], type: string): boolean {
  return trace.some(s => s.type === type);
}

function componentFractionTarget(element: string, substance: string): QRef {
  return {
    quantity: 'q:component_mass_fraction',
    context: {
      system_type: 'substance_component',
      entity_ref: `element:${element}`,
      parent_ref: `substance:${substance}`,
      bindings: { component: `element:${element}` },
    },
  };
}

function componentContributionTarget(element: string, substance: string): QRef {
  return {
    quantity: 'q:component_molar_mass_contribution',
    context: {
      system_type: 'substance_component',
      entity_ref: `element:${element}`,
      parent_ref: `substance:${substance}`,
      bindings: { component: `element:${element}` },
    },
  };
}

function traceStepsOfType<T extends ReasonStep['type']>(
  trace: ReasonStep[],
  type: T,
): Array<Extract<ReasonStep, { type: T }>> {
  return trace.filter((s): s is Extract<ReasonStep, { type: T }> => s.type === type);
}

// ── Tests ────────────────────────────────────────────────────────

describe('deriveQuantity', () => {
  describe('molar mass from substance', () => {
    it('M(H2SO4) ≈ 98.08', () => {
      const result = deriveQuantity({
        target: molarMassTarget('substance:H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(98.08, 0);
    });

    it('M(H2O) ≈ 18.015', () => {
      const result = deriveQuantity({
        target: molarMassTarget('substance:H2O'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(18.015, 1);
    });

    it('M(NaCl) ≈ 58.44', () => {
      const result = deriveQuantity({
        target: molarMassTarget('substance:NaCl'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(58.44, 0);
    });

    it('M(CO2) ≈ 44.01', () => {
      const result = deriveQuantity({
        target: molarMassTarget('substance:CO2'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(44.01, 0);
    });

    it('trace contains decompose step (structural only, no Ar)', () => {
      const result = deriveQuantity({
        target: molarMassTarget('substance:H2O'),
        knowns: [],
        formulas, constants, ontology,
      });
      const decomp = traceStepsOfType(result.trace, 'decompose');
      expect(decomp).toHaveLength(1);
      expect(decomp[0].sourceRef).toBe('substance:H2O');
      expect(decomp[0].components).toEqual(
        expect.arrayContaining([
          { element: 'H', count: 2 },
          { element: 'O', count: 1 },
        ]),
      );
      // decompose must NOT contain Ar — that comes from lookup steps
      for (const c of decomp[0].components) {
        expect(c).not.toHaveProperty('Ar');
      }
    });

    it('trace contains lookup steps (one per element, separate from decompose)', () => {
      const result = deriveQuantity({
        target: molarMassTarget('substance:H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      const lookups = traceStepsOfType(result.trace, 'lookup');
      // H, S, O → 3 elements
      expect(lookups).toHaveLength(3);
      const sources = lookups.map(l => l.source);
      expect(sources).toContain('element:H');
      expect(sources).toContain('element:S');
      expect(sources).toContain('element:O');
    });

    it('trace contains formula_select for molar_mass_from_composition', () => {
      const result = deriveQuantity({
        target: molarMassTarget('substance:H2O'),
        knowns: [],
        formulas, constants, ontology,
      });
      const selects = traceStepsOfType(result.trace, 'formula_select');
      expect(selects.some(s => s.formulaId === 'formula:molar_mass_from_composition')).toBe(true);
    });

    it('trace contains conclusion', () => {
      const result = deriveQuantity({
        target: molarMassTarget('substance:H2O'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(traceHas(result.trace, 'conclusion')).toBe(true);
      const conclusion = traceStepsOfType(result.trace, 'conclusion');
      expect(conclusion[0].value).toBeCloseTo(18.015, 1);
    });
  });

  describe('element lookup', () => {
    it('Ar(O) ≈ 15.999', () => {
      const result = deriveQuantity({
        target: {
          quantity: 'q:relative_atomic_mass',
          context: { system_type: 'element', entity_ref: 'element:O' },
        },
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(15.999, 2);
    });

    it('Ar(H) ≈ 1.008', () => {
      const result = deriveQuantity({
        target: {
          quantity: 'q:relative_atomic_mass',
          context: { system_type: 'element', entity_ref: 'element:H' },
        },
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(1.008, 2);
    });

    it('unknown element throws', () => {
      expect(() =>
        deriveQuantity({
          target: {
            quantity: 'q:relative_atomic_mass',
            context: { system_type: 'element', entity_ref: 'element:Xx' },
          },
          knowns: [],
          formulas, constants, ontology,
        }),
      ).toThrow();
    });
  });

  describe('mass/amount derivation', () => {
    it('m from n=2 for H2SO4 ≈ 196.16', () => {
      const result = deriveQuantity({
        target: {
          quantity: 'q:mass',
          context: { system_type: 'substance', entity_ref: 'substance:H2SO4' },
        },
        knowns: [{ qref: { quantity: 'q:amount' }, value: 2 }],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(196.16, 0);
    });

    it('n from m=98 for H2SO4 ≈ 1.0', () => {
      const result = deriveQuantity({
        target: {
          quantity: 'q:amount',
          context: { system_type: 'substance', entity_ref: 'substance:H2SO4' },
        },
        knowns: [{ qref: { quantity: 'q:mass' }, value: 98 }],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(1.0, 0);
    });

    it('trace includes M derivation then formula chain', () => {
      const result = deriveQuantity({
        target: {
          quantity: 'q:mass',
          context: { system_type: 'substance', entity_ref: 'substance:H2O' },
        },
        knowns: [{ qref: { quantity: 'q:amount' }, value: 3 }],
        formulas, constants, ontology,
      });
      // Should see: given → decompose → lookups → formula_select(composition) → compute → formula_select(amount_from_mass) → ... → conclusion
      expect(traceHas(result.trace, 'given')).toBe(true);
      expect(traceHas(result.trace, 'decompose')).toBe(true);
      expect(traceHas(result.trace, 'lookup')).toBe(true);
      expect(traceHas(result.trace, 'formula_select')).toBe(true);
      expect(traceHas(result.trace, 'conclusion')).toBe(true);
      expect(result.value).toBeCloseTo(54.045, 0);
    });
  });

  describe('backward compatibility', () => {
    it('context-free QRef works (pure formula chain)', () => {
      // n = m / M — no ontology context
      const result = deriveQuantity({
        target: { quantity: 'q:amount' },
        knowns: [
          { qref: { quantity: 'q:mass' }, value: 100 },
          { qref: { quantity: 'q:molar_mass' }, value: 50 },
        ],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(2, 5);
    });

    it('unknown substance throws', () => {
      expect(() =>
        deriveQuantity({
          target: molarMassTarget('substance:XYZ999'),
          knowns: [],
          formulas, constants, ontology,
        }),
      ).toThrow();
    });
  });

  describe('component mass fraction', () => {
    it('ω(O in H2SO4) ≈ 0.6526', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(0.6526, 2);
    });

    it('ω(H in H2O) ≈ 0.1119', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('H', 'H2O'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(0.1119, 2);
    });

    it('ω(N in NH3) ≈ 0.8224', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('N', 'NH3'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(0.8224, 2);
    });

    it('trace contains decompose step', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(traceHas(result.trace, 'decompose')).toBe(true);
    });

    it('trace contains component_molar_mass_contribution formula_select', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      const selects = traceStepsOfType(result.trace, 'formula_select');
      expect(selects.some(s => s.formulaId === 'formula:component_molar_mass_contribution')).toBe(true);
    });

    it('trace contains component_mass_fraction formula_select', () => {
      const result = deriveQuantity({
        target: componentFractionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      const selects = traceStepsOfType(result.trace, 'formula_select');
      expect(selects.some(s => s.formulaId === 'formula:component_mass_fraction')).toBe(true);
    });

    it('element not in substance throws', () => {
      expect(() =>
        deriveQuantity({
          target: componentFractionTarget('Fe', 'H2SO4'),
          knowns: [],
          formulas, constants, ontology,
        }),
      ).toThrow();
    });

    it('unknown substance throws', () => {
      expect(() =>
        deriveQuantity({
          target: componentFractionTarget('O', 'UNKNOWN'),
          knowns: [],
          formulas, constants, ontology,
        }),
      ).toThrow();
    });
  });

  describe('component molar mass contribution', () => {
    it('M_part(O in H2SO4) ≈ 63.996', () => {
      const result = deriveQuantity({
        target: componentContributionTarget('O', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(63.996, 1);
    });

    it('M_part(H in H2SO4) ≈ 2.016', () => {
      const result = deriveQuantity({
        target: componentContributionTarget('H', 'H2SO4'),
        knowns: [],
        formulas, constants, ontology,
      });
      expect(result.value).toBeCloseTo(2.016, 1);
    });
  });

  describe('qrefKey context extension', () => {
    it('context-free key unchanged', () => {
      expect(qrefKey({ quantity: 'q:mass' })).toBe('q:mass');
      expect(qrefKey({ quantity: 'q:mass', role: 'actual' })).toBe('q:mass|actual');
    });

    it('context appended to key', () => {
      expect(
        qrefKey({
          quantity: 'q:molar_mass',
          context: { system_type: 'substance', entity_ref: 'substance:H2O' },
        }),
      ).toBe('q:molar_mass@substance:substance:H2O');
    });

    it('context with bindings is sorted', () => {
      const key = qrefKey({
        quantity: 'q:atom_count_in_composition',
        context: {
          system_type: 'substance_component',
          entity_ref: 'element:O',
          parent_ref: 'substance:H2O',
          bindings: { component: 'element:O' },
        },
      });
      expect(key).toContain('substance_component');
      expect(key).toContain('element:O');
      expect(key).toContain('substance:H2O');
    });
  });
});
