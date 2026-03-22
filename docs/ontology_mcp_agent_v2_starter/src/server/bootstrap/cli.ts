/**
 * Bootstrap CLI skeleton.
 *
 * Example intended usage:
 * node dist/server/bootstrap/cli.js --input ./content/didactic/page1.txt --lang ru --doc-id page1
 */
import fs from 'node:fs/promises';
import { buildOntologyIndex } from '../indexing/build-index';
import { bootstrapDocument } from './bootstrap-document';

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const input = getArg('--input');
  const lang = getArg('--lang') ?? 'ru';
  const docId = getArg('--doc-id') ?? 'doc';

  if (!input) {
    throw new Error('Missing --input');
  }

  const text = await fs.readFile(input, 'utf8');
  const index = await buildOntologyIndex({
    ontologyDir: 'content/ontology',
    localesDir: 'content/locales',
    searchOverlaysDir: 'content/search-overlays',
  });

  const result = await bootstrapDocument({
    docId,
    materialLanguage: lang,
    text,
    index,
  });

  process.stdout.write(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
