import type { PromptTemplate, PropertyDef, MorphologyData } from './types';

export interface SlotResolverContext {
  properties: PropertyDef[];
  morphology: MorphologyData | null;
}

function interpolate(template: string, values: Record<string, string | number | string[]>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = values[key];
    return v !== undefined ? String(v) : `{${key}}`;
  });
}

function navigatePath(obj: unknown, path: string): string | undefined {
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

function resolveLookup(
  directive: string,
  values: Record<string, string | number | string[]>,
  ctx: SlotResolverContext,
): string | undefined {
  const raw = directive.slice(7); // Remove "lookup:"
  const interpolated = interpolate(raw, values);
  const parts = interpolated.split('.');
  const collection = parts[0];
  const itemKey = parts[1];
  const path = parts.slice(2).join('.');

  if (collection === 'properties') {
    const prop = ctx.properties.find(p => p.id === itemKey);
    if (!prop) return undefined;
    return navigatePath(prop, path);
  }

  return undefined;
}

function resolveMorph(
  directive: string,
  values: Record<string, string | number | string[]>,
  ctx: SlotResolverContext,
): string | undefined {
  if (!ctx.morphology) return undefined;

  const raw = directive.slice(6); // Remove "morph:"
  const interpolated = interpolate(raw, values);
  const parts = interpolated.split('.');
  const domain = parts[0];
  const key = parts[1];
  const field = parts[2];

  const domainData = ctx.morphology[domain as keyof MorphologyData];
  if (!domainData || typeof domainData !== 'object') return undefined;

  const entry = (domainData as Record<string, Record<string, string>>)[key];
  if (!entry) return undefined;

  return entry[field];
}

export function resolveSlots(
  promptSlots: PromptTemplate['slots'],
  values: Record<string, string | number | string[]>,
  ctx: SlotResolverContext,
): Record<string, string> {
  const result: Record<string, string> = {};

  // First, copy all values as-is (passthrough)
  for (const [key, val] of Object.entries(values)) {
    if (Array.isArray(val)) {
      result[key] = val.join(', ');
    } else {
      result[key] = String(val);
    }
  }

  // Then apply slot overrides from prompt template
  for (const [slotName, spec] of Object.entries(promptSlots)) {
    if (typeof spec === 'string') {
      let resolved: string | undefined;
      if (spec.startsWith('lookup:')) {
        resolved = resolveLookup(spec, values, ctx);
      } else if (spec.startsWith('morph:')) {
        resolved = resolveMorph(spec, values, ctx);
      }
      if (resolved !== undefined) {
        result[slotName] = resolved;
      }
    } else if (typeof spec === 'object' && spec !== null) {
      const mapKey = String(values[slotName] ?? '');
      if (mapKey in spec) {
        result[slotName] = spec[mapKey];
      }
    }
  }

  return result;
}
