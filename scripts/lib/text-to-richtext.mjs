/**
 * Convert plain text to RichText segments.
 *
 * Ports the exact ChemText regex detection logic from
 * src/components/ChemText.tsx to a Node.js build-time utility.
 *
 * @module scripts/lib/text-to-richtext
 */

/**
 * Escape regex special characters in a string.
 * Exact port of ChemText.escapeRe.
 * @param {string} s
 * @returns {string}
 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex that alternates all known formulas, longest first.
 * Exact port of ChemText.buildFormulaRegex.
 * @param {Record<string, {type: string, id: string, cls?: string, ionType?: string}>} lookup
 * @returns {RegExp}
 */
function buildFormulaRegex(lookup) {
  const formulas = Object.keys(lookup).sort((a, b) => b.length - a.length);
  if (formulas.length === 0) return /(?!)/; // never matches
  const alt = formulas.map(escapeRe).join('|');
  // Lookahead: not followed by lowercase Latin (prevents matching inside words)
  return new RegExp(`(?:${alt})(?![a-z])`, 'g');
}

/**
 * Characters that mean "the match is inside a word, skip it".
 * Includes degree sign to prevent C -> Carbon.
 * Exact port of ChemText.WORD_CHAR.
 */
const WORD_CHAR = /[A-Za-z\u0410-\u044F\u0451\u0401\u00B0]/;

/**
 * Convert plain text to RichText segments using formula lookup.
 *
 * Ports the exact matching logic from ChemText.tsx including:
 * - Longest match first via sorted alternation regex
 * - Manual lookbehind: skip if preceded by Latin/Cyrillic letter or degree sign
 * - Single-char element guards: skip if preceded by (+- or followed by uppercase/)
 *
 * @param {string} text - Plain text that may contain chemical formulas
 * @param {Record<string, {type: string, id: string, cls?: string, ionType?: string}>} formulaLookup
 *   Map of formula string -> lookup entry (same shape as formula_lookup.json)
 * @returns {Array<{t:string, [key:string]: unknown}>|string}
 *   RichText segments array if formulas found, or original string if none detected
 */
export function textToRichText(text, formulaLookup) {
  if (!text || typeof text !== 'string') return text;
  if (!formulaLookup || Object.keys(formulaLookup).length === 0) return text;

  const regex = buildFormulaRegex(formulaLookup);
  const segments = [];
  let lastIndex = 0;

  regex.lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Manual "lookbehind": skip if preceded by a Latin/Cyrillic letter or degree sign
    if (match.index > 0 && WORD_CHAR.test(text[match.index - 1])) {
      continue;
    }

    const formula = match[0];
    const entry = formulaLookup[formula];
    if (!entry) continue;

    // Extra filter for single-char matches (H, O, I, V, S, etc.):
    // Skip if preceded by '(' or '+' or '-' — likely Roman numeral / oxidation state
    // Skip if followed by uppercase — likely abbreviation or Roman numeral (II)
    if (formula.length === 1) {
      const charBefore = match.index > 0 ? text[match.index - 1] : '';
      const charAfter = text[match.index + 1] ?? '';
      if (/[+\-(]/.test(charBefore) || /[A-Z)]/.test(charAfter)) {
        continue;
      }
    }

    // Push text before this match
    if (match.index > lastIndex) {
      segments.push({ t: 'text', v: text.slice(lastIndex, match.index) });
    }

    // Map to formula segment with kind/id from lookup
    const seg = { t: 'formula', formula };
    if (entry.type === 'substance') {
      seg.kind = 'substance';
      seg.id = entry.id;
    } else if (entry.type === 'ion') {
      seg.kind = 'ion';
      seg.id = entry.id;
    } else {
      // Element
      seg.kind = 'element';
      seg.id = entry.id;
    }

    segments.push(seg);
    lastIndex = match.index + formula.length;
  }

  // No matches at all — return original string (not wrapped in array)
  if (segments.length === 0 && lastIndex === 0) return text;

  // Trailing text
  if (lastIndex < text.length) {
    segments.push({ t: 'text', v: text.slice(lastIndex) });
  }

  // Merge adjacent text segments (defensive — shouldn't happen with current logic)
  const merged = [];
  for (const seg of segments) {
    if (seg.t === 'text' && merged.length > 0 && merged[merged.length - 1].t === 'text') {
      merged[merged.length - 1].v += seg.v;
    } else {
      merged.push(seg);
    }
  }

  return merged;
}
