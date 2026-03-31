import type { ResolutionDef, ProblemKind } from '../../../types/resolution.js';
import type { Expr, ResolvedInputs } from '../../../types/query-ast.js';
import type { EquationHandlerEnv } from './equation-handler.js';
import type { RuleHandlerEnv } from './rule-handler.js';
import type { LookupHandlerEnv } from './lookup-handler.js';
import { executeEquation } from './equation-handler.js';
import { executeRule } from './rule-handler.js';
import { executeLookup } from './lookup-handler.js';
import { executeStub } from './stub-handler.js';

export type { EquationHandlerEnv, RuleHandlerEnv, LookupHandlerEnv };
export { executeEquation, executeRule, executeLookup, executeStub };

export type HandlerResult =
  | { answer: Expr; formula_rendered?: string }
  | { error: string };

/** Union of all environment shapes required by the handlers. */
export type HandlerEnv = EquationHandlerEnv & RuleHandlerEnv & LookupHandlerEnv;

/** Set of ProblemKind values that have concrete handler implementations. */
export const IMPLEMENTED_KINDS: Set<ProblemKind> = new Set<ProblemKind>([
  'equation',
  'rule',
  'lookup',
]);

/**
 * Dispatch to the correct handler by resolution.kind.
 * Falls back to executeStub for unimplemented kinds.
 */
export function executeHandler(
  resolution: ResolutionDef,
  inputs: ResolvedInputs,
  env: HandlerEnv,
): HandlerResult {
  switch (resolution.kind) {
    case 'equation':
      return executeEquation(resolution, inputs, {
        formulas: env.formulas,
        constants: env.constants,
      });

    case 'rule':
      return executeRule(resolution, inputs, {
        ontologyData: env.ontologyData,
      });

    case 'lookup':
      return executeLookup(resolution, inputs, {
        elements: env.elements,
        substances: env.substances,
        ions: env.ions,
      });

    default:
      return executeStub(resolution);
  }
}
