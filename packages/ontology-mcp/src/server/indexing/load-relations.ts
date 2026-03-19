import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Relation, RelationsIndex } from '../../shared/types.js';
import { findDataSrc } from './find-data-src.js';

export async function loadRelations(): Promise<RelationsIndex> {
  const dataSrc = await findDataSrc();
  const bySubject = new Map<string, Relation[]>();
  const byObject = new Map<string, Relation[]>();
  const byPredicate = new Map<string, Relation[]>();

  function addRelation(rel: Relation): void {
    const subList = bySubject.get(rel.subject) ?? [];
    subList.push(rel);
    bySubject.set(rel.subject, subList);

    const objList = byObject.get(rel.object) ?? [];
    objList.push(rel);
    byObject.set(rel.object, objList);

    const predList = byPredicate.get(rel.predicate) ?? [];
    predList.push(rel);
    byPredicate.set(rel.predicate, predList);
  }

  // 1. Load explicit relation files from data-src/relations/
  const relDir = join(dataSrc, 'relations');
  try {
    const files = (await readdir(relDir)).filter(
      f => f.endsWith('.json') && f !== 'relation_schema.json'
    );
    for (const f of files) {
      try {
        const raw = JSON.parse(await readFile(join(relDir, f), 'utf-8'));
        const triples: Relation[] = Array.isArray(raw) ? raw : (raw.triples ?? raw.relations ?? []);
        let count = 0;
        for (const t of triples) {
          if (t.subject && t.predicate && t.object) {
            addRelation(t);
            count++;
          }
        }
        process.stderr.write(`[ontology-mcp] Loaded ${count} relations from ${f}\n`);
      } catch { /* skip bad files */ }
    }
  } catch {
    process.stderr.write('[ontology-mcp] WARNING: no relations/ directory found\n');
  }

  // 2. Extract concept hierarchy from concepts.json (parent_id → has_parent relation)
  try {
    const concepts = JSON.parse(
      await readFile(join(dataSrc, 'concepts.json'), 'utf-8')
    ) as Record<string, { parent_id?: string | null }>;
    for (const [ref, entry] of Object.entries(concepts)) {
      if (entry.parent_id) {
        addRelation({ subject: ref, predicate: 'has_parent', object: entry.parent_id });
      }
    }
  } catch { /* optional */ }

  // 3. Extract substance → class relations from substance files
  try {
    const subDir = join(dataSrc, 'substances');
    const subFiles = (await readdir(subDir)).filter(f => f.endsWith('.json'));
    for (const f of subFiles) {
      try {
        const sub = JSON.parse(await readFile(join(subDir, f), 'utf-8')) as {
          id?: string; class?: string; subclass?: string;
        };
        if (!sub.id) continue;
        if (sub.class) {
          addRelation({ subject: sub.id, predicate: 'instance_of', object: `cls:${sub.class}` });
        }
        if (sub.subclass) {
          addRelation({ subject: sub.id, predicate: 'instance_of', object: `cls:${sub.subclass}` });
        }
      } catch { /* skip */ }
    }
  } catch { /* optional */ }

  const totalRelations = [...byPredicate.values()].reduce((sum, arr) => sum + arr.length, 0);
  process.stderr.write(
    `[ontology-mcp] Relations index: ${totalRelations} triples, ` +
    `${bySubject.size} subjects, ${byPredicate.size} predicates\n`
  );

  return { bySubject, byObject, byPredicate };
}
