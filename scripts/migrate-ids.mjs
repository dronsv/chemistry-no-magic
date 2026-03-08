import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_SRC = join(ROOT, 'data-src');

function prefixIonId(bare) {
  if (!bare || bare.startsWith('ion:')) return bare;
  return `ion:${bare}`;
}

async function migrateIons() {
  const path = join(DATA_SRC, 'ions.json');
  const ions = JSON.parse(await readFile(path, 'utf8'));
  let count = 0;
  for (const ion of ions) {
    if (ion.id && !ion.id.startsWith('ion:')) {
      ion.id = `ion:${ion.id}`;
      count++;
    }
  }
  await writeFile(path, JSON.stringify(ions, null, 2) + '\n');
  console.log(`ions.json: ${count} IDs prefixed`);
}

async function migrateSubstances() {
  const dir = join(DATA_SRC, 'substances');
  const files = (await readdir(dir)).filter(f => f.endsWith('.json'));
  let idCount = 0;
  let ionRefCount = 0;
  for (const file of files) {
    const path = join(dir, file);
    const sub = JSON.parse(await readFile(path, 'utf8'));
    let changed = false;
    if (sub.id && !sub.id.startsWith('sub:')) {
      sub.id = `sub:${sub.id}`;
      idCount++;
      changed = true;
    }
    if (Array.isArray(sub.ions)) {
      let changedIons = 0;
      sub.ions = sub.ions.map(id => {
        const next = prefixIonId(id);
        if (next !== id) changedIons++;
        return next;
      });
      if (changedIons > 0) {
        ionRefCount += changedIons;
        changed = true;
      }
    }
    if (changed) {
      await writeFile(path, JSON.stringify(sub, null, 2) + '\n');
    }
  }
  console.log(`substances/: ${idCount} IDs prefixed, ${ionRefCount} ion refs prefixed`);
}

async function migrateSolubility(filename) {
  const path = join(DATA_SRC, 'rules', filename);
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    console.log(`${filename}: not found, skipping`);
    return;
  }
  const data = JSON.parse(text);

  if (Array.isArray(data.cation_order)) {
    data.cation_order = data.cation_order.map(prefixIonId);
  }
  if (Array.isArray(data.anion_order)) {
    data.anion_order = data.anion_order.map(prefixIonId);
  }
  if (Array.isArray(data.pairs)) {
    for (const pair of data.pairs) {
      if (pair.cation) pair.cation = prefixIonId(pair.cation);
      if (pair.anion) pair.anion = prefixIonId(pair.anion);
    }
  }

  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`${filename}: migrated`);
}

async function main() {
  console.log('Phase C — ADR-002 ID Migration');
  await migrateIons();
  await migrateSubstances();
  await migrateSolubility('solubility_rules_full.json');
  await migrateSolubility('solubility_rules_light.json');
  console.log('Done. Run: npm run validate:data');
}

main().catch(err => { console.error(err); process.exit(1); });
