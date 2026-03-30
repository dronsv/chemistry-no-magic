/**
 * Query solver — accepts an ontologized ReasoningQuery and derives
 * the answer via the unified operator registry + proof tree.
 *
 * Handles multi-entity problems (e.g., acid + base mixing) by
 * deriving quantities per participant, then applying comparison
 * and table-fact resolution.
 */
import type { ComputableFormula } from '../../types/formula';
import type { ConstantsDict } from '../../types/eval-trace';
import type {
  QRef, ReasonStep, ReasoningQuery, ReasoningResult,
  QueryParticipant, FactGoal, ProofNode,
} from '../../types/derivation';
import type { OntologyAccess } from './resolvers';
import { buildOperatorRegistry } from './operator-registry';
import { planDerivation } from './derivation-planner';
import { executePlan } from './derivation-executor';
import { buildProofTree } from './derivation-trace';
import { qrefKey } from './qref';

export interface QuerySolverEnv {
  formulas: ComputableFormula[];
  constants: ConstantsDict;
  ontology: OntologyAccess;
  indicatorRules?: IndicatorRule[];
}

interface IndicatorRule {
  id: string;
  indicator: string;
  mapping: Array<{ input: string; output_color: string }>;
}

/**
 * Solve an ontologized reasoning query.
 *
 * Currently supports:
 * - 'mixing' system: derives n(acid) and n(base), compares, determines medium, looks up indicator color
 * - Numeric quantity goals: derives a single quantity via the operator registry
 */
