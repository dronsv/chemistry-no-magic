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

  // Pass 3: Multi-word n-gram matching (bigrams, trigrams) against alias index.
  // Surface forms like "ионная связь", "общая электронная пара" are multi-word entries
  // in the alias index. We must try n-grams before single words (longest match wins).
  const wordTokens: Array<{ text: string; start: number; end: number }> = [];
  for (const match of text.matchAll(WORD_RE)) {
    if (match.index === undefined) continue;
    if (match[0].length < 2) continue;
    wordTokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
  }

  // Try trigrams first, then bigrams — longest match wins
  for (const n of [3, 2]) {
    for (let i = 0; i <= wordTokens.length - n; i++) {
      const span = wordTokens.slice(i, i + n);
      const startPos = span[0].start;
      const endPos = span[n - 1].end;
      if (isOverlapping(startPos, endPos)) continue;

      // Only try if the gap between tokens is reasonable (< 3 chars, i.e. just spaces)
      let gapOk = true;
      for (let j = 1; j < span.length; j++) {
        if (span[j].start - span[j - 1].end > 2) { gapOk = false; break; }
      }
      if (!gapOk) continue;

      const phrase = span.map(t => t.text).join(' ');
      const result = searchEntities(index, { query: phrase, limit: 3 });
      const strong = result.candidates.filter(c => c.score >= 0.9);
      if (strong.length > 0) {
        const originalText = text.slice(startPos, endPos);
        addMention(originalText, startPos, strong);
      }
    }
  }

  // Pass 4: Single-word matches (only if not already covered by n-gram)
  for (const token of wordTokens) {
    if (isOverlapping(token.start, token.end)) continue;

    const result = searchEntities(index, { query: token.text, limit: 3 });
    const strong = result.candidates.filter(c => c.score >= 0.9);
    if (strong.length > 0) {
      addMention(token.text, token.start, strong);
    }
  }

  mentions.sort((a, b) => a.start - b.start);

  // Identify unresolved spans: words with partial matches (0.3 <= score < 0.9)
  const unresolved_spans: Array<{ text: string; start: number; end: number }> = [];
  for (const token of wordTokens) {
    if (token.text.length < 3) continue;
    if (isOverlapping(token.start, token.end)) continue;
    const result = searchEntities(index, { query: token.text, limit: 1 });
    if (result.candidates.length > 0 && result.candidates[0].score >= 0.3 && result.candidates[0].score < 0.9) {
      unresolved_spans.push({ text: token.text, start: token.start, end: token.end });
    }
  }

  return { mentions, unresolved_spans };
}
