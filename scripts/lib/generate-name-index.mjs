/**
 * Generate per-locale name_index.{locale}.json — a reverse index
 * mapping localized common names to chemistry entities.
 *
 * Name sources:
 * 1. Elements: name → { kind: 'element', id: symbol }
 * 2. Ions: name → { kind: 'ion', id: ion.id }
 * 3. Substances: name → { kind: 'substance', id: 'sub:' + substanceId }
 * 4. Terms + bindings: name + synonyms → binding.ref
 */

/**
 * @param {object} params
 * @param {any[]} params.elements - Element data (with name from locale overlay)
 * @param {any[]} params.ions - Ion data (with name from locale overlay)
 * @param {Array<{filename: string, data: any}>} params.substances - Substance file entries
 * @param {any[]} params.terms - ChemTerm entries
 * @param {any[]} params.bindings - TermBinding entries
 * @returns {Record<string, Array<{ref: object, source: string, name: string}>>}
 */
export function generateNameIndex({ elements, ions, substances, terms, bindings }) {
  /** @type {Record<string, Array<{ref: object, source: string, name: string}>>} */
  const index = {};

  function addEntry(name, ref, source) {
    const key = name.toLowerCase().trim();
    if (!key) return;
    if (!index[key]) index[key] = [];
    index[key].push({ ref, source, name: key });
  }

  // 1. Elements
  for (const el of elements) {
    if (el.name) {
      addEntry(el.name, { kind: 'element', id: el.symbol }, 'element');
    }
  }

  // 2. Ions
  for (const ion of ions) {
    if (ion.name) {
      addEntry(ion.name, { kind: 'ion', id: ion.id }, 'ion');
    }
  }

  // 3. Substances
  for (const { data: sub } of substances) {
    if (sub.name) {
      addEntry(sub.name, { kind: 'substance', id: 'sub:' + sub.id }, 'substance');
    }
  }

  // 4. Terms (with bindings)
  const bindingMap = new Map();
  for (const b of bindings) {
    bindingMap.set(b.term_id, b.ref);
  }

  for (const term of terms) {
    const ref = bindingMap.get(term.id);
    if (!ref) continue;
    if (term.name) addEntry(term.name, ref, 'term');
    if (term.synonyms) {
      for (const syn of term.synonyms) {
        addEntry(syn, ref, 'term');
      }
    }
  }

  return index;
}
