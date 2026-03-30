/**
 * Semantic didactic renderer.
 *
 * Takes a theory module skeleton + semantic module + language templates
 * and produces a TheoryModule with _didactic* RichText fields injected.
 */

import type { TheoryModule, TheorySection, TheoryBlock, DidacticModule } from '../types/theory-module';
import type { RichText, TextSeg } from '../types/ontology-ref';
import type {
  SemanticDidacticModule,
  SemanticBondRuleCard,
  SemanticComparisonTable,
  SemanticConceptDefinition,
  SemanticMnemonicRule,
  SemanticBlock,
  DidacticTemplatePack,
} from '../types/semantic-didactic';

// ---------------------------------------------------------------------------
// Ref token parsing (same regex as prompt-renderer.ts)
// ---------------------------------------------------------------------------

const REF_PATTERN = /\{ref:([^|}]+)(?:\|([^}]+))?\}/g;

/** Parse a resolved template string into RichText segments. */
function parseRefsToRichText(text: string): RichText {
  const segments: RichText = [];
  let lastIndex = 0;

  REF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ t: 'text', v: text.slice(lastIndex, match.index) });
    }
    const seg: TextSeg = match[2]
      ? { t: 'ref', id: match[1], form: match[2] }
      : { t: 'ref', id: match[1] };
    segments.push(seg);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ t: 'text', v: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ t: 'text', v: text });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Slot extraction from semantic blocks
// ---------------------------------------------------------------------------

