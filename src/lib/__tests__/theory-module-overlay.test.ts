import { describe, it, expect } from 'vitest';
import { applyTheoryModuleOverlay } from '../../components/TheoryModulePanel';
import type { TheoryModule } from '../../types/theory-module';

const baseModule: TheoryModule = {
  id: 'module:test.v1',
  kind: 'theory_module',
  applies_to: [],
  sections: [
    {
      id: 'section_a',
      title_ru: 'Заголовок A',
      blocks: [
        { t: 'paragraph', text_ru: 'Текст параграфа.' },
        { t: 'ox_rule', rule_id: 'simple_substance' },
        { t: 'rule_card', title_ru: 'Карточка', rule_ru: 'Правило', description_ru: 'Описание' },
      ],
    },
    {
      id: 'section_b',
      title_ru: 'Заголовок B',
      blocks: [
        {
          t: 'table',
          columns_ru: ['Кол A', 'Кол B'],
          rows: [{ cells: ['Ряд 1A', 'Ряд 1B'] }],
        },
      ],
    },
  ],
};

describe('applyTheoryModuleOverlay', () => {
  it('returns module unchanged when overlay is null', () => {
    const result = applyTheoryModuleOverlay(baseModule, null);
    expect(result).toBe(baseModule);
  });

  it('returns module unchanged when overlay has no sections', () => {
    const result = applyTheoryModuleOverlay(baseModule, {});
    expect(result).toBe(baseModule);
  });

  it('overrides section title', () => {
    const overlay = {
      sections: {
        section_a: { title: 'Section A' },
      },
    };
    const result = applyTheoryModuleOverlay(baseModule, overlay);
    expect(result.sections[0].title_ru).toBe('Section A');
    expect(result.sections[1].title_ru).toBe('Заголовок B'); // unchanged
  });

  it('overrides paragraph text, skipping ox_rule blocks in index', () => {
    const overlay = {
      sections: {
        section_a: {
          title: 'Section A',
          blocks: [
            { text: 'Paragraph text.' },
            // index 1 corresponds to rule_card (ox_rule is skipped)
            { title: 'Card', rule: 'Rule', description: 'Description' },
          ],
        },
      },
    };
    const result = applyTheoryModuleOverlay(baseModule, overlay);
    const section = result.sections[0];
    expect((section.blocks[0] as { text_ru: string }).text_ru).toBe('Paragraph text.');
    // ox_rule at index 1 is unchanged
    expect(section.blocks[1]).toEqual({ t: 'ox_rule', rule_id: 'simple_substance' });
    // rule_card at index 2 gets overlay from blocks[1]
    const card = section.blocks[2] as { title_ru: string; rule_ru: string; description_ru: string };
    expect(card.title_ru).toBe('Card');
    expect(card.rule_ru).toBe('Rule');
    expect(card.description_ru).toBe('Description');
  });

  it('overrides table columns and rows', () => {
    const overlay = {
      sections: {
        section_b: {
          title: 'Section B',
          blocks: [
            { columns: ['Col A', 'Col B'], rows: [['Row 1A', 'Row 1B']] },
          ],
        },
      },
    };
    const result = applyTheoryModuleOverlay(baseModule, overlay);
    const table = result.sections[1].blocks[0] as { columns_ru: string[]; rows: { cells: string[] }[] };
    expect(table.columns_ru).toEqual(['Col A', 'Col B']);
    expect(table.rows[0].cells).toEqual(['Row 1A', 'Row 1B']);
  });

  it('leaves ox_rule blocks unchanged regardless of overlay', () => {
    const overlay = {
      sections: {
        section_a: {
          blocks: [{ text: 'Override.' }],
        },
      },
    };
    const result = applyTheoryModuleOverlay(baseModule, overlay);
    expect(result.sections[0].blocks[1]).toEqual({ t: 'ox_rule', rule_id: 'simple_substance' });
  });
});
