import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderFormulaExplanation, renderTrendExplanation } from '../explanation-renderer';
import { evaluateFormula, solveFor, toConstantsDict } from '../formula-evaluator';
import { reasonTrend } from '../trend-reasoner';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { TrendRule } from '../../types/trend-rule';
import type { TrendAnomaly } from '../../types/storage';

const DATA_DIR = join(import.meta.dirname, '../../../data-src');
const formulas: ComputableFormula[] = JSON.parse(readFileSync(join(DATA_DIR, 'foundations/formulas.json'), 'utf8'));
const constants: PhysicalConstant[] = JSON.parse(readFileSync(join(DATA_DIR, 'foundations/constants.json'), 'utf8'));
const trendRules: TrendRule[] = JSON.parse(readFileSync(join(DATA_DIR, 'foundations/trend_rules.json'), 'utf8'));
const exceptions: TrendAnomaly[] = JSON.parse(readFileSync(join(DATA_DIR, 'rules/periodic_trend_anomalies.json'), 'utf8'));
const CONSTS = toConstantsDict(constants);

function findFormula(id: string): ComputableFormula {
  const f = formulas.find(fm => fm.id === id);
  if (!f) throw new Error(`Formula not found: ${id}`);
  return f;
}

// ── renderFormulaExplanation ────────────────────────────────────

describe('renderFormulaExplanation', () => {
  it('n = m / M: shows formula, substitution, result', () => {
    const f = findFormula('formula:amount_from_mass');
    const trace = evaluateFormula(f, { m: 58.44, M: 58.44 }, CONSTS);
    const expl = renderFormulaExplanation(trace, f);

    expect(expl.source_id).toBe('formula:amount_from_mass');
    expect(expl.steps).toHaveLength(3);
    expect(expl.steps[0].type).toBe('formula');
    expect(expl.steps[0].text).toContain('n');
    expect(expl.steps[1].type).toBe('substitution');
    expect(expl.steps[1].text).toContain('58.44');
    expect(expl.steps[2].type).toBe('result');
    expect(expl.steps[2].text).toContain('1');
  });

  it('molar mass from composition: no substitution step (indexed bindings)', () => {
    const f = findFormula('formula:molar_mass_from_composition');
    const trace = evaluateFormula(f, {}, CONSTS, {
      composition_elements: [
        { Ar_i: 22.99, count_i: 1 },
        { Ar_i: 35.45, count_i: 1 },
      ],
    });
    const expl = renderFormulaExplanation(trace, f);

    expect(expl.steps).toHaveLength(2); // formula + result (no top-level substitutions)
    expect(expl.steps[0].type).toBe('formula');
    expect(expl.steps[1].type).toBe('result');
    expect(expl.steps[1].text).toContain('58.44');
  });

  it('inversion: solve for m shows target variable', () => {
    const f = findFormula('formula:amount_from_mass');
    const trace = solveFor(f, 'm', { n: 2, M: 58.44 }, CONSTS);
    const expl = renderFormulaExplanation(trace, f);

    expect(expl.steps[0].text).toContain('m');
    expect(expl.steps[0].text).toContain('=');
    expect(expl.steps.at(-1)!.text).toContain('116.88');
  });

  it('density formula: shows both bindings', () => {
    const f = findFormula('formula:density');
    const trace = evaluateFormula(f, { m: 100, V: 50 }, CONSTS);
    const expl = renderFormulaExplanation(trace, f);

    expect(expl.steps[1].type).toBe('substitution');
    expect(expl.steps[1].text).toContain('m = 100');
    expect(expl.steps[1].text).toContain('V = 50');
    expect(expl.steps[2].text).toContain('2');
  });

  it('photon energy: uses constant (no substitution for const ref)', () => {
    const f = findFormula('formula:photon_energy');
    const trace = evaluateFormula(f, { nu: 5e14 }, CONSTS);
    const expl = renderFormulaExplanation(trace, f);

    // nu is the only input binding (h is a constant, not in substitutions)
    expect(expl.steps[1].type).toBe('substitution');
    expect(expl.steps[1].text).toContain('nu');
  });

  it('result step formats numbers without trailing zeros', () => {
    const f = findFormula('formula:density');
    const trace = evaluateFormula(f, { m: 100, V: 50 }, CONSTS);
    const expl = renderFormulaExplanation(trace, f);

    expect(expl.steps[2].text).toBe('rho = 2');
  });
});

// ── renderTrendExplanation ──────────────────────────────────────

