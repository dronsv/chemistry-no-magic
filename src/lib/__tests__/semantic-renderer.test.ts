import { describe, it, expect } from 'vitest';
import { applySemanticLayer } from '../semantic-renderer';
import type { TheoryModule } from '../../types/theory-module';
import type { SemanticDidacticModule, DidacticTemplatePack } from '../../types/semantic-didactic';

// Minimal skeleton matching bonds_and_crystals
const skeleton: TheoryModule = {
  id: 'module:bonds_and_crystals.v1',
  kind: 'theory_module',
  applies_to: [],
  sections: [
    {
      id: 'bond_types',
      title: '',
      blocks: [
        { t: 'rule_card', id: 'ionic', concept_ref: 'concept:ionic_bond', title: '', rule: '', examples: ['NaCl'] },
        { t: 'rule_card', id: 'metallic', concept_ref: 'concept:metallic_bond', title: '', rule: '', examples: ['Fe'] },
      ],
    },
    {
      id: 'crystal_structures',
      title: '',
      blocks: [
        { t: 'table', id: 'lattice_comparison', columns: [], rows: [] },
      ],
    },
  ],
};

const semantic: SemanticDidacticModule = {
  id: 'bonds_and_crystals',
  kind: 'semantic_didactic',
  sections: [
    {
      id: 'bond_types',
      title_template: 'bond_types.section_title',
      blocks: [
        {
          id: 'ionic',
          kind: 'bond_rule_card',
          concept_ref: 'concept:ionic_bond',
          criterion: {
            property_ref: 'concept:electronegativity',
            comparator: 'gte',
            value: 1.7,
            participant_refs: ['concept:metals', 'concept:nonmetals'],
          },
          mechanism_ref: 'concept:electron_transfer',
          result_refs: ['concept:cation', 'concept:anion'],
          lattice_ref: 'concept:ionic_crystal_lattice',
        },
        {
          id: 'metallic',
          kind: 'bond_rule_card',
          concept_ref: 'concept:metallic_bond',
          criterion: {
            property_ref: 'concept:electronegativity',
            comparator: 'eq',
            participant_refs: ['concept:metals'],
          },
          mechanism_ref: 'concept:delocalized_electron',
          result_refs: [],
          lattice_ref: 'concept:metallic_crystal_lattice',
        },
      ],
    },
    {
      id: 'crystal_structures',
      title_template: 'crystal_structures.section_title',
      blocks: [
        {
          id: 'lattice_comparison',
          kind: 'comparison_table',
          row_refs: ['concept:ionic_crystal_lattice', 'concept:metallic_crystal_lattice'],
          columns: [
            { key: 'type' },
            { key: 'nodes', ref: 'concept:hardness' },
            { key: 'examples' },
          ],
        },
      ],
    },
  ],
};

const templates: DidacticTemplatePack = {
  'bond_types.section_title': { question: 'Типы химической связи' },
  'crystal_structures.section_title': { question: 'Сравнение решёток' },

  'ionic.title': { question: '{ref:concept:ionic_bond|nom}' },
  'ionic.rule': { question: 'Правило: Δχ ≥ {value}' },
  'ionic.description': { question: 'Связь между {ref:concept:metals|ins} и {ref:concept:nonmetals|ins} за счёт {ref:concept:electron_transfer|gen}.' },

  'metallic.title': { question: '{ref:concept:metallic_bond|nom}' },
  'metallic.rule': { question: 'Связь в {ref:concept:metals|prep}' },
  'metallic.description': { question: 'Электронный газ из {ref:concept:delocalized_electron|gen}.' },

  'lattice_comparison.columns': { question: 'Тип|Узлы|Примеры' },
  'lattice_comparison.row.concept:ionic_crystal_lattice': { question: '{ref:concept:ionic_crystal_lattice|nom}|Катионы и анионы|NaCl' },
  'lattice_comparison.row.concept:metallic_crystal_lattice': { question: '{ref:concept:metallic_crystal_lattice|nom}|Ионы металла|Fe, Cu' },
};

