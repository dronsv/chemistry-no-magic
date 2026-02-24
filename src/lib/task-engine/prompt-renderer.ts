import type { PromptTemplateMap, PropertyDef, MorphologyData, SlotValues } from './types';
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
