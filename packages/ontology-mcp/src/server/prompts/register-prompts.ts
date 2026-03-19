import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ONTOLOGY_AUTHOR_SYSTEM_PROMPT } from './system-prompt.js';

export function registerPrompts(server: McpServer): void {
  // System prompt for the ontology-author agent — provides full context
  server.registerPrompt(
    'ontology_author_system',
    {
      description: 'Full system prompt for the ontology-author agent. Call this first to get project context, admission policy, examples, and workflow.',
    },
    async () => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: ONTOLOGY_AUTHOR_SYSTEM_PROMPT,
        },
      }],
    })
  );

  server.registerPrompt(
    'annotate_existing_text',
    {
      description: 'Annotate chemistry text with ontology refs. Use search_entities and resolve_mention tools first.',
      argsSchema: {
        text: z.string().describe('The text to annotate'),
        material_language: z.string().describe('ISO locale: ru, en, pl, es'),
        mode: z.enum(['didactic', 'definition', 'task', 'explanation']).optional(),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are ontology-author. Annotate the following text by binding text spans to canonical ontology refs.

Rules:
1. Use resolve_mention for each chemistry term you identify.
2. Prefer existing refs over new proposals.
3. Mark ambiguity explicitly (do not guess).
4. Return structured JSON with annotations and unresolved_mentions.

Text (${args.material_language}):
"""
${args.text}
"""

Mode: ${args.mode ?? 'didactic'}

Return a JSON object with: { annotations: [...], unresolved_mentions: [...], warnings: [...] }`,
        },
      }],
    })
  );

  server.registerPrompt(
    'author_didactic_block',
    {
      description: 'Write ontology-bound didactic content for a concept or topic.',
      argsSchema: {
        topic: z.string().describe('Concept ref or topic description'),
        material_language: z.string().describe('Target locale'),
        target_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are ontology-author. Write a didactic explanation for "${args.topic}" in ${args.material_language}.

Rules:
1. Use get_entity to retrieve canonical data about the topic first.
2. Use get_neighbors to find related concepts.
3. Every chemistry term MUST be bound to a canonical ref via resolve_mention.
4. Output plain text with inline ref annotations: [[ref:cls:acid|кислота]].
5. Do not invent concepts — use only existing ontology refs.
6. Level: ${args.target_level ?? 'intermediate'}`,
        },
      }],
    })
  );

  server.registerPrompt(
    'review_annotation',
    {
      description: 'Review and validate an existing annotation result.',
      argsSchema: {
        annotation_json: z.string().describe('JSON string of AnnotationResult'),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are ontology-author in review mode. Review this annotation result.

Checklist:
1. Does each annotation bind to the correct canonical ref?
2. Are there any missed mentions that should be annotated?
3. Is any proposal actually just an alias or overlay?
4. Are there overlapping or contradictory annotations?
5. Use validate_annotation tool to check structural validity.
6. Use get_entity to verify each chosen_ref exists and is appropriate.

Annotation result:
${args.annotation_json}

Return: { verdict: 'approve'|'revise', issues: [...], suggested_fixes: [...] }`,
        },
      }],
    })
  );

  server.registerPrompt(
    'propose_missing_entity',
    {
      description: 'Evaluate whether an unresolved mention needs a new ontology entity.',
      argsSchema: {
        mention: z.string().describe('The unresolved text mention'),
        material_language: z.string().describe('Source locale'),
        context: z.string().optional().describe('Surrounding text'),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are ontology-author. Evaluate whether "${args.mention}" (${args.material_language}) needs a new ontology entity.

Steps:
1. Use search_entities to find any existing close matches.
2. Use classify_addition to determine the addition type.
3. Follow admission policy (read ontology://policy/admission resource first).
4. Prefer: alias > overlay > relation > extension > new entity.
5. If new entity is truly needed, use create_proposal_draft.

Context: ${args.context ?? 'none'}

Return: { decision: string, addition_type: string, proposal?: ProposalDraft }`,
        },
      }],
    })
  );

  server.registerPrompt(
    'repair_annotation',
    {
      description: 'Fix issues in an annotation result based on review feedback.',
      argsSchema: {
        annotation_json: z.string().describe('JSON string of AnnotationResult'),
        issues: z.string().describe('JSON array of issues from review'),
      },
    },
    async (args) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are ontology-author. Repair the following annotation based on review feedback.

Original annotation:
${args.annotation_json}

Issues to fix:
${args.issues}

Steps:
1. For each issue, use resolve_mention or search_entities to find the correct ref.
2. Remove invalid annotations.
3. Add missing annotations.
4. Use validate_annotation to verify the repaired result.

Return the corrected AnnotationResult JSON.`,
        },
      }],
    })
  );
}
