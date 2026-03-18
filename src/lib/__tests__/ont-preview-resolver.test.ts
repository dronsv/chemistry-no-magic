// src/lib/__tests__/ont-preview-resolver.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Variable } from '../../types/formula';
import type { Element } from '../../types/element';
import type { Ion } from '../../types/ion';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { ConceptRegistry, ConceptOverlay } from '../../types/ontology-ref';
import type { ComputableFormula } from '../../types/formula';

// ---------------------------------------------------------------------------
// Mock data-loader to avoid actual network calls
// ---------------------------------------------------------------------------
vi.mock('../data-loader', () => ({
  loadElements: vi.fn(),
  loadIons: vi.fn(),
  loadSubstancesIndex: vi.fn(),
  loadConcepts: vi.fn(),
  loadConceptOverlay: vi.fn(),
  loadFormulas: vi.fn(),
  loadQuantityNames: vi.fn(),
}));

import {
  loadElements,
  loadIons,
  loadSubstancesIndex,
  loadConcepts,
  loadConceptOverlay,
  loadFormulas,
  loadQuantityNames,
} from '../data-loader';

import { resolveOntPreview } from '../ont-preview/resolve-ont-preview';

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const mockElement: Element = {
  Z: 11,
  symbol: 'Na',
  name: 'Натрий',
  name_latin: 'Sodium',
  group: 1,
  period: 3,
  metal_type: 'metal',
  element_group: 'alkali_metal',
  typical_oxidation_states: [1],
  characteristics: {
    'concept:atomic_mass': { value: 22.99, unit: 'unit:u' },
    'concept:electronegativity': { value: 0.93 },
  },
};

const mockIon: Ion = {
  id: 'H_plus',
  formula: 'H⁺',
  type: 'cation',
  name: 'Водород-ион',
  tags: ['common'],
  characteristics: {
    'concept:charge': { value: 1 },
  },
};

const mockSubstanceAcid: SubstanceIndexEntry = {
  id: 'sub:hcl',
  formula: 'HCl',
  name: 'Соляная кислота',
  class: 'acid',
  tags: ['soluble'],
  characteristics: {
    'concept:pKa': [{ value: -7, conditions: { dissociation_step: 1 } }],
  },
};

const mockConcepts: ConceptRegistry = {
  pKa: {
    kind: 'domain_concept',
    parent_id: 'acid_base_equilibrium',
    order: 1,
    filters: {},
    examples: [],
  },
  acid_base_equilibrium: {
    kind: 'domain_concept',
    parent_id: null,
    order: 0,
    filters: {},
    examples: [],
  },
};

const mockConceptOverlay: ConceptOverlay = {
  pKa: { name: 'Константа кислотности', slug: 'pka', description: 'Мера силы кислоты. Чем меньше pKa, тем сильнее кислота. Используется в расчётах pH и степени диссоциации.' },
  acid_base_equilibrium: { name: 'Кислотно-основное равновесие', slug: 'acid-base-equilibrium' },
};

