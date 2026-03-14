import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { toConstantsDict } from '../formula-evaluator';
import { parseFormula } from '../formula-parser';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { Element } from '../../types/element';
import type { QRef, ReasonStep } from '../../types/derivation';
import type { OntologyAccess } from '../derivation/resolvers';

// ── Data setup (same pattern as derive-quantity.test.ts) ─────────

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

const entityFormulas = new Map<string, string>([
  ['substance:H2SO4', 'H2SO4'],
  ['substance:H2O', 'H2O'],
  ['substance:NaCl', 'NaCl'],
  ['substance:BaSO4', 'BaSO4'],
  ['substance:BaCl2', 'BaCl2'],
  ['substance:HCl', 'HCl'],
]);

const ontology: OntologyAccess = { elements, parseFormula, entityFormulas };

function traceStepsOfType<T extends ReasonStep['type']>(
  trace: ReasonStep[],
  type: T,
): Array<Extract<ReasonStep, { type: T }>> {
  return trace.filter((s): s is Extract<ReasonStep, { type: T }> => s.type === type);
}

// ── Helper unit tests ────────────────────────────────────────────

import {
  deriveAmountForRole,
  deriveStoichiometricAmount,
  deriveMassForRole,
  applyYield,
  deriveYield,
} from '../derivation/stoichiometry-helpers';

describe('stoichiometry helper units', () => {
  describe('deriveAmountForRole', () => {
    it('n = m/M for reactant', () => {
      const trace: ReasonStep[] = [];
      const result = deriveAmountForRole({
        role: 'reactant',
        mass: 9.8,
        M: 98,
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(0.1, 5);
      expect(result.qref.quantity).toBe('q:amount');
      expect(result.qref.role).toBe('reactant');
    });

    it('n = m/M for product', () => {
      const trace: ReasonStep[] = [];
      const result = deriveAmountForRole({
        role: 'product',
        mass: 233,
        M: 233,
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(1.0, 5);
      expect(result.qref.role).toBe('product');
    });

    it('auto-derives M from entity_ref when M not provided', () => {
      const trace: ReasonStep[] = [];
      const result = deriveAmountForRole({
        role: 'reactant',
        mass: 98.08,
        entityRef: 'substance:H2SO4',
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(1.0, 1);
      // Trace should contain decompose + lookup steps from M derivation
      expect(trace.some(s => s.type === 'decompose')).toBe(true);
      expect(trace.some(s => s.type === 'lookup')).toBe(true);
    });
  });

  describe('deriveStoichiometricAmount', () => {
    it('forward: reactant → product (n₂ = n₁ × ν₂/ν₁)', () => {
      const trace: ReasonStep[] = [];
      const result = deriveStoichiometricAmount({
        n_from: 0.1,
        nu_from: 1,
        nu_to: 2,
        fromRole: 'reactant',
        toRole: 'product',
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(0.2, 5);
      expect(result.qref.quantity).toBe('q:amount');
      expect(result.qref.role).toBe('product');
    });

    it('reverse: product → reactant (n₁ via inversion)', () => {
      const trace: ReasonStep[] = [];
      const result = deriveStoichiometricAmount({
        n_from: 0.2,
        nu_from: 2,
        nu_to: 1,
        fromRole: 'product',
        toRole: 'reactant',
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(0.1, 5);
      expect(result.qref.role).toBe('reactant');
    });
  });

  describe('deriveMassForRole', () => {
    it('m = n × M for product', () => {
      const trace: ReasonStep[] = [];
      const result = deriveMassForRole({
        role: 'product',
        n: 0.05,
        M: 233.39,
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(11.67, 1);
      expect(result.qref.quantity).toBe('q:mass');
      expect(result.qref.role).toBe('product');
    });

    it('auto-derives M from entity_ref when M not provided', () => {
      const trace: ReasonStep[] = [];
      const result = deriveMassForRole({
        role: 'product',
        n: 1.0,
        entityRef: 'substance:H2O',
        formulas,
        constants,
        ontology,
        trace,
      });
      expect(result.value).toBeCloseTo(18.015, 0);
    });
  });

  describe('applyYield', () => {
    it('m_actual = (η/100) × m_theoretical', () => {
      const trace: ReasonStep[] = [];
      const result = applyYield({
        m_theoretical: 46.6,
        eta: 85,
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(39.61, 1);
      expect(result.qref.quantity).toBe('q:mass');
      expect(result.qref.role).toBe('product');
    });

    it('appends formula_select + substitution + compute to trace', () => {
      const trace: ReasonStep[] = [];
      applyYield({
        m_theoretical: 100,
        eta: 80,
        formulas,
        constants,
        trace,
      });
      expect(trace.some(s => s.type === 'formula_select')).toBe(true);
      expect(trace.some(s => s.type === 'compute')).toBe(true);
    });
  });

  describe('deriveYield', () => {
    it('η = (m_actual / m_theoretical) × 100', () => {
      const trace: ReasonStep[] = [];
      const result = deriveYield({
        m_actual: 39.61,
        m_theoretical: 46.6,
        formulas,
        constants,
        trace,
      });
      expect(result.value).toBeCloseTo(85, 0);
      expect(result.qref.quantity).toBe('q:yield');
      expect(result.qref.role).toBeUndefined();
    });
  });
});
