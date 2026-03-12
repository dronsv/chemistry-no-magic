import { describe, it, expect } from 'vitest';
import { cellMatchesRule } from '../solubility-helpers';
import type { SolubilityRule } from '../../../types/rules';

// ── Rule fixtures (matching real data-src/rules/solubility_rules_full.json) ──

const RULE_NITRATES: SolubilityRule = {
  id: 'all_nitrates_soluble',
  cations: null,
  anions: ['NO3_minus'],
  expected: 'soluble',
  exceptions: [],
};

const RULE_ALKALI: SolubilityRule = {
  id: 'alkali_salts_soluble',
  cations: ['Li_plus', 'Na_plus', 'K_plus'],
  anions: null,
  expected: 'soluble',
  exceptions: [],
};

const RULE_HALIDES: SolubilityRule = {
  id: 'halides_soluble_except',
  cations: null,
  anions: ['Cl_minus', 'Br_minus', 'I_minus'],
  expected: 'soluble',
  exceptions: [
    { cations: ['Ag_plus', 'Pb_2plus', 'Hg2_2plus'], solubility: 'insoluble' },
  ],
};

const RULE_SULFATES: SolubilityRule = {
  id: 'sulfates_soluble_except',
  cations: null,
  anions: ['SO4_2minus'],
  expected: 'soluble',
  exceptions: [
    { cations: ['Ba_2plus', 'Pb_2plus', 'Ag_plus'], solubility: 'insoluble' },
    { cations: ['Ca_2plus', 'Sr_2plus'], solubility: 'slightly_soluble' },
  ],
};

const RULE_HYDROXIDES: SolubilityRule = {
  id: 'hydroxides_insoluble_except',
  cations: null,
  anions: ['OH_minus'],
  expected: 'insoluble',
  exceptions: [
    { cations: ['Li_plus', 'Na_plus', 'K_plus', 'Ba_2plus'], solubility: 'soluble' },
    { cations: ['Ca_2plus', 'Sr_2plus'], solubility: 'slightly_soluble' },
  ],
};

// ── Tests ────────────────────────────────────────────────────────

describe('cellMatchesRule', () => {
  describe('with ion: prefix (as passed by SolubilityTable component)', () => {
    it('matches nitrate rule for any cation', () => {
      expect(cellMatchesRule('ion:Na_plus', 'ion:NO3_minus', RULE_NITRATES)).toBe('match');
      expect(cellMatchesRule('ion:Ag_plus', 'ion:NO3_minus', RULE_NITRATES)).toBe('match');
    });

    it('does not match nitrate rule for non-nitrate anion', () => {
      expect(cellMatchesRule('ion:Na_plus', 'ion:Cl_minus', RULE_NITRATES)).toBe('none');
    });

    it('matches alkali rule for alkali cation with any anion', () => {
      expect(cellMatchesRule('ion:Na_plus', 'ion:Cl_minus', RULE_ALKALI)).toBe('match');
      expect(cellMatchesRule('ion:K_plus', 'ion:SO4_2minus', RULE_ALKALI)).toBe('match');
    });

    it('does not match alkali rule for non-alkali cation', () => {
      expect(cellMatchesRule('ion:Fe_2plus', 'ion:Cl_minus', RULE_ALKALI)).toBe('none');
    });

    it('matches halide rule for non-exception cations', () => {
      expect(cellMatchesRule('ion:Na_plus', 'ion:Cl_minus', RULE_HALIDES)).toBe('match');
      expect(cellMatchesRule('ion:Cu_2plus', 'ion:Br_minus', RULE_HALIDES)).toBe('match');
    });

    it('returns exception for Ag+ with halides', () => {
      expect(cellMatchesRule('ion:Ag_plus', 'ion:Cl_minus', RULE_HALIDES)).toBe('exception');
      expect(cellMatchesRule('ion:Pb_2plus', 'ion:I_minus', RULE_HALIDES)).toBe('exception');
    });

    it('returns exception for Ba²⁺ with sulfate', () => {
      expect(cellMatchesRule('ion:Ba_2plus', 'ion:SO4_2minus', RULE_SULFATES)).toBe('exception');
    });

    it('returns exception for Ca²⁺ with sulfate (slightly soluble)', () => {
      expect(cellMatchesRule('ion:Ca_2plus', 'ion:SO4_2minus', RULE_SULFATES)).toBe('exception');
    });

    it('matches sulfate rule for normal cation', () => {
      expect(cellMatchesRule('ion:Na_plus', 'ion:SO4_2minus', RULE_SULFATES)).toBe('match');
    });

    it('returns exception for alkali hydroxides (soluble exception)', () => {
      expect(cellMatchesRule('ion:Na_plus', 'ion:OH_minus', RULE_HYDROXIDES)).toBe('exception');
      expect(cellMatchesRule('ion:Ba_2plus', 'ion:OH_minus', RULE_HYDROXIDES)).toBe('exception');
    });

    it('matches hydroxide rule for non-exception cation (insoluble)', () => {
      expect(cellMatchesRule('ion:Fe_3plus', 'ion:OH_minus', RULE_HYDROXIDES)).toBe('match');
      expect(cellMatchesRule('ion:Cu_2plus', 'ion:OH_minus', RULE_HYDROXIDES)).toBe('match');
    });
  });

  describe('without prefix (bare IDs)', () => {
    it('also works with bare IDs', () => {
      expect(cellMatchesRule('Na_plus', 'NO3_minus', RULE_NITRATES)).toBe('match');
      expect(cellMatchesRule('Ag_plus', 'Cl_minus', RULE_HALIDES)).toBe('exception');
    });
  });

  describe('non-matching cells', () => {
    it('returns none when anion does not match', () => {
      expect(cellMatchesRule('ion:Na_plus', 'ion:PO4_3minus', RULE_HALIDES)).toBe('none');
    });

    it('returns none when cation does not match', () => {
      expect(cellMatchesRule('ion:Fe_2plus', 'ion:SO4_2minus', RULE_ALKALI)).toBe('none');
    });
  });
});
