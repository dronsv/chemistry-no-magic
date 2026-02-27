import { describe, it, expect } from 'vitest';
import type { BktParams } from '../../types/bkt.ts';
import { bktUpdate, getLevel } from '../bkt-engine.ts';

const DEFAULT_PARAMS: BktParams = {
  competency_id: 'periodic_table',
  P_L0: 0.25,
  P_T: 0.10,
  P_G: 0.20,
  P_S: 0.05,
};

describe('getLevel', () => {
  it('returns "none" for pL below 0.6', () => {
    expect(getLevel(0.0)).toBe('none');
    expect(getLevel(0.3)).toBe('none');
    expect(getLevel(0.59)).toBe('none');
  });

  it('returns "basic" for pL in [0.6, 0.8)', () => {
    expect(getLevel(0.6)).toBe('basic');
    expect(getLevel(0.7)).toBe('basic');
    expect(getLevel(0.79)).toBe('basic');
  });

  it('returns "confident" for pL in [0.8, 0.93)', () => {
    expect(getLevel(0.8)).toBe('confident');
    expect(getLevel(0.85)).toBe('confident');
    expect(getLevel(0.92)).toBe('confident');
  });

  it('returns "automatic" for pL >= 0.93', () => {
    expect(getLevel(0.93)).toBe('automatic');
    expect(getLevel(0.95)).toBe('automatic');
    expect(getLevel(1.0)).toBe('automatic');
  });

  it('handles exact boundary values correctly', () => {
    expect(getLevel(0.6)).toBe('basic');
    expect(getLevel(0.8)).toBe('confident');
    expect(getLevel(0.93)).toBe('automatic');
  });
});

