import type { ReactNode } from 'react';
import type { ComputableFormula, Variable, PhysicalConstant } from '../types/formula';
import { extractDisplayTokens, type DisplayToken } from './formula-evaluator';
import OntInteractiveRef from '../components/OntInteractiveRef';

export interface VariableTokenPair {
  token: Extract<DisplayToken, { kind: 'variable' }>;
  variable: Variable;
}

/**
 * Pair each variable token with its Variable definition. Pure (no JSX) so it
 * can be unit-tested in the node-env Vitest.
 */
export function collectVariableTokens(
  formula: ComputableFormula,
  inversionFor?: string,
  constants?: PhysicalConstant[],
): VariableTokenPair[] {
  const tokens = extractDisplayTokens(formula, inversionFor, constants);
  const bySymbol = new Map(formula.variables.map(v => [v.symbol, v]));
  const pairs: VariableTokenPair[] = [];
  for (const token of tokens) {
    if (token.kind !== 'variable') continue;
    const variable = bySymbol.get(token.symbol);
    if (variable) pairs.push({ token, variable });
  }
  return pairs;
}

/**
 * Render a formula as interactive React nodes: variable tokens become
 * <OntInteractiveRef> hover targets bound to their Variable; const/text tokens
 * render as plain spans.
 */
export function formulaToDisplayNodes(
  formula: ComputableFormula,
  locale: string,
  inversionFor?: string,
  constants?: PhysicalConstant[],
): ReactNode {
  const tokens = extractDisplayTokens(formula, inversionFor, constants);
  const bySymbol = new Map(formula.variables.map(v => [v.symbol, v]));

  return (
    <span className="formula-nodes">
      {tokens.map((token, i) => {
        if (token.kind === 'variable') {
          const variable = bySymbol.get(token.symbol);
          if (variable) {
            return (
              <OntInteractiveRef
                key={i}
                formulaVariable={variable}
                formulaId={formula.id}
                locale={locale}
                display={<span className="formula-nodes__var">{token.display}</span>}
              />
            );
          }
          return <span key={i} className="formula-nodes__var">{token.display}</span>;
        }
        if (token.kind === 'const') {
          return <span key={i} className="formula-nodes__const">{token.display}</span>;
        }
        return <span key={i}>{token.text}</span>;
      })}
    </span>
  );
}