function extractBondRuleSlots(block: SemanticBondRuleCard): Record<string, string> {
  const slots: Record<string, string> = {
    concept: block.concept_ref,
    mechanism: block.mechanism_ref,
  };

  if (block.criterion.participant_refs[0]) {
    slots.p0 = block.criterion.participant_refs[0];
  }
  if (block.criterion.participant_refs[1]) {
    slots.p1 = block.criterion.participant_refs[1];
  }
  if (block.criterion.value !== undefined) {
    // Use comma as decimal separator for display (matches existing convention)
    slots.value = String(block.criterion.value).replace('.', ',');
  }
  if (block.criterion.range) {
    slots.range_low = String(block.criterion.range[0]).replace('.', ',');
    slots.range_high = String(block.criterion.range[1]).replace('.', ',');
  }
  if (block.lattice_ref) {
    slots.lattice = block.lattice_ref;
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a template: replace {slot} placeholders with values,
 * then parse {ref:id|form} tokens into RichText.
 */
function resolveTemplate(
  templates: DidacticTemplatePack,
  templateKey: string,
  slots: Record<string, string>,
): RichText | null {
  const tmpl = templates[templateKey];
  if (!tmpl) return null;

  let question = tmpl.question;

  // Pass 1: slot replacement
  for (const [key, value] of Object.entries(slots)) {
    question = question.replaceAll(`{${key}}`, value);
  }

  // Pass 2: parse ref tokens → RichText
  return parseRefsToRichText(question);
}

// ---------------------------------------------------------------------------
// Block-level rendering
// ---------------------------------------------------------------------------

type DidacticFields = Record<string, unknown>;

function renderBondRuleCard(
  block: SemanticBondRuleCard,
  templates: DidacticTemplatePack,
): DidacticFields {
  const slots = extractBondRuleSlots(block);
  const fields: DidacticFields = {};

  // Title (Level 1): concept name
  const title = resolveTemplate(templates, `${block.id}.title`, slots);
  if (title) fields._didacticTitle = title;

  // Rule (Level 2): criterion sentence
  const rule = resolveTemplate(templates, `${block.id}.rule`, slots);
  if (rule) fields._didacticRule = rule;

  // Description (Level 2): mechanism + properties
  const desc = resolveTemplate(templates, `${block.id}.description`, slots);
  if (desc) fields._didacticDescription = desc;

  return fields;
}

function renderGenericBlock(
  block: SemanticConceptDefinition | SemanticMnemonicRule,
  templates: DidacticTemplatePack,
): DidacticFields {
  const fields: DidacticFields = {};
  const tmpl = templates[`${block.id}.text`];
  if (!tmpl) return fields;

  // Check if template contains pipe-separated items (for ordered_list blocks)
  if (tmpl.question.includes('|')) {
    const items = splitOutsideBraces(tmpl.question);
    fields._didacticItems = items.map(item => parseRefsToRichText(item.trim()));
  } else {
    const text = resolveTemplate(templates, `${block.id}.text`, {});
    if (text) fields._didacticText = text;
  }
  return fields;
}

function renderComparisonTable(
  block: SemanticComparisonTable,
  templates: DidacticTemplatePack,
): DidacticFields {
  const fields: DidacticFields = {};

  // Columns — use ontology refs where available, fall back to template text
  const colTmpl = templates[`${block.id}.columns`];
  const fallbackCols = colTmpl ? splitOutsideBraces(colTmpl.question) : [];

  fields._didacticColumns = block.columns.map((col, i) => {
    if (col.ref) {
      // Ontology ref → clickable chip with tooltip
      return [{ t: 'ref' as const, id: col.ref }];
    }
    // Plain text from template (by position)
    const text = fallbackCols[i]?.trim();
    return text ? parseRefsToRichText(text) : [{ t: 'text' as const, v: col.key }];
  });

  // Rows — one template per row_ref
  const rows: RichText[][] = [];
  for (const rowRef of block.row_refs) {
    const rowTmpl = templates[`${block.id}.row.${rowRef}`];
    if (rowTmpl) {
      const cells = splitOutsideBraces(rowTmpl.question);
      rows.push(cells.map(cell => parseRefsToRichText(cell.trim())));
    }
  }
  if (rows.length > 0) fields._didacticRows = rows;

  return fields;
}

/** Split a string on `|` but skip pipes inside `{...}` (ref tokens). */
function splitOutsideBraces(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);

    if (ch === '|' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

// ---------------------------------------------------------------------------
// Module-level application
// ---------------------------------------------------------------------------

/** Extract block ID from a TheoryBlock. */
function getBlockId(block: TheoryBlock): string | undefined {
  if ('id' in block && typeof (block as Record<string, unknown>).id === 'string') {
    return (block as Record<string, unknown>).id as string;
  }
  return undefined;
}

/**
 * Apply the semantic didactic layer to a theory module.
 *
 * Merge cascade per block:
 * 1. Semantic block → language templates → generated RichText
 * 2. Overrides replace generated fields where present
 * 3. Result injected as _didactic* fields (same as existing mergeBlockDidactic)
 */
export function applySemanticLayer(
  module: TheoryModule,
  semantic: SemanticDidacticModule,
  templates: DidacticTemplatePack,
  overrides?: DidacticModule | null,
): TheoryModule {
  // Build a lookup: sectionId → blockId → SemanticBlock
  const sectionMap = new Map<string, Map<string, SemanticBlock>>();
  for (const section of semantic.sections) {
    const blockMap = new Map<string, SemanticBlock>();
    if (section.blocks) {
      for (const block of section.blocks) {
        blockMap.set(block.id, block);
      }
    }
    sectionMap.set(section.id, blockMap);
  }

  // Build semantic section title lookup
  const sectionTitles = new Map<string, string>();
  for (const section of semantic.sections) {
    if (section.title_template) sectionTitles.set(section.id, section.title_template);
  }

  return {
    ...module,
    sections: module.sections.map(section => {
      const semanticBlocks = sectionMap.get(section.id);
      const sectionResult: TheorySection & { _didacticTitle?: RichText } = { ...section };

      // Section title from template
      const titleKey = sectionTitles.get(section.id);
      if (titleKey) {
        const titleRt = resolveTemplate(templates, titleKey, {});
        if (titleRt) sectionResult._didacticTitle = titleRt;
      }

      // Override section title if present
      const secOverride = overrides?.sections?.[section.id];
      if (secOverride?.title) {
        sectionResult._didacticTitle = secOverride.title;
      }

      if (!semanticBlocks) return sectionResult;

      sectionResult.blocks = section.blocks.map(block => {
        const blockId = getBlockId(block);
        if (!blockId) return block;

        const semBlock = semanticBlocks.get(blockId);
        if (!semBlock) return block;

        // Generate fields from semantic block + templates
        let fields: DidacticFields;
        if (semBlock.kind === 'bond_rule_card') {
          fields = renderBondRuleCard(semBlock, templates);
        } else if (semBlock.kind === 'comparison_table') {
          fields = renderComparisonTable(semBlock, templates);
        } else if (semBlock.kind === 'concept_definition' || semBlock.kind === 'mnemonic_rule') {
          fields = renderGenericBlock(semBlock, templates);
        } else {
          return block;
        }

        // Apply overrides — replace generated fields where present
        const blockOverride = secOverride?.blocks?.[blockId];
        if (blockOverride) {
          if (blockOverride.title) fields._didacticTitle = blockOverride.title;
          if (blockOverride.rule) fields._didacticRule = blockOverride.rule;
          if (blockOverride.description) fields._didacticDescription = blockOverride.description;
          if (blockOverride.text) fields._didacticText = blockOverride.text;
          if (blockOverride.content) fields._didacticContent = blockOverride.content;
          if (blockOverride.columns) fields._didacticColumns = blockOverride.columns;
          if (blockOverride.rows) fields._didacticRows = blockOverride.rows;
        }

        // Merge into block
        return { ...block, ...fields } as TheoryBlock;
      });

      return sectionResult;
    }),
  };
}
