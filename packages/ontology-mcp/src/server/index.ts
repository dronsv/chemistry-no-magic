import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { buildOntologyIndex } from './indexing/build-index.js';
import { searchEntities } from './tools/search-entities.js';
import { getEntity } from './tools/get-entity.js';
import { resolveMention } from './tools/resolve-mention.js';

async function main(): Promise<void> {
  process.stderr.write('[ontology-mcp] Starting index build...\n');
  const index = await buildOntologyIndex();

  const server = new McpServer({
    name: 'ontology-mcp',
    version: '0.1.0',
  });

  // Tool: search_entities
  server.tool(
    'search_entities',
    'Search ontology entities by query string. Returns ranked candidates by ref, kind, label, and score.',
    {
      query: z.string().describe('Search query: ref, symbol, formula, name, or alias'),
      kinds: z
        .array(z.string())
        .optional()
        .describe(
          'Filter by entity kinds. Allowed: element, substance, ion, concept, substance_class, ' +
          'reaction_type, reaction_facet, domain_concept, formula, process, property'
        ),
      limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10)'),
    },
    async (args) => {
      const result = searchEntities(index, args);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Tool: get_entity
  server.tool(
    'get_entity',
    'Retrieve full details for a single ontology entity by its exact ref (e.g. "el:Na", "sub:hcl", "cls:acid").',
    {
      ref: z.string().describe('Exact ontology ref, e.g. "el:Na", "sub:hcl", "cls:acid", "ion:H_plus"'),
    },
    async (args) => {
      const result = getEntity(index, args);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  // Tool: resolve_mention
  server.tool(
    'resolve_mention',
    'Resolve a natural language mention (e.g. "кислота", "acid", "HCl", "sodium") to the best ontology ref. ' +
    'Returns best_candidate, all candidates, and a proposed_action.',
    {
      mention: z.string().describe('The text mention to resolve'),
      material_language: z
        .string()
        .optional()
        .describe('ISO locale of the source text, e.g. "ru", "en", "pl", "es"'),
      context: z.string().optional().describe('Optional surrounding text for disambiguation'),
    },
    async (args) => {
      const result = resolveMention(index, args);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  process.stderr.write('[ontology-mcp] Tools registered. Connecting stdio transport...\n');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[ontology-mcp] Server ready.\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`[ontology-mcp] Fatal error: ${error}\n`);
  process.exit(1);
});
