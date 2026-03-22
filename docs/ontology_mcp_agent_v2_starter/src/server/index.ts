/**
 * MCP server entry skeleton.
 *
 * Replace placeholder registration calls with the official MCP TypeScript SDK
 * methods used in your chosen SDK version.
 */
import { buildOntologyIndex } from './indexing/build-index';
import { createSearchEntitiesTool } from './tools/search-entities';
import { createGetEntityTool } from './tools/get-entity';
import { createResolveMentionTool } from './tools/resolve-mention';
import { createValidateAnnotationTool } from './tools/validate-annotation';

async function main(): Promise<void> {
  const index = await buildOntologyIndex({
    ontologyDir: 'content/ontology',
    localesDir: 'content/locales',
    searchOverlaysDir: 'content/search-overlays',
  });

  // Pseudocode. Wire to the official MCP TypeScript SDK here.
  const server = {
    registerTool: (name: string, _handler: unknown) => {
      console.log(`registered tool: ${name}`);
    },
    registerResource: (_uri: string, _handler: unknown) => undefined,
    registerPrompt: (_name: string, _handler: unknown) => undefined,
    start: async () => {
      console.log('ontology MCP server skeleton started');
    },
  };

  server.registerTool('search_entities', createSearchEntitiesTool(index));
  server.registerTool('get_entity', createGetEntityTool(index));
  server.registerTool('resolve_mention', createResolveMentionTool(index));
  server.registerTool('validate_annotation', createValidateAnnotationTool(index));

  await server.start();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