describe('renderTrendExplanation', () => {
  const Na = { symbol: 'Na', Z: 11, group: 1, period: 3 };
  const Cl = { symbol: 'Cl', Z: 17, group: 17, period: 3 };
  const Li = { symbol: 'Li', Z: 3, group: 1, period: 2 };
  const K  = { symbol: 'K', Z: 19, group: 1, period: 4 };
  const Be = { symbol: 'Be', Z: 4, group: 2, period: 2 };
  const B  = { symbol: 'B', Z: 5, group: 13, period: 2 };
  const Fe = { symbol: 'Fe', Z: 26, group: 8, period: 4 };

  it('EN across period: context + chain + result', () => {
    const trace = reasonTrend('electronegativity', Na, Cl, trendRules, exceptions);
    const expl = renderTrendExplanation(trace);

    expect(expl.source_id).toBe('trend:en_across_period');
    expect(expl.steps[0].type).toBe('trend');
    expect(expl.steps[0].text).toContain('same period');
    // reasoning chain steps
    expect(expl.steps.length).toBeGreaterThanOrEqual(4); // context + 3 chain + result
    // result step
    const resultStep = expl.steps.find(s => s.type === 'result');
    expect(resultStep).toBeDefined();
    expect(resultStep!.text).toContain('Cl');
    expect(resultStep!.text).toContain('higher');
  });

  it('IE down group: uses group context', () => {
    const trace = reasonTrend('ionization_energy', Li, K, trendRules, exceptions);
    const expl = renderTrendExplanation(trace);

    expect(expl.steps[0].text).toContain('same group');
    const resultStep = expl.steps.find(s => s.type === 'result');
    expect(resultStep!.text).toContain('Li');
  });

  it('IE with exception: includes exception step', () => {
    const trace = reasonTrend('ionization_energy', Be, B, trendRules, exceptions);
    const expl = renderTrendExplanation(trace);

    const excStep = expl.steps.find(s => s.type === 'exception');
    expect(excStep).toBeDefined();
    expect(excStep!.key).toBe('exc:ie_be_b');
    expect(excStep!.text).toContain('filled_s_subshell');
  });

  it('no applicable trend: single step', () => {
    const trace = reasonTrend('electronegativity', Na, Fe, trendRules, exceptions);
    const expl = renderTrendExplanation(trace);

    expect(expl.steps).toHaveLength(1);
    expect(expl.steps[0].key).toBe('no_trend');
  });

  it('property without trend rules: single step', () => {
    const trace = reasonTrend('density', Na, Cl, trendRules, exceptions);
    const expl = renderTrendExplanation(trace);

    expect(expl.steps).toHaveLength(1);
    expect(expl.steps[0].key).toBe('no_trend');
  });

  it('reasoning chain steps match trend rule data', () => {
    const trace = reasonTrend('ionization_energy', Na, Cl, trendRules, exceptions);
    const expl = renderTrendExplanation(trace);

    // Chain steps are between context (index 0) and result (last non-exception)
    const chainSteps = expl.steps.filter(s => s.type === 'trend' && s.key !== 'context');
    expect(chainSteps).toHaveLength(3);
    expect(chainSteps[0].key).toBe('qrel:zeff_in_period');
    expect(chainSteps[1].key).toBe('qrel:atomic_radius_factors');
    expect(chainSteps[2].key).toBe('qrel:ionization_energy_factors');
  });
});

// ── Integration: formula + trend for same element pair ──────────

describe('integration: combined formula + trend explanations', () => {
  it('generates both quantitative and qualitative explanations', () => {
    // Quantitative: compute molar mass of NaCl
    const f = findFormula('formula:molar_mass_from_composition');
    const fTrace = evaluateFormula(f, {}, CONSTS, {
      composition_elements: [
        { Ar_i: 22.99, count_i: 1 },
        { Ar_i: 35.45, count_i: 1 },
      ],
    });
    const fExpl = renderFormulaExplanation(fTrace, f);

    // Qualitative: compare EN of Na vs Cl
    const Na = { symbol: 'Na', Z: 11, group: 1, period: 3 };
    const Cl = { symbol: 'Cl', Z: 17, group: 17, period: 3 };
    const tTrace = reasonTrend('electronegativity', Na, Cl, trendRules, exceptions);
    const tExpl = renderTrendExplanation(tTrace);

    // Both produce valid explanations
    expect(fExpl.steps.length).toBeGreaterThan(0);
    expect(tExpl.steps.length).toBeGreaterThan(0);
    expect(fExpl.source_id).toContain('formula:');
    expect(tExpl.source_id).toContain('trend:');
  });
});
