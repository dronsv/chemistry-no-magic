/**
 * Interactive derivation demo — run with:
 *   npx vitest run src/lib/__tests__/derivation-demo.test.ts
 *
 * Shows the proof tree for real chemistry problems.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildOperatorRegistry } from '../derivation/operator-registry';
import { planDerivation } from '../derivation/derivation-planner';
import { executePlan } from '../derivation/derivation-executor';
import { buildProofTree, flattenProofTree } from '../derivation/derivation-trace';
import { toConstantsDict } from '../formula-evaluator';
import { qrefKey } from '../derivation/qref';
import { deriveQuantity } from '../derivation/derive-quantity';
import { solveQuery } from '../derivation/query-solver';
import type { ComputableFormula, PhysicalConstant } from '../../types/formula';
import type { QRef, ProofNode, ReasoningQuery } from '../../types/derivation';

const DATA_DIR = join(import.meta.dirname, '../../../data-src');
const formulas: ComputableFormula[] = JSON.parse(readFileSync(join(DATA_DIR, 'foundations/formulas.json'), 'utf8'));
const constants = toConstantsDict(JSON.parse(readFileSync(join(DATA_DIR, 'foundations/constants.json'), 'utf8')) as PhysicalConstant[]);
const elements = JSON.parse(readFileSync(join(DATA_DIR, 'elements.json'), 'utf8'));

function parseFormula(f: string): Record<string, number> {
  const re = /([A-Z][a-z]?)(\d*)/g;
  const result: Record<string, number> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(f)) !== null) {
    if (m[1]) result[m[1]] = (result[m[1]] || 0) + (parseInt(m[2]) || 1);
  }
  return result;
}

const ontology = {
  elements,
  parseFormula,
  entityFormulas: new Map([
    ['substance:H2SO4', 'H2SO4'],
    ['substance:NaOH', 'NaOH'],
    ['substance:H2O', 'H2O'],
    ['substance:NaCl', 'NaCl'],
    ['substance:CaCO3', 'CaCO3'],
    ['substance:CO2', 'CO2'],
    ['substance:hcl', 'HCl'],
    ['substance:naoh', 'NaOH'],
    ['substance:koh', 'KOH'],
    ['substance:h2so4', 'H2SO4'],
    ['substance:ca_oh_2', 'CaOH2'],
  ]),
};

const indicatorRules = JSON.parse(readFileSync(join(DATA_DIR, 'rules/indicator_response_rules.json'), 'utf8'));

const registry = buildOperatorRegistry(formulas);

function printTree(node: ProofNode, indent = 0): void {
  const pad = '  '.repeat(indent);
  const kind = node.operator?.kind ?? 'given';
  const id = node.operator?.id?.replace('formula:', '').replace('/forward', '').replace('/inv:', '/') ?? '';
  const q = qrefKey(node.target);
  const v = node.value !== undefined ? ` = ${Number(node.value.toFixed(4))}` : '';
  console.log(`${pad}${kind} ${id} -> ${q}${v}`);
  if (node.internalSteps) {
    for (const s of node.internalSteps) {
      if (s.type === 'decompose') {
        console.log(`${pad}  [decompose] ${(s as any).sourceRef} -> ${(s as any).components.map((c: any) => `${c.element}x${c.count}`).join(', ')}`);
      } else if (s.type === 'lookup') {
        console.log(`${pad}  [lookup] ${(s as any).source} = ${(s as any).value}`);
      } else if (s.type === 'compute') {
        console.log(`${pad}  [compute] ${(s as any).formulaId} = ${(s as any).result}`);
      }
    }
  }
  for (const child of node.children) printTree(child, indent + 1);
}

describe('derivation demos', () => {
  it('Demo 1: m(H2SO4) from n=2 mol', () => {
    console.log('\n=== Demo 1: Find mass of H2SO4 given n=2 mol ===\n');

    const target: QRef = { quantity: 'q:mass', context: { system_type: 'substance', entity_ref: 'substance:H2SO4' } };
    const plan = planDerivation(target, [{ quantity: 'q:amount' }], registry.operators, registry.quantityIndex, { handlers: registry.handlers })!;
    const result = executePlan(plan, { formulas, constants, values: { 'q:amount': 2 }, ontology }, registry.handlers);
    const tree = buildProofTree(plan, result, { 'q:amount': 2 });

    printTree(tree.root);
    console.log(`\nAnswer: m = ${tree.result.toFixed(2)} g`);
  });

  it('Demo 2: M(H2O) via decompose + lookup', () => {
    console.log('\n=== Demo 2: Derive molar mass of H2O ===\n');

    const target: QRef = { quantity: 'q:molar_mass', context: { system_type: 'substance', entity_ref: 'substance:H2O' } };
    const plan = planDerivation(target, [], registry.operators, registry.quantityIndex, { handlers: registry.handlers })!;
    const result = executePlan(plan, { formulas, constants, values: {}, ontology }, registry.handlers);
    const tree = buildProofTree(plan, result, {});

    printTree(tree.root);
    console.log(`\nAnswer: M = ${tree.result.toFixed(3)} g/mol`);
  });

  it('Demo 3: Stoichiometry — 2H2 + O2 -> 2H2O, 4g H2 -> ? g H2O', () => {
    console.log('\n=== Demo 3: Stoichiometry 2H2 + O2 -> 2H2O ===');
    console.log('Given: m(H2) = 4 g, find m(H2O)\n');

    const target: QRef = { quantity: 'q:mass', role: 'product' };
    const knowns: QRef[] = [
      { quantity: 'q:mass', role: 'reactant' },
      { quantity: 'q:molar_mass', role: 'reactant' },
      { quantity: 'q:stoich_coeff', role: 'reactant' },
      { quantity: 'q:stoich_coeff', role: 'product' },
      { quantity: 'q:molar_mass', role: 'product' },
    ];
    const plan = planDerivation(target, knowns, registry.operators, registry.quantityIndex, { handlers: registry.handlers })!;
    const values: Record<string, number> = {
      'q:mass|reactant': 4,
      'q:molar_mass|reactant': 2,     // M(H2)
      'q:stoich_coeff|reactant': 2,    // coeff H2
      'q:stoich_coeff|product': 2,     // coeff H2O
      'q:molar_mass|product': 18,      // M(H2O)
    };
    const result = executePlan(plan, { formulas, constants, values }, registry.handlers);
    const tree = buildProofTree(plan, result, values);

    printTree(tree.root);
    console.log(`\nAnswer: m(H2O) = ${tree.result.toFixed(2)} g`);
  });

  it('Demo 4: REFERENCE PROBLEM — litmus color when mixing HCl + NaOH solutions', () => {
    console.log('\n=== Demo 4: Reference Problem ===');
    console.log('Mix 100g of 10% HCl solution with 200g of 5% NaOH solution.');
    console.log('What color will litmus turn?\n');

    const query: ReasoningQuery = {
      system: {
        type: 'mixing',
        reaction: 'rx_neutral_01_hcl_naoh',
        participants: [
          {
            role: 'acid',
            entity: 'sub:hcl',
            given: [
              { quantity: 'q:mass_fraction', value: 0.10 },
              { quantity: 'q:mass', role: 'solution', value: 100 },
            ],
          },
          {
            role: 'base',
            entity: 'sub:naoh',
            given: [
              { quantity: 'q:mass_fraction', value: 0.05 },
              { quantity: 'q:mass', role: 'solution', value: 200 },
            ],
          },
        ],
      },
      find: { fact: 'indicator_color', params: { indicator: 'ind:litmus' } },
    };

    const result = solveQuery(query, { formulas, constants, ontology, indicatorRules });

    console.log('Intermediates:');
    for (const [k, v] of Object.entries(result.intermediates)) {
      if (typeof v === 'number' && k !== 'color' && k !== 'medium') {
        console.log(`  ${k} = ${v.toFixed(4)}`);
      }
    }

    console.log('\nReasoning:');
    console.log(`  m_solute(acid) = 0.10 × 100 = ${result.intermediates['m_solute(acid)']?.toFixed(2)} g`);
    console.log(`  M(HCl) = ${result.intermediates['M(acid)']?.toFixed(2)} g/mol`);
    console.log(`  n(acid) = ${result.intermediates['m_solute(acid)']?.toFixed(2)} / ${result.intermediates['M(acid)']?.toFixed(2)} = ${result.intermediates['n(acid)']?.toFixed(4)} mol`);
    console.log(`  m_solute(base) = 0.05 × 200 = ${result.intermediates['m_solute(base)']?.toFixed(2)} g`);
    console.log(`  M(NaOH) = ${result.intermediates['M(base)']?.toFixed(2)} g/mol`);
    console.log(`  n(base) = ${result.intermediates['m_solute(base)']?.toFixed(2)} / ${result.intermediates['M(base)']?.toFixed(2)} = ${result.intermediates['n(base)']?.toFixed(4)} mol`);
    console.log(`  eq(acid) = ${result.intermediates['eq(acid)']?.toFixed(4)}, eq(base) = ${result.intermediates['eq(base)']?.toFixed(4)}`);
    console.log(`  → acid is in excess → medium is acidic`);
    console.log(`\nAnswer: litmus → ${result.answer}`);

    // Verify
    expect(result.intermediates['n(acid)']).toBeCloseTo(0.2742, 3); // 10/36.46
    expect(result.intermediates['n(base)']).toBeCloseTo(0.2500, 3); // 10/40
    expect(result.answer).toBe('color:red'); // acid excess → litmus red
  });

  it('Demo 5: neutral case — exact neutralization', () => {
    console.log('\n=== Demo 5: Exact Neutralization ===');
    console.log('Mix 100g of 3.65% HCl with 100g of 4% NaOH\n');

    const query: ReasoningQuery = {
      system: {
        type: 'mixing',
        reaction: 'rx_neutral_01_hcl_naoh',
        participants: [
          {
            role: 'acid',
            entity: 'sub:hcl',
            given: [
              { quantity: 'q:mass_fraction', value: 0.0365 },
              { quantity: 'q:mass', role: 'solution', value: 100 },
            ],
          },
          {
            role: 'base',
            entity: 'sub:naoh',
            given: [
              { quantity: 'q:mass_fraction', value: 0.04 },
              { quantity: 'q:mass', role: 'solution', value: 100 },
            ],
          },
        ],
      },
      find: { fact: 'indicator_color', params: { indicator: 'ind:litmus' } },
    };

    const result = solveQuery(query, { formulas, constants, ontology, indicatorRules });
    console.log(`  n(acid) = ${result.intermediates['n(acid)']?.toFixed(4)} mol`);
    console.log(`  n(base) = ${result.intermediates['n(base)']?.toFixed(4)} mol`);
    console.log(`  Answer: litmus → ${result.answer}`);

    // 3.65/36.46 ≈ 0.1001, 4/40 = 0.1000 — nearly neutral
    expect(result.answer).toBe('color:violet'); // neutral → violet
  });

  it('Demo 6: base excess → litmus blue', () => {
    console.log('\n=== Demo 6: Base Excess ===');
    console.log('Mix 50g of 7.3% HCl with 200g of 5% NaOH\n');

    const query: ReasoningQuery = {
      system: {
        type: 'mixing',
        participants: [
          {
            role: 'acid',
            entity: 'sub:hcl',
            given: [
              { quantity: 'q:mass_fraction', value: 0.073 },
              { quantity: 'q:mass', role: 'solution', value: 50 },
            ],
          },
          {
            role: 'base',
            entity: 'sub:naoh',
            given: [
              { quantity: 'q:mass_fraction', value: 0.05 },
              { quantity: 'q:mass', role: 'solution', value: 200 },
            ],
          },
        ],
      },
      find: { fact: 'indicator_color', params: { indicator: 'ind:litmus' } },
    };

    const result = solveQuery(query, { formulas, constants, ontology, indicatorRules });
    console.log(`  n(acid) = ${result.intermediates['n(acid)']?.toFixed(4)} mol`);
    console.log(`  n(base) = ${result.intermediates['n(base)']?.toFixed(4)} mol`);
    console.log(`  Answer: litmus → ${result.answer}`);

    expect(result.answer).toBe('color:blue'); // base excess → blue
  });

  it('Demo 7: deriveQuantity API — mass fraction of S in H2SO4', () => {
    console.log('\n=== Demo 4: Mass fraction of S in H2SO4 ===\n');

    const result = deriveQuantity({
      target: {
        quantity: 'q:component_mass_fraction',
        context: {
          system_type: 'substance_component',
          entity_ref: 'element:S',
          parent_ref: 'substance:H2SO4',
        },
      },
      knowns: [],
      formulas,
      constants,
      ontology,
    });

    console.log('Trace:');
    for (const step of result.trace) {
      if (step.type === 'decompose') console.log(`  decompose -> ${(step as any).components.map((c: any) => `${c.element}x${c.count}`).join(', ')}`);
      if (step.type === 'lookup') console.log(`  lookup ${(step as any).source} = ${(step as any).value}`);
      if (step.type === 'compute') console.log(`  compute ${(step as any).formulaId} = ${(step as any).result}`);
      if (step.type === 'conclusion') console.log(`  conclusion = ${(step as any).value}`);
    }
    console.log(`\nAnswer: omega(S in H2SO4) = ${(result.value * 100).toFixed(2)}%`);
  });
});