const mockFormula: ComputableFormula = {
  id: 'formula:molar_mass',
  kind: 'definition',
  domain: 'stoichiometry',
  school_grade: [8, 9],
  variables: [
    { symbol: 'M', display_symbol: 'M', quantity: 'q:molar_mass', unit: 'unit:g_mol', role: 'result' },
    { symbol: 'm', display_symbol: 'm', quantity: 'q:mass', unit: 'unit:g', role: 'input' },
    { symbol: 'n', display_symbol: 'n', quantity: 'q:amount', unit: 'unit:mol', role: 'input' },
  ],
  expression: { op: 'divide', operands: ['m', 'n'] },
  result_variable: 'M',
  invertible_for: ['m', 'n'],
  inversions: {
    m: { op: 'multiply', operands: ['M', 'n'] },
    n: { op: 'divide', operands: ['m', 'M'] },
  },
  constants_used: [],
  prerequisite_formulas: [],
  used_by_solvers: [],
  concept_refs: ['molar_mass_concept'],
  didactic_scope: 'school_simplified',
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadElements).mockResolvedValue([mockElement]);
  vi.mocked(loadIons).mockResolvedValue([mockIon]);
  vi.mocked(loadSubstancesIndex).mockResolvedValue([mockSubstanceAcid]);
  vi.mocked(loadConcepts).mockResolvedValue(mockConcepts);
  vi.mocked(loadConceptOverlay).mockResolvedValue(mockConceptOverlay);
  vi.mocked(loadFormulas).mockResolvedValue([mockFormula]);
  vi.mocked(loadQuantityNames).mockResolvedValue({
    'q:molar_mass': 'Молярная масса',
    'q:mass': 'Масса',
    'q:amount': 'Количество вещества',
    'unit:g_mol': 'г/моль',
    'unit:g': 'г',
    'unit:mol': 'моль',
  });
});

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe('resolveOntPreview — element', () => {
  it('returns complete preview for known element', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'el:Na',
      locale: 'ru',
    });
    expect(result.target.ref).toBe('el:Na');
    expect(result.target.subjectKind).toBe('entity');
    expect(result.data.title).toBe('Натрий');
    expect(result.data.subtitle).toBe('Na');
    expect(result.data.facts).toBeDefined();
    const zFact = result.data.facts?.find(f => f.label === 'Z');
    expect(zFact?.value).toBe('11');
  });

  it('includes canonicalHref for element', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'el:Na',
      locale: 'en',
    });
    expect(result.target.canonicalHref).toContain('Na');
  });

  it('returns fallback with symbol title when element not found', async () => {
    vi.mocked(loadElements).mockResolvedValue([]);
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'el:Xx',
      locale: 'ru',
    });
    expect(result.data.title).toBe('Xx');
    expect(result.data.facts).toBeUndefined();
  });
});

describe('resolveOntPreview — substance', () => {
  it('returns acid preview with pKa fact when profile=acid_base', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'sub:hcl',
      locale: 'ru',
      context: { profile: 'acid_base' },
    });
    expect(result.data.title).toBe('Соляная кислота');
    expect(result.data.subtitle).toBe('HCl');
    const pkaFact = result.data.facts?.find(f => f.label === 'pKa');
    expect(pkaFact).toBeDefined();
    expect(pkaFact?.value).toBe('-7');
  });

  it('returns acid preview with pKa derived from class when no explicit profile', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'sub:hcl',
      locale: 'ru',
    });
    // class=acid → profile=acid_base → pKa shown
    const pkaFact = result.data.facts?.find(f => f.label === 'pKa');
    expect(pkaFact).toBeDefined();
  });

  it('returns fallback when substance not found', async () => {
    vi.mocked(loadSubstancesIndex).mockResolvedValue([]);
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'sub:unknown_x',
      locale: 'ru',
    });
    expect(result.data.title).toBe('unknown_x');
  });
});

describe('resolveOntPreview — concept', () => {
  it('returns title and description from overlay', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'concept:pKa',
      locale: 'ru',
    });
    expect(result.data.title).toBe('Константа кислотности');
    expect(result.data.description).toBeDefined();
  });

  it('caps description at 220 chars', async () => {
    const longDesc = 'A'.repeat(300);
    vi.mocked(loadConceptOverlay).mockResolvedValue({
      pKa: { name: 'Test', slug: 'test', description: longDesc },
    });
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'concept:pKa',
      locale: 'ru',
    });
    expect(result.data.description!.length).toBeLessThanOrEqual(220);
    expect(result.data.description!.endsWith('…')).toBe(true);
  });

  it('shows parent concept name as chip', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'concept:pKa',
      locale: 'ru',
    });
    expect(result.data.chips).toBeDefined();
    expect(result.data.chips![0].label).toBe('Кислотно-основное равновесие');
  });

  it('returns canonicalHref as undefined for domain_concept', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'concept:pKa',
      locale: 'ru',
    });
    expect(result.target.canonicalHref).toBeUndefined();
  });
});

describe('resolveOntPreview — unknown ref', () => {
  it('returns fallback without crash for unknown prefix', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'xyz:unknown_thing',
      locale: 'ru',
    });
    expect(result.data.title).toBe('unknown_thing');
    expect(result.target.ref).toBe('xyz:unknown_thing');
  });

  it('returns fallback for entity subjectKind with formula ref (validation)', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'formula:molar_mass',
      locale: 'ru',
    });
    // Should return fallback, not crash
    expect(result.data.title).toBeDefined();
  });
});

