import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface MolecularParticipant {
  formula: string;
  coeff: number;
  phase?: string;
}

interface MolecularBlock {
  reactants: MolecularParticipant[];
  products: MolecularParticipant[];
}

interface ReactionEntry {
  reaction_id: string;
  equation: string;
  type_tags: string[];
  molecular: MolecularBlock;
  phase?: { medium?: string; note_key?: string };
  conditions?: Record<string, unknown>;
  driving_forces?: string[];
  ionic?: { full?: string; net?: string; spectators?: string[] };
  observations?: Record<string, unknown>;
  rate_tips?: Record<string, unknown>;
  heat_effect?: string;
  safety_notes?: string[];
  competencies?: Record<string, string>;
  template_id?: string;
  schema_version?: number;
  [key: string]: unknown;
}

interface AddReactionArgs {
  reaction_id: string;
  equation: string;
  type_tags: string[];
  molecular: MolecularBlock;
  phase?: { medium?: string; note_key?: string };
  conditions?: Record<string, unknown>;
  driving_forces?: string[];
  ionic?: { full?: string; net?: string; spectators?: string[] };
  observations?: Record<string, unknown>;
  rate_tips?: Record<string, unknown>;
  heat_effect?: string;
  safety_notes?: string[];
  competencies?: Record<string, string>;
  template_id?: string;
  schema_version?: number;
}

interface UpdateReactionArgs {
  reaction_id: string;
  equation?: string;
  type_tags?: string[];
  molecular?: MolecularBlock;
  phase?: { medium?: string; note_key?: string };
  conditions?: Record<string, unknown>;
  driving_forces?: string[];
  ionic?: { full?: string; net?: string; spectators?: string[] };
  observations?: Record<string, unknown>;
  rate_tips?: Record<string, unknown>;
  heat_effect?: string;
  safety_notes?: string[];
  competencies?: Record<string, string>;
  template_id?: string;
  schema_version?: number;
}

interface AddReactionResult {
  ref?: string;
  status?: 'created';
  requires_review?: boolean;
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

interface UpdateReactionResult {
  ref?: string;
  status?: 'updated';
  updated_fields?: string[];
  requires_review?: boolean;
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

export async function addReaction(
  indexRef: IndexRef,
  args: AddReactionArgs,
  dataSrcOverride?: string,
): Promise<AddReactionResult> {
  // Validate reaction_id is non-empty
  if (!args.reaction_id || !args.reaction_id.trim()) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: 'reaction_id must be a non-empty string',
    };
  }

  // Validate molecular block
  if (!args.molecular?.reactants?.length) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: 'molecular.reactants must have at least 1 entry',
    };
  }
  if (!args.molecular?.products?.length) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: 'molecular.products must have at least 1 entry',
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'reactions', 'reactions.json');

  let entries: ReactionEntry[];
  try {
    entries = (await readJsonFile(filePath)) as ReactionEntry[];
  } catch {
    entries = [];
  }

  if (entries.some(e => e.reaction_id === args.reaction_id)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Reaction "${args.reaction_id}" already exists`,
    };
  }

  const entry: ReactionEntry = {
    reaction_id: args.reaction_id,
    equation: args.equation,
    type_tags: args.type_tags,
    molecular: args.molecular,
  };

  if (args.phase !== undefined) entry.phase = args.phase;
  if (args.conditions !== undefined) entry.conditions = args.conditions;
  if (args.driving_forces !== undefined) entry.driving_forces = args.driving_forces;
  if (args.ionic !== undefined) entry.ionic = args.ionic;
  if (args.observations !== undefined) entry.observations = args.observations;
  if (args.rate_tips !== undefined) entry.rate_tips = args.rate_tips;
  if (args.heat_effect !== undefined) entry.heat_effect = args.heat_effect;
  if (args.safety_notes !== undefined) entry.safety_notes = args.safety_notes;
  if (args.competencies !== undefined) entry.competencies = args.competencies;
  if (args.template_id !== undefined) entry.template_id = args.template_id;
  if (args.schema_version !== undefined) entry.schema_version = args.schema_version;

  entries.push(entry);

  await writeJsonFile(filePath, entries);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: args.reaction_id,
    status: 'created',
    requires_review: true,
  };
}

export async function updateReaction(
  indexRef: IndexRef,
  args: UpdateReactionArgs,
  dataSrcOverride?: string,
): Promise<UpdateReactionResult> {
  if (!args.reaction_id || !args.reaction_id.trim()) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: 'reaction_id must be a non-empty string',
    };
  }

  // Validate molecular block if provided
  if (args.molecular !== undefined) {
    if (!args.molecular?.reactants?.length) {
      return {
        error: true,
        code: 'VALIDATION_FAILED',
        message: 'molecular.reactants must have at least 1 entry',
      };
    }
    if (!args.molecular?.products?.length) {
      return {
        error: true,
        code: 'VALIDATION_FAILED',
        message: 'molecular.products must have at least 1 entry',
      };
    }
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'reactions', 'reactions.json');

  let entries: ReactionEntry[];
  try {
    entries = (await readJsonFile(filePath)) as ReactionEntry[];
  } catch {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `reactions.json not found at ${filePath}`,
    };
  }

  const idx = entries.findIndex(e => e.reaction_id === args.reaction_id);

  if (idx === -1) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Reaction "${args.reaction_id}" not found`,
    };
  }

  const { reaction_id: _id, ...fields } = args;
  void _id;

  const updated: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      (entries[idx] as any)[k] = v;
      updated.push(k);
    }
  }

  await writeJsonFile(filePath, entries);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: args.reaction_id,
    status: 'updated',
    updated_fields: updated,
    requires_review: true,
  };
}