describe('bktUpdate', () => {
  describe('correct answer without hint', () => {
    it('increases P(L) after correct answer', () => {
      const pL = 0.25;
      const result = bktUpdate(pL, DEFAULT_PARAMS, true, false);
      expect(result).toBeGreaterThan(pL);
    });

    it('higher initial pL yields higher result pL', () => {
      const low = bktUpdate(0.2, DEFAULT_PARAMS, true, false);
      const high = bktUpdate(0.6, DEFAULT_PARAMS, true, false);
      expect(high).toBeGreaterThan(low);
    });

    it('produces a meaningful increase for mid-range pL', () => {
      const pL = 0.5;
      const result = bktUpdate(pL, DEFAULT_PARAMS, true, false);
      expect(result).toBeGreaterThan(pL);
      expect(result).toBeLessThan(1.0);
    });

    it('computes the correct value with standard params', () => {
      // Manual calculation with pL=0.25, P_G=0.20, P_S=0.05, P_T=0.10+0.05=0.15
      // T becomes min(0.35, 0.10+0.05) = 0.15 (no hint)
      // Correct: posterior = pL*(1-S) / [pL*(1-S) + (1-pL)*G]
      //   = 0.25*0.95 / [0.25*0.95 + 0.75*0.20]
      //   = 0.2375 / (0.2375 + 0.15) = 0.2375 / 0.3875
      const posterior = 0.2375 / 0.3875;
      // Learning transition: posterior + (1 - posterior) * T
      const expected = posterior + (1 - posterior) * 0.15;
      const result = bktUpdate(0.25, DEFAULT_PARAMS, true, false);
      expect(result).toBeCloseTo(expected, 10);
    });
  });

  describe('wrong answer without hint', () => {
    it('produces lower result than correct answer from same starting pL', () => {
      const pL = 0.5;
      const afterCorrect = bktUpdate(pL, DEFAULT_PARAMS, true, false);
      const afterWrong = bktUpdate(pL, DEFAULT_PARAMS, false, false);
      expect(afterWrong).toBeLessThan(afterCorrect);
    });

    it('wrong answer with low pL stays relatively low', () => {
      const pL = 0.1;
      const result = bktUpdate(pL, DEFAULT_PARAMS, false, false);
      // Should still be below "basic" threshold
      expect(result).toBeLessThan(0.6);
    });

    it('can still increase pL due to learning transition', () => {
      // Even a wrong answer applies learning transition P_T
      // With very low initial pL, the learning transition can push it up slightly
      const pL = 0.001;
      const result = bktUpdate(pL, DEFAULT_PARAMS, false, false);
      // Learning transition adds (1 - posterior) * T, so result should be > posterior
      expect(result).toBeGreaterThan(0.001);
    });

    it('computes the correct value with standard params', () => {
      // pL=0.25, P_G=0.20, P_S=0.05, T=0.15 (no hint: min(0.35, 0.10+0.05))
      // Wrong: posterior = pL*S / [pL*S + (1-pL)*(1-G)]
      //   = 0.25*0.05 / [0.25*0.05 + 0.75*0.80]
      //   = 0.0125 / (0.0125 + 0.60) = 0.0125 / 0.6125
      const posterior = 0.0125 / 0.6125;
      const expected = posterior + (1 - posterior) * 0.15;
      const result = bktUpdate(0.25, DEFAULT_PARAMS, false, false);
      expect(result).toBeCloseTo(expected, 10);
    });
  });

  describe('hint modifiers', () => {
    it('with hint: G increases (less credit for correct answer)', () => {
      const pL = 0.4;
      const withoutHint = bktUpdate(pL, DEFAULT_PARAMS, true, false);
      const withHint = bktUpdate(pL, DEFAULT_PARAMS, true, true);
      // Higher G means correct answer is more likely a lucky guess,
      // so posterior is lower and final pL is lower
      expect(withHint).toBeLessThan(withoutHint);
    });

    it('with hint: T decreases (slower learning transition)', () => {
      // Without hint: T = min(0.35, 0.10 + 0.05) = 0.15
      // With hint: T = max(0.01, 0.10 - 0.03) = 0.07
      // To isolate T's effect, use params where G and S hint adjustments are negligible.
      // Set G high enough that hint cap doesn't change it, and S already at cap.
      const isolatedParams: BktParams = {
        ...DEFAULT_PARAMS,
        P_G: 0.60, // hint: min(0.60, 0.60+0.25)=0.60, no change
        P_S: 0.60, // hint: min(0.60, 0.60+0.10)=0.60, no change
      };
      // With these params, G and S are identical with or without hint.
      // Only T differs: without hint T=0.15, with hint T=0.07
      const pL = 0.4;
      const withoutHint = bktUpdate(pL, isolatedParams, true, false);
      const withHint = bktUpdate(pL, isolatedParams, true, true);
      expect(withHint).toBeLessThan(withoutHint);
    });

    it('without hint: T increases above base value', () => {
      // Without hint: T = min(0.35, P_T + 0.05)
      // For P_T=0.10, effective T = 0.15, which is greater than base 0.10
      // Verify by comparing against a hypothetical no-T-boost scenario
      const pL = 0.25;
      const result = bktUpdate(pL, DEFAULT_PARAMS, true, false);
      // Without T boost (T=0.10): posterior + (1-posterior)*0.10
      const posterior = (0.25 * 0.95) / (0.25 * 0.95 + 0.75 * 0.20);
      const withBaseT = posterior + (1 - posterior) * 0.10;
      // Actual result uses T=0.15, so it should be higher
      expect(result).toBeGreaterThan(withBaseT);
    });

    it('hint G is capped at 0.60', () => {
      const highGParams: BktParams = {
        ...DEFAULT_PARAMS,
        P_G: 0.50,
      };
      // With hint: G = min(0.60, 0.50 + 0.25) = 0.60 (capped)
      const pL = 0.4;
      const result = bktUpdate(pL, highGParams, true, true);
      // Manually compute with G=0.60, S=0.15, T=max(0.01, 0.10-0.03)=0.07
      const posterior = (pL * (1 - 0.15)) / (pL * (1 - 0.15) + (1 - pL) * 0.60);
      const expected = posterior + (1 - posterior) * 0.07;
      expect(result).toBeCloseTo(expected, 10);
    });

    it('hint S is capped at 0.60', () => {
      const highSParams: BktParams = {
        ...DEFAULT_PARAMS,
        P_S: 0.55,
      };
      // With hint: S = min(0.60, 0.55 + 0.10) = 0.60 (capped)
      const pL = 0.4;
      const result = bktUpdate(pL, highSParams, false, true);
      // G with hint = min(0.60, 0.20 + 0.25) = 0.45
      // T with hint = max(0.01, 0.10 - 0.03) = 0.07
      const posterior = (pL * 0.60) / (pL * 0.60 + (1 - pL) * (1 - 0.45));
      const expected = posterior + (1 - posterior) * 0.07;
      expect(result).toBeCloseTo(expected, 10);
    });

    it('hint T is floored at 0.01', () => {
      const lowTParams: BktParams = {
        ...DEFAULT_PARAMS,
        P_T: 0.02,
      };
      // With hint: T = max(0.01, 0.02 - 0.03) = max(0.01, -0.01) = 0.01
      const pL = 0.3;
      // G with hint = min(0.60, 0.20 + 0.25) = 0.45
      // S with hint = min(0.60, 0.05 + 0.10) = 0.15
      const posterior = (pL * (1 - 0.15)) / (pL * (1 - 0.15) + (1 - pL) * 0.45);
      const expected = posterior + (1 - posterior) * 0.01;
      const result = bktUpdate(pL, lowTParams, true, true);
      expect(result).toBeCloseTo(expected, 10);
    });

    it('no-hint T is capped at 0.35', () => {
      const highTParams: BktParams = {
        ...DEFAULT_PARAMS,
        P_T: 0.33,
      };
      // Without hint: T = min(0.35, 0.33 + 0.05) = min(0.35, 0.38) = 0.35
      const pL = 0.25;
      const posterior = (pL * 0.95) / (pL * 0.95 + 0.75 * 0.20);
      const expected = posterior + (1 - posterior) * 0.35;
      const result = bktUpdate(pL, highTParams, true, false);
      expect(result).toBeCloseTo(expected, 10);
    });
  });

  describe('clamping', () => {
    it('result never exceeds 0.999', () => {
      const result = bktUpdate(0.999, DEFAULT_PARAMS, true, false);
      expect(result).toBeLessThanOrEqual(0.999);
    });

    it('result never drops below 0.001', () => {
      const result = bktUpdate(0.001, DEFAULT_PARAMS, false, false);
      expect(result).toBeGreaterThanOrEqual(0.001);
    });

    it('clamps high pL with aggressive params', () => {
      const aggressiveParams: BktParams = {
        ...DEFAULT_PARAMS,
        P_T: 0.35,
        P_G: 0.01,
        P_S: 0.01,
      };
      // Very high starting pL + high learning rate should be clamped
      const result = bktUpdate(0.99, aggressiveParams, true, false);
      expect(result).toBeLessThanOrEqual(0.999);
      expect(result).toBeGreaterThanOrEqual(0.001);
    });

    it('clamps low pL with zero-like params', () => {
      const lowParams: BktParams = {
        ...DEFAULT_PARAMS,
        P_T: 0.01,
        P_G: 0.01,
        P_S: 0.99,
      };
      // Very high slip, low guess, low learning — should stay near floor
      const result = bktUpdate(0.001, lowParams, false, true);
      expect(result).toBeGreaterThanOrEqual(0.001);
      expect(result).toBeLessThanOrEqual(0.999);
    });
  });

  describe('repeated updates', () => {
    it('multiple correct answers converge toward 0.999', () => {
      let pL = 0.25;
      for (let i = 0; i < 30; i++) {
        pL = bktUpdate(pL, DEFAULT_PARAMS, true, false);
      }
      expect(pL).toBeCloseTo(0.999, 3);
    });

    it('alternating correct/wrong stabilizes at moderate level', () => {
      let pL = 0.25;
      for (let i = 0; i < 50; i++) {
        pL = bktUpdate(pL, DEFAULT_PARAMS, i % 2 === 0, false);
      }
      // Should stabilize somewhere in a moderate range, not at extremes
      expect(pL).toBeGreaterThan(0.2);
      expect(pL).toBeLessThan(0.95);
    });
  });
});
