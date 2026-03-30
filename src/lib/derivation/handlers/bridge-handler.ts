import type {
  DerivationOperator, StoichiometricBridgeOperator, QRef,
  PlanStep, ExecutionEnv, OperatorResult, OperatorHandler,
} from '../../../types/derivation';
import { evaluateFormula, solveFor } from '../../formula-evaluator';
import { qrefKey } from '../qref';

/**
 * Stoichiometric bridge handler.
 *
 * Converts amount of one reaction role to amount of another via
 * the stoichiometric ratio formula: n_2 = n_1 * nu_2 / nu_1.
 *
 * Sub-goals (expand):
 *   - q:amount @ fromRole   (source moles)
 *   - q:stoich_coeff @ fromRole
 *   - q:stoich_coeff @ toRole
 *
 * The planner discovers the mass->amount->bridge->amount->mass chain
 * by combining formula operators (amount_from_mass) with this bridge.
 */
export const bridgeHandler: OperatorHandler = {
  matches(op: DerivationOperator, target: QRef): boolean {
    if (op.kind !== 'stoichiometric_bridge') return false;
    const bop = op as StoichiometricBridgeOperator;
    // Bridge applies when target is q:amount with the toRole
    return target.quantity === 'q:amount' && target.role === bop.toRole;
  },

  expand(op: DerivationOperator, _target: QRef): QRef[] {
    const bop = op as StoichiometricBridgeOperator;
    // Three sub-goals: source amount + both stoich coefficients
    return [
      { quantity: 'q:amount', role: bop.fromRole },
      { quantity: 'q:stoich_coeff', role: bop.fromRole },
      { quantity: 'q:stoich_coeff', role: bop.toRole },
    ];
  },

  execute(op: DerivationOperator, step: PlanStep, env: ExecutionEnv): OperatorResult {
    const bop = op as StoichiometricBridgeOperator;
    const formula = env.formulas.find(f => f.id === bop.formulaId);
    if (!formula) throw new Error(`Formula not found: ${bop.formulaId}`);

    // Resolve input values from inputRefs
    const inputSymbols = ['n_from', 'nu_from', 'nu_to'];
    const vals: number[] = [];
    for (const sym of inputSymbols) {
      const ref = step.inputRefs[sym];
      if (!ref) throw new Error(`No inputRef for symbol: ${sym}`);
      const key = qrefKey(ref);
      let val = env.values[key];
      if (val === undefined && ref.context) {
        const bareKey = ref.role ? `${ref.quantity}|${ref.role}` : ref.quantity;
        val = env.values[bareKey];
      }
      if (val === undefined) {
        throw new Error(`Value not found for ${key} (symbol ${sym})`);
      }
      vals.push(val);
    }

    const [n_from, nu_from, nu_to] = vals;
    let result: number;

    if (bop.fromRole === 'reactant') {
      // Forward: n_1 (reactant) -> n_2 (product)
      const bindings = { n_1: n_from, nu_1: nu_from, nu_2: nu_to };
      const trace = evaluateFormula(formula, bindings, env.constants);
      result = trace.result;
      return { value: result, trace };
    } else {
      // Reverse: n_2 (product) -> n_1 (reactant) via inversion
      const bindings = { n_2: n_from, nu_2: nu_from, nu_1: nu_to };
      const trace = solveFor(formula, 'n_1', bindings, env.constants);
      result = trace.result;
      return { value: result, trace };
    }
  },
};
