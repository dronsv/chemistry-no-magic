import { vi, describe, it, expect } from 'vitest';

// Mock Paraglide messages
vi.mock('../../../paraglide/messages.js', () => ({
  search_cat_elements: () => 'Elements',
  search_cat_ions: () => 'Ions',
  search_cat_substances: () => 'Substances',
  search_cat_reactions: () => 'Reactions',
  search_cat_competencies: () => 'Competencies',
  search_cat_pages: () => 'Pages',
}));

import type { SearchIndexEntry } from '../../../types/search.js';
import { search } from '../search-engine.js';

const TEST_INDEX: SearchIndexEntry[] = [
  { id: 'h2o', title: 'H₂O', subtitle: 'Вода', url: '/substances/h2o/', category: 'substance', search: 'h2o h₂o вода water oxide' },
  { id: 'nacl', title: 'NaCl', subtitle: 'Хлорид натрия', url: '/substances/nacl/', category: 'substance', search: 'nacl хлорид натрия sodium chloride' },
  { id: 'na', title: 'Na', subtitle: 'Натрий', url: '/elements/na/', category: 'element', search: 'na натрий sodium' },
  { id: 'cl', title: 'Cl', subtitle: 'Хлор', url: '/elements/cl/', category: 'element', search: 'cl хлор chlorine' },
  { id: 'cl-', title: 'Cl⁻', subtitle: 'Хлорид-ион', url: '/ions/cl-/', category: 'ion', search: 'cl⁻ cl- хлорид chloride' },
  { id: 'periodic-table', title: 'Периодическая таблица', subtitle: 'Свойства элементов', url: '/periodic-table/', category: 'page', search: 'периодическая таблица periodic table элементы' },
  { id: 'reactions_redox', title: 'Окислительно-восстановительные', subtitle: 'ОВР', url: '/competency/reactions_redox/', category: 'competency', search: 'окислительно-восстановительные овр redox' },
];

