import type { OntRef, OntRefKind, RichText } from '../types/ontology-ref';

const PREFIX_TO_KIND: Record<string, OntRefKind> = {
  el: 'element',
  sub: 'substance',
  ion: 'ion',
  rx: 'reaction',
  cls: 'substance_class',
  grp: 'element_group',
  rxtype: 'reaction_type',
  proc: 'process',
  prop: 'property',
  ctx: 'context',
};

const KIND_TO_PREFIX: Record<OntRefKind, string> = Object.fromEntries(
  Object.entries(PREFIX_TO_KIND).map(([k, v]) => [v, k]),
) as Record<OntRefKind, string>;

/** Parse "sub:naoh" -> { kind: "substance", id: "naoh" } */
export function parseOntRef(str: string): OntRef {
  const idx = str.indexOf(':');
  if (idx === -1) throw new Error(`Invalid OntRef format: "${str}" (missing ":")`);
  const prefix = str.slice(0, idx);
  const id = str.slice(idx + 1);
  const kind = PREFIX_TO_KIND[prefix];
  if (!kind) throw new Error(`Unknown OntRef prefix: "${prefix}"`);
  return { kind, id };
}

/** Serialize { kind: "substance", id: "naoh" } -> "sub:naoh" */
export function toOntRefStr(ref: OntRef): string {
  const prefix = KIND_TO_PREFIX[ref.kind];
  if (!prefix) throw new Error(`Unknown OntRef kind: "${ref.kind}"`);
  return `${prefix}:${ref.id}`;
}

/** Convert RichText AST to plain string (strips refs/formulas to their text) */
export function richTextToPlainString(segments: RichText): string {
  return segments
    .map((seg) => {
      switch (seg.t) {
        case 'text':
          return seg.v;
        case 'ref':
          return seg.surface ?? seg.id;
        case 'formula':
          return seg.formula;
        case 'br':
          return '\n';
        case 'em':
          return richTextToPlainString(seg.children);
        case 'strong':
          return richTextToPlainString(seg.children);
        default:
          return '';
      }
    })
    .join('');
}
