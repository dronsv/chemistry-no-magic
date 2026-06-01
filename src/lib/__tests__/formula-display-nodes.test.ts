import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractDisplayTokens, formulaToDisplayString } from '../formula-evaluator';
import type { ComputableFormula } from '../../types/formula';

const DATA_DIR = join(import.meta.dirname, '../../../data-src/foundations');
const formulas: ComputableFormula[] = JSON.parse(
  readFileSync(join(DATA_DIR, 'formulas.json'), 'utf8'),
);

function findFormula(id: string): ComputableFormula {
  const f = formulas.find(fm => fm.id === id);
  if (!f) throw new Error(`Formula not found: ${id}`);
  return f;
}

describe('extractDisplayTokens', () => {
  it('emits a result token, an equals token, then expression tokens', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const tokens = extractDisplayTokens(f);
    expect(tokens[0]).toEqual({ kind: 'variable', symbol: 'Ka', display: 'Ka' });
    expect(tokens[1]).toEqual({ kind: 'text', text: ' = ' });
  });

  it('marks each variable symbol as a variable token with its display string', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const tokens = extractDisplayTokens(f);
    const varSymbols = tokens
      .filter((t): t is Extract<typeof t, { kind: 'variable' }> => t.kind === 'variable')
      .map(t => t.symbol);
    expect(varSymbols).toContain('Ka');
    expect(varSymbols).toContain('cH');
    expect(varSymbols).toContain('cA');
    expect(varSymbols).toContain('cHA');
  });

  it('uses display_symbol for the rendered token text', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const tokens = extractDisplayTokens(f);
    const cH = tokens.find(t => t.kind === 'variable' && t.symbol === 'cH');
    expect(cH).toBeDefined();
    expect(cH && cH.kind === 'variable' && cH.display).toBe('[H⁺]');
  });

  it('emits operator tokens as text (divide, multiply)', () => {
    const f = findFormula('formula:acid_dissociation_constant');
    const tokens = extractDisplayTokens(f);
    const textBlob = tokens.filter(t => t.kind === 'text').map(t => t.text).join('');
    expect(textBlob).toContain('/');
    expect(textBlob).toContain('×');
  });

  it('concatenated token display equals the legacy string renderer output', () => {
    // formula:density → ρ = m / V (simple: 3 variables, one divide)
    const f = findFormula('formula:density');
    const tokens = extractDisplayTokens(f);
    const joined = tokens
      .map(t => (t.kind === 'variable' ? t.display : t.kind === 'text' ? t.text : t.display))
      .join('');
    expect(joined).toBe(formulaToDisplayString(f));
  });

  it('renders summation loop index as plain text, not an interactive variable', () => {
    const f = findFormula('formula:molar_mass_from_composition');
    const tokens = extractDisplayTokens(f);
    // count_i (role 'index', display 'n') must NOT be a variable token
    const indexAsVar = tokens.find(t => t.kind === 'variable' && t.symbol === 'count_i');
    expect(indexAsVar).toBeUndefined();
    // Its display 'n' still appears, as text
    const textBlob = tokens.filter(t => t.kind === 'text').map(t => t.text).join('');
    expect(textBlob).toContain('n');
    // Ar_i (role 'input') stays interactive
    expect(tokens.some(t => t.kind === 'variable' && t.symbol === 'Ar_i')).toBe(true);
  });

  it('inversion path: result token is the inversion target', () => {
    const f = findFormula('formula:density');
    const tokens = extractDisplayTokens(f, 'm');
    expect(tokens[0]).toEqual({ kind: 'variable', symbol: 'm', display: 'm' });
    expect(tokens[1]).toEqual({ kind: 'text', text: ' = ' });
  });
});