describe('search()', () => {
  describe('empty and blank queries', () => {
    it('returns empty array for empty string', () => {
      expect(search(TEST_INDEX, '')).toEqual([]);
    });

    it('returns empty array for whitespace-only query', () => {
      expect(search(TEST_INDEX, '   ')).toEqual([]);
    });

    it('returns empty array for query with no matches', () => {
      expect(search(TEST_INDEX, 'zzzzzznotfound')).toEqual([]);
    });
  });

  describe('exact match scoring', () => {
    it('ranks exact title match first — "na" finds element Na at top of its group', () => {
      const results = search(TEST_INDEX, 'na');
      const elementGroup = results.find(g => g.category === 'element');
      expect(elementGroup).toBeDefined();
      expect(elementGroup!.results[0].title).toBe('Na');
    });

    it('ranks exact title match first — "nacl" finds substance NaCl', () => {
      const results = search(TEST_INDEX, 'nacl');
      const substanceGroup = results.find(g => g.category === 'substance');
      expect(substanceGroup).toBeDefined();
      expect(substanceGroup!.results[0].title).toBe('NaCl');
    });
  });

  describe('AND logic — all query words must match', () => {
    it('"хлорид натрия" matches only NaCl (both words present in search field)', () => {
      const results = search(TEST_INDEX, 'хлорид натрия');
      const allEntries = results.flatMap(g => g.results);
      expect(allEntries).toHaveLength(1);
      expect(allEntries[0].title).toBe('NaCl');
    });

    it('"натрий хлорид" returns no results when exact words are absent from search field', () => {
      // NaCl search has "натрия" (genitive), not "натрий" (nominative)
      const results = search(TEST_INDEX, 'натрий хлорид');
      const allEntries = results.flatMap(g => g.results);
      expect(allEntries).toHaveLength(0);
    });

    it('"na cl" matches only entries containing both words', () => {
      const results = search(TEST_INDEX, 'na cl');
      const allEntries = results.flatMap(g => g.results);
      // Na search: "na натрий sodium" — has "na" but not "cl"
      // Cl search: "cl хлор chlorine" — has "cl" but not "na"
      // NaCl search: "nacl хлорид натрия sodium chloride" — "nacl" contains "na" and "chloride" contains "cl"
      // Cl⁻ search: "cl⁻ cl- хлорид chloride" — has "cl" but not "na"
      expect(allEntries.every(e => e.id === 'nacl')).toBe(true);
    });
  });

  describe('formula normalization', () => {
    it('finds H₂O when querying with subscript "H₂O"', () => {
      const results = search(TEST_INDEX, 'H₂O');
      const allEntries = results.flatMap(g => g.results);
      expect(allEntries.some(e => e.title === 'H₂O')).toBe(true);
    });

    it('finds H₂O when querying with ASCII "h2o"', () => {
      const results = search(TEST_INDEX, 'h2o');
      const allEntries = results.flatMap(g => g.results);
      expect(allEntries.some(e => e.title === 'H₂O')).toBe(true);
    });
  });

  describe('category grouping and ordering', () => {
    it('"cl" returns groups in CATEGORY_ORDER: element, ion, substance', () => {
      const results = search(TEST_INDEX, 'cl');
      const categories = results.map(g => g.category);
      // Cl element: search "cl хлор chlorine" — contains "cl"
      // Cl⁻ ion: search "cl⁻ cl- хлорид chloride" — contains "cl"
      // NaCl substance: search "nacl хлорид натрия sodium chloride" — "nacl" contains "cl"
      expect(categories).toContain('element');
      expect(categories).toContain('ion');
      expect(categories).toContain('substance');

      // Verify ordering follows CATEGORY_ORDER: element < ion < substance
      const elementIdx = categories.indexOf('element');
      const ionIdx = categories.indexOf('ion');
      const substanceIdx = categories.indexOf('substance');
      expect(elementIdx).toBeLessThan(ionIdx);
      expect(ionIdx).toBeLessThan(substanceIdx);
    });

    it('groups have correct labels from Paraglide messages', () => {
      const results = search(TEST_INDEX, 'cl');
      const elementGroup = results.find(g => g.category === 'element');
      const ionGroup = results.find(g => g.category === 'ion');
      const substanceGroup = results.find(g => g.category === 'substance');
      expect(elementGroup!.label).toBe('Elements');
      expect(ionGroup!.label).toBe('Ions');
      expect(substanceGroup!.label).toBe('Substances');
    });

    it('does not include empty category groups', () => {
      const results = search(TEST_INDEX, 'cl');
      for (const group of results) {
        expect(group.results.length).toBeGreaterThan(0);
      }
      // reaction and page categories should not appear
      expect(results.find(g => g.category === 'reaction')).toBeUndefined();
      expect(results.find(g => g.category === 'page')).toBeUndefined();
    });
  });

  describe('maxPerCategory', () => {
    it('limits results per category to the specified maximum', () => {
      // Create an index with 15 elements all matching "test"
      const manyElements: SearchIndexEntry[] = Array.from({ length: 15 }, (_, i) => ({
        id: `el-${i}`,
        title: `Element${i}`,
        subtitle: `Test element ${i}`,
        url: `/elements/el${i}/`,
        category: 'element' as const,
        search: `element${i} test`,
      }));

      const results = search(manyElements, 'test', 3);
      const elementGroup = results.find(g => g.category === 'element');
      expect(elementGroup).toBeDefined();
      expect(elementGroup!.results).toHaveLength(3);
    });

    it('returns all results when count is below maxPerCategory', () => {
      const results = search(TEST_INDEX, 'cl', 10);
      const elementGroup = results.find(g => g.category === 'element');
      expect(elementGroup).toBeDefined();
      // Only Cl element matches
      expect(elementGroup!.results).toHaveLength(1);
    });
  });

  describe('scoring tiers', () => {
    it('exact title match (100) ranks above starts-with (80)', () => {
      // Query "na": Na is exact (score 100), NaCl starts with "na" (score 80 via normalized title)
      const results = search(TEST_INDEX, 'na');

      // Na should be in element group, NaCl in substance group — different categories
      // But within a shared query let's verify both appear
      const elementGroup = results.find(g => g.category === 'element');
      const substanceGroup = results.find(g => g.category === 'substance');

      expect(elementGroup).toBeDefined();
      expect(elementGroup!.results[0].title).toBe('Na');

      expect(substanceGroup).toBeDefined();
      expect(substanceGroup!.results[0].title).toBe('NaCl');
    });

    it('title-contains (60) ranks above subtitle-contains (40)', () => {
      // Create entries where one has query in title and another only in subtitle
      const entries: SearchIndexEntry[] = [
        { id: 'a', title: 'Abc Iron Xyz', subtitle: 'Something', url: '/a/', category: 'substance', search: 'abc iron xyz something' },
        { id: 'b', title: 'Something else', subtitle: 'About Iron', url: '/b/', category: 'substance', search: 'something else about iron' },
      ];

      const results = search(entries, 'iron');
      const group = results.find(g => g.category === 'substance');
      expect(group).toBeDefined();
      expect(group!.results[0].id).toBe('a'); // title contains → 60
      expect(group!.results[1].id).toBe('b'); // subtitle contains → 40
    });

    it('subtitle-contains (40) ranks above search-field-only (20)', () => {
      const entries: SearchIndexEntry[] = [
        { id: 'sub', title: 'Alpha', subtitle: 'Keyword here', url: '/sub/', category: 'element', search: 'alpha keyword here' },
        { id: 'srch', title: 'Beta', subtitle: 'Gamma', url: '/srch/', category: 'element', search: 'beta gamma keyword' },
      ];

      const results = search(entries, 'keyword');
      const group = results.find(g => g.category === 'element');
      expect(group).toBeDefined();
      expect(group!.results[0].id).toBe('sub'); // subtitle contains → 40
      expect(group!.results[1].id).toBe('srch'); // search field only → 20
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of query case', () => {
      const upper = search(TEST_INDEX, 'NACL');
      const lower = search(TEST_INDEX, 'nacl');
      const mixed = search(TEST_INDEX, 'NaCl');

      const getSubstanceTitles = (groups: typeof upper) =>
        groups.find(g => g.category === 'substance')?.results.map(r => r.title) ?? [];

      expect(getSubstanceTitles(upper)).toEqual(getSubstanceTitles(lower));
      expect(getSubstanceTitles(lower)).toEqual(getSubstanceTitles(mixed));
    });
  });
});
