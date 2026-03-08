/**
 * Generate instance_of relation triples from substance class/subclass fields.
 *
 * Emits:
 *   { subject: "sub:SUBSTANCE_ID", predicate: "instance_of", object: "class:CLASS" }
 *   { subject: "sub:SUBSTANCE_ID", predicate: "instance_of", object: "subclass:SUBCLASS" }
 *
 * These triples form the classification graph usable by task engine generators.
 */

/**
 * @param {Array<{id: string, class?: string, subclass?: string}>} substances
 * @returns {Array<{subject: string, predicate: string, object: string}>}
 */
export function generateInstanceOf(substances) {
  const triples = [];
  for (const s of substances) {
    if (s.class) {
      triples.push({ subject: `sub:${s.id}`, predicate: 'instance_of', object: `class:${s.class}` });
    }
    if (s.subclass) {
      triples.push({ subject: `sub:${s.id}`, predicate: 'instance_of', object: `subclass:${s.subclass}` });
    }
  }
  return triples;
}
