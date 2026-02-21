import type { SearchIndexEntry, SearchCategory } from '../../types/search';
import * as m from '../../paraglide/messages.js';

export interface SearchResultGroup {
  category: SearchCategory;
  label: string;
  results: SearchIndexEntry[];
}

const CATEGORY_ORDER: SearchCategory[] = ['element', 'substance', 'reaction', 'competency', 'page'];

function getCategoryLabel(cat: SearchCategory): string {
  switch (cat) {
    case 'element': return m.search_cat_elements();
    case 'substance': return m.search_cat_substances();
    case 'reaction': return m.search_cat_reactions();
    case 'competency': return m.search_cat_competencies();
    case 'page': return m.search_cat_pages();
  }
}

/** Normalize subscripts for ASCII matching. */
function normalizeFormula(s: string): string {
  const map: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
  return s.replace(/[₀-₉]/g, ch => map[ch] || ch);
}

function scoreEntry(entry: SearchIndexEntry, words: string[]): number {
  const titleLower = entry.title.toLowerCase();
  const titleNorm = normalizeFormula(titleLower);
  const subtitleLower = entry.subtitle.toLowerCase();
  const query = words.join(' ');

  // Exact title match
  if (titleLower === query || titleNorm === query) return 100;
  // Title starts with query
  if (titleLower.startsWith(query) || titleNorm.startsWith(query)) return 80;
  // Title contains query
  if (titleLower.includes(query) || titleNorm.includes(query)) return 60;
  // Subtitle contains query
  if (subtitleLower.includes(query)) return 40;
  // Matched via search field only
  return 20;
}

export function search(
  index: SearchIndexEntry[],
  rawQuery: string,
  maxPerCategory = 10,
): SearchResultGroup[] {
  const normalized = normalizeFormula(rawQuery.toLowerCase().trim());
  if (!normalized) return [];

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Filter: AND logic — all words must appear in entry.search
  const matched = index.filter(entry => {
    const s = entry.search;
    return words.every(w => s.includes(w));
  });

  // Score and sort within each category
  const byCategory = new Map<SearchCategory, Array<{ entry: SearchIndexEntry; score: number }>>();

  for (const entry of matched) {
    const score = scoreEntry(entry, words);
    if (!byCategory.has(entry.category)) {
      byCategory.set(entry.category, []);
    }
    byCategory.get(entry.category)!.push({ entry, score });
  }

  // Build grouped results in category order
  const groups: SearchResultGroup[] = [];

  for (const cat of CATEGORY_ORDER) {
    const items = byCategory.get(cat);
    if (!items || items.length === 0) continue;

    items.sort((a, b) => b.score - a.score);

    groups.push({
      category: cat,
      label: getCategoryLabel(cat),
      results: items.slice(0, maxPerCategory).map(i => i.entry),
    });
  }

  return groups;
}