describe('resolveOntPreview — formula', () => {
  it('returns formula title from concept overlay and description from expression', async () => {
    vi.mocked(loadConceptOverlay).mockResolvedValue({
      molar_mass_concept: { name: 'Молярная масса', slug: 'molar-mass' },
    });
    const result = await resolveOntPreview({
      subjectKind: 'formula',
      ref: 'formula:molar_mass',
      locale: 'ru',
    });
    expect(result.target.subjectKind).toBe('formula');
    expect(result.data.title).toBe('Молярная масса');
    expect(result.data.description).toContain('=');
  });

  it('uses formula id tail as title when concept overlay absent', async () => {
    vi.mocked(loadConceptOverlay).mockResolvedValue({});
    const result = await resolveOntPreview({
      subjectKind: 'formula',
      ref: 'formula:molar_mass',
      locale: 'ru',
    });
    expect(result.data.title).toBe('molar_mass');
  });

  it('shows non-generalized didactic_scope as chip', async () => {
    vi.mocked(loadConceptOverlay).mockResolvedValue({});
    const result = await resolveOntPreview({
      subjectKind: 'formula',
      ref: 'formula:molar_mass',
      locale: 'ru',
    });
    // didactic_scope='school_simplified' → chip shown
    const chip = result.data.chips?.find(c => c.label === 'school_simplified');
    expect(chip).toBeDefined();
  });
});

describe('resolveOntPreview — formula_variable', () => {
  it('uses explanation_override when present for locale', async () => {
    const variable: Variable = {
      symbol: 'M',
      display_symbol: 'M',
      quantity: 'q:molar_mass',
      unit: 'unit:g_mol',
      role: 'result',
      explanation_overrides: {
        ru: 'Молярная масса вещества',
        en: 'Molar mass of the substance',
      },
    };
    const result = await resolveOntPreview({
      subjectKind: 'formula_variable',
      variable,
      formulaId: 'formula:molar_mass',
      locale: 'ru',
    });
    expect(result.target.subjectKind).toBe('formula_variable');
    expect(result.data.title).toBe('M');
    expect(result.data.description).toBe('Молярная масса вещества');
  });

  it('returns symbol fallback when no binding and no override', async () => {
    const variable: Variable = {
      symbol: 'n',
      display_symbol: 'n',
      quantity: 'q:amount',
      unit: 'unit:mol',
      role: 'input',
    };
    const result = await resolveOntPreview({
      subjectKind: 'formula_variable',
      variable,
      formulaId: 'formula:molar_mass',
      locale: 'ru',
    });
    expect(result.data.title).toBe('n');
    // No crash, facts may still have quantity
    expect(result).toBeDefined();
  });

  it('composes description from quantity name and binding when no override', async () => {
    const variable: Variable = {
      symbol: 'm',
      display_symbol: 'm',
      quantity: 'q:mass',
      unit: 'unit:g',
      role: 'input',
      binding: {
        mode: 'concrete_entity',
        ref: 'el:Na',
      },
    };
    const result = await resolveOntPreview({
      subjectKind: 'formula_variable',
      variable,
      formulaId: 'formula:molar_mass',
      locale: 'ru',
    });
    expect(result.data.title).toBe('m');
    // description should compose: "Масса (Натрий)"
    expect(result.data.description).toContain('Масса');
    expect(result.data.description).toContain('Натрий');
  });
});

describe('resolveOntPreview — ion', () => {
  it('returns ion preview with formula, charge, type facts', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'ion:H_plus',
      locale: 'ru',
    });
    expect(result.data.title).toBe('Водород-ион');
    expect(result.data.subtitle).toBe('H⁺');
    const formulaFact = result.data.facts?.find(f => f.label === 'Formula');
    expect(formulaFact?.value).toBe('H⁺');
    const typeFact = result.data.facts?.find(f => f.label === 'Type');
    expect(typeFact?.value).toBe('cation');
  });

  it('canonicalHref is undefined for ion (no per-ion page in v1)', async () => {
    const result = await resolveOntPreview({
      subjectKind: 'entity',
      ref: 'ion:H_plus',
      locale: 'ru',
    });
    expect(result.target.canonicalHref).toBeUndefined();
  });
});
