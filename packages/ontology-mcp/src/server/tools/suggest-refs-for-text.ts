import type { OntologyIndex, SearchCandidate } from '../../shared/types.js';
import { searchEntities } from './search-entities.js';

interface MentionSpan {
  text: string;
  start: number;
  end: number;
  candidates: SearchCandidate[];
}

export interface SuggestResult {
  mentions: MentionSpan[];
  unresolved_spans: Array<{ text: string; start: number; end: number }>;
}

// Chemical formula pattern: must contain at least one element-like pair followed by digits/subscripts.
// Avoids matching plain words like "In", "He", "At" by requiring digit content.
const FORMULA_RE = /(?:[A-Z][a-z]?(?:[₀-₉]+|\d+))(?:[A-Z][a-z]?(?:[₀-₉]+|\d+)?)*(?:\((?:[A-Z][a-z]?(?:[₀-₉]+|\d+)?)+\)(?:[₀-₉]+|\d+)?)*/g;

// Element symbols (1-2 chars) — validated against symbolIndex, not blindly matched
const SYMBOL_RE = /\b[A-Z][a-z]?\b/g;

// Word tokenizer for natural language — Cyrillic and Latin
const WORD_RE = /[\p{L}][\p{L}\p{N}_-]*/gu;

export function suggestRefsForText(
  index: OntologyIndex,
  args: { text: string; material_language: string; mode: string }
): SuggestResult {
  const { text } = args;
  const mentions: MentionSpan[] = [];
  const coveredRanges: Array<[number, number]> = [];

  function isOverlapping(start: number, end: number): boolean {
    return coveredRanges.some(([s, e]) => start < e && end > s);
  }

  function addMention(matchText: string, start: number, candidates: SearchCandidate[]): void {
    const end = start + matchText.length;
    if (isOverlapping(start, end)) return;
    if (candidates.length > 0) {
      mentions.push({ text: matchText, start, end, candidates });
      coveredRanges.push([start, end]);
    }
  }

  // Pass 1: Chemical formulas with digits (H₂O, NaCl2, Ca(OH)2)
  for (const match of text.matchAll(FORMULA_RE)) {
    if (match.index === undefined) continue;
    const formula = match[0];
    if (formula.length < 2) continue;
    const result = searchEntities(index, { query: formula, limit: 3 });
    if (result.candidates.length > 0 && result.candidates[0].score >= 0.9) {
      addMention(formula, match.index, result.candidates);
    }
  }

  // Pass 2: Element symbols — only if known in symbolIndex
  for (const match of text.matchAll(SYMBOL_RE)) {
    if (match.index === undefined) continue;
    const sym = match[0];
    if (isOverlapping(match.index, match.index + sym.length)) continue;
    if (index.symbolIndex.has(sym)) {
      const ref = index.symbolIndex.get(sym)!;
      const entity = index.entitiesByRef.get(ref);
      if (entity) {
        addMention(sym, match.index, [{
          ref, kind: entity.kind, label: entity.labels['en'] ?? sym,
          score: 0.99, matchReason: 'element symbol match',
        }]);
      }
    }
  }

  // Pass 3: Word/phrase matches against alias index
  for (const match of text.matchAll(WORD_RE)) {
    if (match.index === undefined) continue;
    const word = match[0];
    if (word.length < 2) continue;
    if (isOverlapping(match.index, match.index + word.length)) continue;

    const result = searchEntities(index, { query: word, limit: 3 });
    const strong = result.candidates.filter(c => c.score >= 0.9);
    if (strong.length > 0) {
      addMention(word, match.index, strong);
    }
  }

  mentions.sort((a, b) => a.start - b.start);

  // Identify unresolved spans: words with partial matches (0.3 <= score < 0.9)
  const unresolved_spans: Array<{ text: string; start: number; end: number }> = [];
  for (const match of text.matchAll(WORD_RE)) {
    if (match.index === undefined) continue;
    const word = match[0];
    if (word.length < 3) continue;
    if (isOverlapping(match.index, match.index + word.length)) continue;
    const result = searchEntities(index, { query: word, limit: 1 });
    if (result.candidates.length > 0 && result.candidates[0].score >= 0.3 && result.candidates[0].score < 0.9) {
      unresolved_spans.push({ text: word, start: match.index, end: match.index + word.length });
    }
  }

  return { mentions, unresolved_spans };
}
