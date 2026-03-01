import type { PromptTemplateMap, PropertyDef, MorphologyData, SlotValues } from './types';
import type { RichText, TextSeg } from '../../types/ontology-ref';
import { resolveSlots, type SlotResolverContext } from './slot-resolver';

export interface RenderContext {
  promptTemplates: PromptTemplateMap;
  properties: PropertyDef[];
  morphology: MorphologyData | null;
}

export function renderPrompt(
  promptTemplateId: string,
  slotValues: SlotValues,
  ctx: RenderContext,
): string {
  const template = ctx.promptTemplates[promptTemplateId];
  if (!template) {
    throw new Error(`Prompt template "${promptTemplateId}" not found`);
  }

  const resolverCtx: SlotResolverContext = {
    properties: ctx.properties,
    morphology: ctx.morphology,
  };

  const resolved = resolveSlots(template.slots, slotValues as Record<string, string | number | string[]>, resolverCtx);

  let question = template.question;
  for (const [key, value] of Object.entries(resolved)) {
    question = question.replaceAll(`{${key}}`, value);
  }

  return question;
}

const REF_PATTERN = /\{ref:([^|}]+)(?:\|([^}]+))?\}/g;

export function renderToRichText(
  promptTemplateId: string,
  slotValues: SlotValues,
  ctx: RenderContext,
): RichText {
  // First resolve slots as before (produces string with {ref:...} intact)
  const resolved = renderPrompt(promptTemplateId, slotValues, ctx);

  // Then parse ref tokens into segments
  const segments: RichText = [];
  let lastIndex = 0;

  REF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_PATTERN.exec(resolved)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ t: 'text', v: resolved.slice(lastIndex, match.index) });
    }
    const seg: TextSeg = match[2]
      ? { t: 'ref', id: match[1], form: match[2] }
      : { t: 'ref', id: match[1] };
    segments.push(seg);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < resolved.length) {
    segments.push({ t: 'text', v: resolved.slice(lastIndex) });
  }

  // If no refs found, return single text segment
  if (segments.length === 0) {
    segments.push({ t: 'text', v: resolved });
  }

  return segments;
}
