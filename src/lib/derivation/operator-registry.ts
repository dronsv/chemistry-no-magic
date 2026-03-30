import type { ComputableFormula } from '../../types/formula';
import type {
  DerivationOperator, LookupOperator, IndexedAggregateOperator,
  StoichiometricBridgeOperator, OperatorHandler,
} from '../../types/derivation';
import { buildDerivationRules, buildQuantityIndex } from './derivation-graph';
import { formulaHandler } from './handlers/formula-handler';
import { lookupHandler } from './handlers/lookup-handler';
import { aggregateHandler } from './handlers/aggregate-handler';
import { bridgeHandler } from './handlers/bridge-handler';

export interface OperatorRegistry {
  operators: DerivationOperator[];
  quantityIndex: Map<string, DerivationOperator[]>;
  handlers: Map<string, OperatorHandler>;    // kind -> handler
}

/**
 * Build a unified operator registry from computable formulas.
 *
 * Combines:
 * 1. Formula operators (from existing buildDerivationRules)
 * 2. Lookup operator for element Ar
 * 3. Indexed aggregate operator for substance molar mass
 */
export function buildOperatorRegistry(formulas: ComputableFormula[]): OperatorRegistry {
  // 1. Formula operators (with kind: 'formula' added by buildDerivationRules)
  const formulaOps = buildDerivationRules(formulas);

  // 2. Lookup operator for element relative atomic mass
  const lookupOp: LookupOperator = {
    id: 'op:lookup_ar',
    kind: 'lookup',
    targetQuantity: 'q:relative_atomic_mass',
    lookupQuantity: 'q:relative_atomic_mass',
    systemType: 'element',
    baseCost: 10,
  };

  // 3. Indexed aggregate for substance molar mass (M = sum Ar_i * count_i)
  const molarMassAgg: IndexedAggregateOperator = {
    id: 'op:aggregate_molar_mass',
    kind: 'indexed_aggregate',
    targetQuantity: 'q:molar_mass',
    formulaId: 'formula:molar_mass_from_composition',
    indexSet: 'composition_elements',
    sourceSystemType: 'substance',
    baseCost: 200,
  };

  // 4. Stoichiometric bridge operators (reactant<->product via stoichiometric ratio)
  const bridgeR2P: StoichiometricBridgeOperator = {
    id: 'op:bridge_reactant_to_product',
    kind: 'stoichiometric_bridge',
    targetQuantity: 'q:amount',
    targetRole: 'product',
    formulaId: 'formula:stoichiometry_ratio',
    fromRole: 'reactant',
    toRole: 'product',
    baseCost: 50,
  };

  const bridgeP2R: StoichiometricBridgeOperator = {
    id: 'op:bridge_product_to_reactant',
    kind: 'stoichiometric_bridge',
    targetQuantity: 'q:amount',
    targetRole: 'reactant',
    formulaId: 'formula:stoichiometry_ratio',
    fromRole: 'product',
    toRole: 'reactant',
    baseCost: 50,
  };

  const operators: DerivationOperator[] = [...formulaOps, lookupOp, molarMassAgg, bridgeR2P, bridgeP2R];

  // Build quantity index over all operators
  const quantityIndex = buildQuantityIndex(operators);

  // Register handlers by kind
  const handlers = new Map<string, OperatorHandler>();
  handlers.set('formula', formulaHandler);
  handlers.set('lookup', lookupHandler);
  handlers.set('indexed_aggregate', aggregateHandler);
  handlers.set('stoichiometric_bridge', bridgeHandler);

  return { operators, quantityIndex, handlers };
}
