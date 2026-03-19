import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { buildOntologyIndex } from '../indexing/build-index.js';
import { bootstrapDocument } from '../tools/bootstrap-document.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: bootstrap-cli <file-or-text> [--lang ru] [--mode didactic] [--out-dir content/review-queue]');
    process.exit(1);
  }

  const inputPath = args[0];
  const langIdx = args.indexOf('--lang');
  const lang = langIdx !== -1 && args[langIdx + 1] ? args[langIdx + 1] : 'ru';
  const modeIdx = args.indexOf('--mode');
  const mode = modeIdx !== -1 && args[modeIdx + 1] ? args[modeIdx + 1] : 'didactic';
  const outIdx = args.indexOf('--out-dir');
  const outDir = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : 'content/review-queue';

  console.error('[bootstrap] Building ontology index...');
  const index = await buildOntologyIndex();

  let text: string;
  let docId: string;
  try {
    text = await readFile(inputPath, 'utf-8');
    docId = basename(inputPath).replace(/\.\w+$/, '');
  } catch {
    // Treat as inline text
    text = inputPath;
    docId = `inline-${Date.now()}`;
  }

  console.error(`[bootstrap] Processing document: ${docId} (${text.length} chars, lang=${lang}, mode=${mode})`);
  const result = bootstrapDocument(index, {
    doc_id: docId,
    material_language: lang,
    text,
    mode,
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, `${docId}-annotation.json`),
    JSON.stringify(result.annotation_result, null, 2)
  );
  if (result.proposals.length > 0) {
    await writeFile(
      join(outDir, `${docId}-proposals.json`),
      JSON.stringify(result.proposals, null, 2)
    );
  }
  await writeFile(
    join(outDir, `${docId}-coverage.json`),
    JSON.stringify(result.coverage, null, 2)
  );

  console.log(JSON.stringify(result.coverage, null, 2));
  console.error(`[bootstrap] Results written to ${outDir}/`);
}

main().catch((err: unknown) => {
  console.error('[bootstrap] Fatal:', err);
  process.exit(1);
});
