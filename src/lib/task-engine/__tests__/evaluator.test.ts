import { describe, it, expect } from 'vitest';
import { evaluate } from '../evaluator';

describe('evaluator', () => {
  describe('exact mode', () => {
    it('returns correct for exact string match', () => {
      const result = evaluate('Na', 'Na', { mode: 'exact' });
      expect(result.correct).toBe(true);
      expect(result.score).toBe(1);
    });

    it('returns incorrect for mismatch', () => {
      const result = evaluate('Cl', 'Na', { mode: 'exact' });
      expect(result.correct).toBe(false);
      expect(result.score).toBe(0);
    });

    it('handles numeric comparison', () => {
      expect(evaluate(6, 6, { mode: 'exact' }).correct).toBe(true);
      expect(evaluate(6, 7, { mode: 'exact' }).correct).toBe(false);
    });

    it('handles array comparison', () => {
      expect(evaluate(['Na', 'Mg'], ['Na', 'Mg'], { mode: 'exact' }).correct).toBe(true);
      expect(evaluate(['Mg', 'Na'], ['Na', 'Mg'], { mode: 'exact' }).correct).toBe(false);
    });

    it('is the default for unknown modes', () => {
      const result = evaluate('Na', 'Na', { mode: 'unknown' as never });
      expect(result.correct).toBe(true);
      expect(result.score).toBe(1);
    });
  });

  describe('tolerance mode', () => {
    it('accepts within tolerance', () => {
      expect(evaluate(5.95, 6, { mode: 'tolerance', tolerance: 0.1 }).correct).toBe(true);
    });

    it('rejects outside tolerance', () => {
      expect(evaluate(5.5, 6, { mode: 'tolerance', tolerance: 0.1 }).correct).toBe(false);
    });

    it('accepts exact match with zero tolerance', () => {
      expect(evaluate(6, 6, { mode: 'tolerance', tolerance: 0 }).correct).toBe(true);
    });

    it('accepts value at tolerance boundary', () => {
      expect(evaluate(5.9, 6, { mode: 'tolerance', tolerance: 0.1 }).correct).toBe(true);
    });

    it('falls back to exact for non-numeric strings', () => {
      expect(evaluate('Na', 'Na', { mode: 'tolerance', tolerance: 0.1 }).correct).toBe(true);
      expect(evaluate('Na', 'Cl', { mode: 'tolerance', tolerance: 0.1 }).correct).toBe(false);
    });

    it('defaults tolerance to 0 when not specified', () => {
      expect(evaluate(6, 6, { mode: 'tolerance' }).correct).toBe(true);
      expect(evaluate(6.01, 6, { mode: 'tolerance' }).correct).toBe(false);
    });
  });

  describe('partial_credit mode', () => {
    it('gives full credit for correct order', () => {
      const result = evaluate(['Na', 'Mg', 'Cl'], ['Na', 'Mg', 'Cl'], { mode: 'partial_credit' });
      expect(result.correct).toBe(true);
      expect(result.score).toBe(1);
    });

    it('gives partial credit for partially correct order', () => {
      const result = evaluate(['Na', 'Cl', 'Mg'], ['Na', 'Mg', 'Cl'], { mode: 'partial_credit' });
      expect(result.correct).toBe(false);
      expect(result.score).toBeCloseTo(1 / 3);
    });

    it('gives partial credit when middle element matches (reversed array)', () => {
      // ['Cl','Mg','Na'] vs ['Na','Mg','Cl'] — only index 1 matches
      const result = evaluate(['Cl', 'Mg', 'Na'], ['Na', 'Mg', 'Cl'], { mode: 'partial_credit' });
      expect(result.correct).toBe(false);
      expect(result.score).toBeCloseTo(1 / 3);
    });

    it('gives zero when no positions match', () => {
      const result = evaluate(['B', 'C', 'A'], ['A', 'B', 'C'], { mode: 'partial_credit' });
      expect(result.score).toBe(0);
    });

    it('gives zero for length mismatch', () => {
      const result = evaluate(['Na', 'Mg'], ['Na', 'Mg', 'Cl'], { mode: 'partial_credit' });
      expect(result.correct).toBe(false);
      expect(result.score).toBe(0);
    });

    it('falls back to exact for non-array inputs', () => {
      expect(evaluate('Na', 'Na', { mode: 'partial_credit' }).correct).toBe(true);
      expect(evaluate('Na', 'Cl', { mode: 'partial_credit' }).correct).toBe(false);
    });
  });

  describe('set_equivalence mode', () => {
    it('accepts same elements in different order', () => {
      const result = evaluate(['Mg', 'Na', 'Cl'], ['Na', 'Cl', 'Mg'], { mode: 'set_equivalence' });
      expect(result.correct).toBe(true);
      expect(result.score).toBe(1);
    });

    it('rejects when sets differ', () => {
      const result = evaluate(['Na', 'Mg'], ['Na', 'Cl'], { mode: 'set_equivalence' });
      expect(result.correct).toBe(false);
      expect(result.score).toBe(0);
    });

    it('rejects when sizes differ', () => {
      const result = evaluate(['Na'], ['Na', 'Cl'], { mode: 'set_equivalence' });
      expect(result.correct).toBe(false);
      expect(result.score).toBe(0);
    });

    it('wraps non-array inputs as single-element sets', () => {
      expect(evaluate('Na', 'Na', { mode: 'set_equivalence' }).correct).toBe(true);
      expect(evaluate('Na', 'Cl', { mode: 'set_equivalence' }).correct).toBe(false);
    });
  });
});