describe('applySemanticLayer', () => {
  it('injects section titles from templates', () => {
    const result = applySemanticLayer(skeleton, semantic, templates);

    const bondSection = result.sections[0] as typeof result.sections[0] & { _didacticTitle?: unknown };
    expect(bondSection._didacticTitle).toEqual([{ t: 'text', v: 'Типы химической связи' }]);

    const crystalSection = result.sections[1] as typeof result.sections[1] & { _didacticTitle?: unknown };
    expect(crystalSection._didacticTitle).toEqual([{ t: 'text', v: 'Сравнение решёток' }]);
  });

  it('generates bond rule card title with ref segment', () => {
    const result = applySemanticLayer(skeleton, semantic, templates);
    const ionicBlock = result.sections[0].blocks[0] as Record<string, unknown>;

    expect(ionicBlock._didacticTitle).toEqual([
      { t: 'ref', id: 'concept:ionic_bond', form: 'nom' },
    ]);
  });

  it('generates bond rule card rule with slot interpolation', () => {
    const result = applySemanticLayer(skeleton, semantic, templates);
    const ionicBlock = result.sections[0].blocks[0] as Record<string, unknown>;

    // value 1.7 → "1,7" (comma separator)
    expect(ionicBlock._didacticRule).toEqual([
      { t: 'text', v: 'Правило: Δχ ≥ 1,7' },
    ]);
  });

  it('generates description with multiple ref segments', () => {
    const result = applySemanticLayer(skeleton, semantic, templates);
    const ionicBlock = result.sections[0].blocks[0] as Record<string, unknown>;

    const desc = ionicBlock._didacticDescription as Array<{ t: string; v?: string; id?: string; form?: string }>;
    expect(desc).toHaveLength(7);
    expect(desc[0]).toEqual({ t: 'text', v: 'Связь между ' });
    expect(desc[1]).toEqual({ t: 'ref', id: 'concept:metals', form: 'ins' });
    expect(desc[2]).toEqual({ t: 'text', v: ' и ' });
    expect(desc[3]).toEqual({ t: 'ref', id: 'concept:nonmetals', form: 'ins' });
    expect(desc[4]).toEqual({ t: 'text', v: ' за счёт ' });
    expect(desc[5]).toEqual({ t: 'ref', id: 'concept:electron_transfer', form: 'gen' });
    expect(desc[6]).toEqual({ t: 'text', v: '.' });
  });

  it('generates comparison table columns and rows', () => {
    const result = applySemanticLayer(skeleton, semantic, templates);
    const tableBlock = result.sections[1].blocks[0] as Record<string, unknown>;

    const cols = tableBlock._didacticColumns as Array<Array<{ t: string; v?: string; id?: string }>>;
    expect(cols).toHaveLength(3);
    // Plain text column (no ref)
    expect(cols[0]).toEqual([{ t: 'text', v: 'Тип' }]);
    // Ontology ref column (clickable chip)
    expect(cols[1]).toEqual([{ t: 'ref', id: 'concept:hardness' }]);
    // Plain text column
    expect(cols[2]).toEqual([{ t: 'text', v: 'Примеры' }]);

    const rows = tableBlock._didacticRows as Array<Array<Array<{ t: string; v?: string; id?: string; form?: string }>>>;
    expect(rows).toHaveLength(2);
    // First cell of first row is a ref
    expect(rows[0][0]).toEqual([{ t: 'ref', id: 'concept:ionic_crystal_lattice', form: 'nom' }]);
    // Second cell is plain text
    expect(rows[0][1]).toEqual([{ t: 'text', v: 'Катионы и анионы' }]);
  });

  it('preserves original block fields alongside _didactic* fields', () => {
    const result = applySemanticLayer(skeleton, semantic, templates);
    const ionicBlock = result.sections[0].blocks[0] as Record<string, unknown>;

    // Original skeleton fields still present
    expect(ionicBlock.t).toBe('rule_card');
    expect(ionicBlock.id).toBe('ionic');
    expect(ionicBlock.concept_ref).toBe('concept:ionic_bond');
    expect(ionicBlock.examples).toEqual(['NaCl']);
  });

  it('applies overrides over generated content', () => {
    const overrides = {
      module_id: 'bonds_and_crystals',
      sections: {
        bond_types: {
          title: [{ t: 'text' as const, v: 'Custom Title' }],
          blocks: {
            ionic: {
              rule: [{ t: 'text' as const, v: 'Custom Rule' }],
            },
          },
        },
      },
    };

    const result = applySemanticLayer(skeleton, semantic, templates, overrides);

    // Section title overridden
    const bondSection = result.sections[0] as typeof result.sections[0] & { _didacticTitle?: unknown };
    expect(bondSection._didacticTitle).toEqual([{ t: 'text', v: 'Custom Title' }]);

    // Block rule overridden, but title still generated
    const ionicBlock = result.sections[0].blocks[0] as Record<string, unknown>;
    expect(ionicBlock._didacticRule).toEqual([{ t: 'text', v: 'Custom Rule' }]);
    expect(ionicBlock._didacticTitle).toEqual([{ t: 'ref', id: 'concept:ionic_bond', form: 'nom' }]);
  });

  it('handles blocks without matching semantic entry gracefully', () => {
    const extendedSkeleton: TheoryModule = {
      ...skeleton,
      sections: [
        {
          ...skeleton.sections[0],
          blocks: [
            ...skeleton.sections[0].blocks,
            { t: 'paragraph', text: 'Some fallback text' },
          ],
        },
        skeleton.sections[1],
      ],
    };

    const result = applySemanticLayer(extendedSkeleton, semantic, templates);
    // The paragraph block (no ID) passes through unchanged
    const lastBlock = result.sections[0].blocks[2] as Record<string, unknown>;
    expect(lastBlock.t).toBe('paragraph');
    expect(lastBlock.text).toBe('Some fallback text');
    expect(lastBlock._didacticTitle).toBeUndefined();
  });

  it('handles missing templates gracefully', () => {
    const sparseTemplates: DidacticTemplatePack = {
      'bond_types.section_title': { question: 'Test' },
      // No block templates
    };

    const result = applySemanticLayer(skeleton, semantic, sparseTemplates);
    // Section title applied
    const bondSection = result.sections[0] as typeof result.sections[0] & { _didacticTitle?: unknown };
    expect(bondSection._didacticTitle).toEqual([{ t: 'text', v: 'Test' }]);

    // Block fields not injected (templates missing)
    const ionicBlock = result.sections[0].blocks[0] as Record<string, unknown>;
    expect(ionicBlock._didacticTitle).toBeUndefined();
    expect(ionicBlock._didacticRule).toBeUndefined();
  });
});