export function solveQuery(query: ReasoningQuery, env: QuerySolverEnv): ReasoningResult {
  const steps: ReasonStep[] = [];
  const intermediates: Record<string, number> = {};
  const childProofNodes: ProofNode[] = [];

  const registry = buildOperatorRegistry(env.formulas);

  // Step 1: Derive quantities for each participant
  for (const participant of query.system.participants) {
    const entityRef = participant.entity.startsWith('sub:')
      ? `substance:${participant.entity.slice(4)}`
      : participant.entity;

    // Build knowns from participant's given values
    const knowns: Array<{ qref: QRef; value: number }> = [];
    for (const g of participant.given) {
      const qref: QRef = {
        quantity: g.quantity,
        role: g.role,
        context: { system_type: 'solution', entity_ref: entityRef },
      };
      knowns.push({ qref, value: g.value });
      steps.push({ type: 'given', qref, value: g.value });
    }

    // Derive n (amount of substance) for this participant
    const nTarget: QRef = {
      quantity: 'q:amount',
      context: { system_type: 'substance', entity_ref: entityRef },
    };

    // We need: n = m_solute / M
    // m_solute = ω × m_solution (from mass_fraction_solution inversion)
    // M = aggregate from decomposition

    // First derive M via operator registry
    const mTarget: QRef = {
      quantity: 'q:molar_mass',
      context: { system_type: 'substance', entity_ref: entityRef },
    };
    const mPlan = planDerivation(mTarget, [], registry.operators, registry.quantityIndex, {
      handlers: registry.handlers,
      ontology: env.ontology,
    });

    let M: number;
    if (mPlan) {
      const mResult = executePlan(mPlan, {
        formulas: env.formulas,
        constants: env.constants,
        values: {},
        ontology: env.ontology,
      }, registry.handlers);
      M = mResult.result;

      if (mResult.internalSteps) steps.push(...mResult.internalSteps);
      const mTree = buildProofTree(mPlan, mResult, {});
      childProofNodes.push(mTree.root);
    } else {
      throw new Error(`Cannot derive M for ${entityRef}`);
    }

    // Now compute m_solute from mass fraction
    const massFractionGiven = participant.given.find(g => g.quantity === 'q:mass_fraction');
    const solutionMassGiven = participant.given.find(
      g => g.quantity === 'q:mass' && (g.role === 'solution' || !g.role),
    );

    let n: number;
    if (massFractionGiven && solutionMassGiven) {
      // m_solute = ω × m_solution
      const mSolute = massFractionGiven.value * solutionMassGiven.value;
      steps.push({
        type: 'compute',
        formulaId: 'formula:mass_fraction_solution',
        result: mSolute,
      });
      intermediates[`m_solute(${participant.role})`] = mSolute;

      // n = m_solute / M
      n = mSolute / M;
      steps.push({
        type: 'compute',
        formulaId: 'formula:amount_from_mass',
        result: n,
      });
    } else {
      // Try direct amount
      const amountGiven = participant.given.find(g => g.quantity === 'q:amount');
      if (amountGiven) {
        n = amountGiven.value;
      } else {
        throw new Error(`Cannot derive n for ${participant.role}: need mass_fraction + mass, or direct amount`);
      }
    }

    intermediates[`M(${participant.role})`] = M;
    intermediates[`n(${participant.role})`] = n;

    childProofNodes.push({
      operator: null,
      target: nTarget,
      value: n,
      children: [],
    });
  }

  // Step 2: Determine what to find
  const find = query.find;

  // Numeric quantity goal
  if ('quantity' in find) {
    const entityParticipant = query.system.participants.find(p =>
      p.entity === find.entity || p.role === find.role,
    );
    const key = entityParticipant
      ? `n(${entityParticipant.role})`
      : Object.keys(intermediates).find(k => k.startsWith('n('));
    const value = intermediates[key!] ?? 0;
    steps.push({ type: 'conclusion', target: { quantity: find.quantity }, value });
    return { answer: value, intermediates, steps };
  }

  // Fact goal (e.g., indicator_color)
  const factGoal = find as FactGoal;

  if (factGoal.fact === 'indicator_color' || factGoal.fact === 'medium') {
    // Step 3: Compare n(acid) vs n(base) considering stoichiometry
    const nAcid = intermediates['n(acid)'];
    const nBase = intermediates['n(base)'];
    if (nAcid === undefined || nBase === undefined) {
      throw new Error('Need participants with roles "acid" and "base" for medium determination');
    }

    // Get stoichiometric coefficients from reaction if available
    // For now: assume 1:1 for monoprotonic acids and monovalent bases
    // TODO: look up reaction coefficients from reaction data
    let acidValency = 1;
    let baseValency = 1;

    // Simple heuristic: detect common polyprotic acids
    const acidParticipant = query.system.participants.find(p => p.role === 'acid');
    if (acidParticipant) {
      const acidEntity = acidParticipant.entity;
      if (acidEntity.includes('h2so4') || acidEntity.includes('h2co3')) acidValency = 2;
      if (acidEntity.includes('h3po4')) acidValency = 3;
    }
    const baseParticipant = query.system.participants.find(p => p.role === 'base');
    if (baseParticipant) {
      const baseEntity = baseParticipant.entity;
      if (baseEntity.includes('ba_oh_2') || baseEntity.includes('ca_oh_2')) baseValency = 2;
    }

    // Equivalents comparison
    const eqAcid = nAcid * acidValency;
    const eqBase = nBase * baseValency;

    intermediates['eq(acid)'] = eqAcid;
    intermediates['eq(base)'] = eqBase;

    let medium: string;
    const diff = Math.abs(eqAcid - eqBase);
    const maxEq = Math.max(eqAcid, eqBase);
    // Relative tolerance: 0.5% — accounts for rounding in molar masses
    const tolerance = maxEq * 0.005;
    if (diff < tolerance) {
      medium = 'medium:neutral';
    } else if (eqAcid > eqBase) {
      medium = 'medium:acidic';
    } else {
      medium = 'medium:alkaline';
    }

    intermediates['medium'] = medium === 'medium:acidic' ? -1 : medium === 'medium:alkaline' ? 1 : 0;

    steps.push({
      type: 'compute',
      formulaId: 'compare:acid_base_equivalents',
      result: eqAcid - eqBase,
    });

    const compareNode: ProofNode = {
      operator: null,
      target: { quantity: 'fact:medium' },
      value: intermediates['medium'],
      children: childProofNodes,
    };

    // If only medium is asked
    if (factGoal.fact === 'medium') {
      steps.push({ type: 'conclusion', target: { quantity: 'fact:medium' }, value: intermediates['medium'] });
      return {
        answer: medium,
        intermediates,
        steps,
        proofTree: compareNode,
      };
    }

    // Step 4: Table lookup — indicator + medium → color
    const indicatorId = factGoal.params?.indicator ?? 'ind:litmus';
    const rule = env.indicatorRules?.find(r => r.indicator === indicatorId);
    if (!rule) {
      throw new Error(`No indicator rules for ${indicatorId}`);
    }

    const colorEntry = rule.mapping.find(m => m.input === medium);
    const color = colorEntry?.output_color ?? 'unknown';

    steps.push({ type: 'conclusion', target: { quantity: 'fact:indicator_color' }, value: 0 });

    const rootNode: ProofNode = {
      operator: null,
      target: { quantity: 'fact:indicator_color' },
      children: [compareNode],
    };

    return {
      answer: color,
      intermediates: { ...intermediates, color: 0 },
      steps,
      proofTree: rootNode,
    };
  }

  throw new Error(`Unsupported fact goal: ${factGoal.fact}`);
}
