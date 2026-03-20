import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { buildOntologyIndex } from './indexing/build-index.js';
import { searchEntities } from './tools/search-entities.js';
import { getEntity } from './tools/get-entity.js';
import { resolveMention } from './tools/resolve-mention.js';
import { getNeighbors } from './tools/get-neighbors.js';
import { validateAnnotation } from './tools/validate-annotation.js';
import { suggestRefsForText } from './tools/suggest-refs-for-text.js';
import { classifyAddition } from './tools/classify-addition.js';
import { createProposalDraft } from './tools/create-proposal-draft.js';
import { bootstrapDocument } from './tools/bootstrap-document.js';
import { registerResources } from './resources/register-resources.js';
import { registerPrompts } from './prompts/register-prompts.js';
import type { IndexRef } from '../shared/types.js';

const KINDS_DESC =
  'Filter by entity kinds. Allowed: element, substance, ion, concept, substance_class, ' +
  'reaction_type, reaction_facet, domain_concept, formula, process, property';

async function main(): Promise<void> {
  process.stderr.write('[ontology-mcp] Starting index build...\n');
  const indexRef: IndexRef = { current: await buildOntologyIndex() };

  const server = new McpServer({
    name: 'ontology-mcp',
    version: '0.2.0',
  });

  // --- Tools ---

  server.registerTool('search_entities', {
    description: 'Search ontology entities by query string. Returns ranked candidates by ref, kind, label, and score.',
    inputSchema: {
      query: z.string().describe('Search query: ref, symbol, formula, name, or alias'),
      kinds: z.array(z.string()).optional().describe(KINDS_DESC),
      limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10)'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(searchEntities(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('get_entity', {
    description: 'Retrieve full details for a single ontology entity by its exact ref (e.g. "el:Na", "sub:hcl", "cls:acid").',
    inputSchema: {
      ref: z.string().describe('Exact ontology ref, e.g. "el:Na", "sub:hcl", "cls:acid", "ion:H_plus"'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(getEntity(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('get_neighbors', {
    description: 'Return graph neighbors by relation type. Shows outgoing (subject→object) and incoming (object→subject) relations.',
    inputSchema: {
      ref: z.string().describe('Entity ref to find neighbors for'),
      relation_types: z.array(z.string()).optional().describe('Filter by relation predicates (e.g. "instance_of", "has_parent")'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results per direction (default 50)'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(getNeighbors(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('resolve_mention', {
    description: 'Resolve a natural language mention (e.g. "кислота", "acid", "HCl") to the best ontology ref. Returns best_candidate, all candidates, and a proposed_action.',
    inputSchema: {
      mention: z.string().describe('The text mention to resolve'),
      material_language: z.string().optional().describe('ISO locale of the source text, e.g. "ru", "en", "pl", "es"'),
      context: z.string().optional().describe('Optional surrounding text for disambiguation'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(resolveMention(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('validate_annotation', {
    description: 'Validate annotation set against ontology and policy. Checks refs exist, no overlaps, confidence thresholds.',
    inputSchema: {
      doc_id: z.string().describe('Document identifier'),
      material_language: z.string().describe('ISO locale'),
      annotations: z.array(z.object({
        text: z.string(),
        start: z.number(),
        end: z.number(),
        kind: z.string(),
        chosen_ref: z.string().optional(),
        confidence: z.number().optional(),
        candidates: z.array(z.object({
          ref: z.string(),
          kind: z.string(),
          label: z.string(),
          score: z.number(),
          matchReason: z.string(),
        })),
      })).describe('Array of annotations to validate'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(validateAnnotation(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('suggest_refs_for_text', {
    description: 'Analyze a text block and return candidate ontology bindings for detected mentions.',
    inputSchema: {
      text: z.string().describe('Text to analyze'),
      material_language: z.string().describe('ISO locale'),
      mode: z.enum(['didactic', 'definition', 'task', 'explanation']).describe('Content mode'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(suggestRefsForText(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('classify_addition', {
    description: 'Determine what kind of ontology addition is needed for a candidate text. Returns addition_type, confidence, rationale.',
    inputSchema: {
      candidate_text: z.string().describe('The candidate text to classify'),
      material_language: z.string().describe('ISO locale'),
      context: z.string().optional().describe('Surrounding text'),
      nearest_refs: z.array(z.string()).optional().describe('Known nearby refs for context'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(classifyAddition(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('create_proposal_draft', {
    description: 'Build a proposal object for a new ontology addition without committing. Side-effect free.',
    inputSchema: {
      candidate_text: z.string().describe('The candidate text'),
      material_language: z.string().describe('ISO locale'),
      nearest_refs: z.array(z.string()).optional().describe('Known nearby refs'),
      evidence_text: z.string().optional().describe('Source text evidence'),
      source_doc_id: z.string().optional().describe('Source document ID'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(createProposalDraft(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('bootstrap_document', {
    description: 'Run a complete document annotation pass. Returns annotations, proposals, and coverage metrics.',
    inputSchema: {
      doc_id: z.string().describe('Document identifier'),
      material_language: z.string().describe('ISO locale'),
      text: z.string().describe('Full document text'),
      mode: z.enum(['didactic', 'definition', 'task', 'explanation']).describe('Content mode'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(bootstrapDocument(indexRef.current, args), null, 2) }],
  }));

  // --- Resources & Prompts ---
  registerResources(server, indexRef.current);
  registerPrompts(server);

  process.stderr.write('[ontology-mcp] All tools, resources, and prompts registered. Connecting stdio transport...\n');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[ontology-mcp] Server ready.\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`[ontology-mcp] Fatal error: ${error}\n`);
  process.exit(1);
});
