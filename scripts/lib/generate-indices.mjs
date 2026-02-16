import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generate index files from substances data.
 * @param {Array<{filename: string, data: any}>} substances
 * @param {any[]} taskTemplates
 * @param {string} outDir - Output directory for indices
 */
export async function generateIndices(substances, taskTemplates, outDir) {
  const indicesDir = join(outDir, 'indices');
  await mkdir(indicesDir, { recursive: true });
  await mkdir(join(indicesDir, 'by_class'), { recursive: true });
  await mkdir(join(indicesDir, 'by_ion'), { recursive: true });
  await mkdir(join(indicesDir, 'by_competency'), { recursive: true });

  // Substances index
  const substancesIndex = {
    substances: substances.map(s => ({
      id: s.data.id,
      formula: s.data.formula,
      name_ru: s.data.name_ru,
      class: s.data.class,
      subclass: s.data.subclass,
    })),
  };
  await writeFile(
    join(indicesDir, 'substances_index.json'),
    JSON.stringify(substancesIndex, null, 2),
  );

  // By class
  const byClass = {};
  for (const s of substances) {
    const cls = s.data.class;
    if (!byClass[cls]) byClass[cls] = [];
    byClass[cls].push({
      id: s.data.id,
      formula: s.data.formula,
      name_ru: s.data.name_ru,
    });
  }
  for (const [cls, items] of Object.entries(byClass)) {
    await writeFile(
      join(indicesDir, 'by_class', `${cls}.json`),
      JSON.stringify({ class: cls, substances: items }, null, 2),
    );
  }

  // By ion
  const byIon = {};
  for (const s of substances) {
    if (s.data.ions && Array.isArray(s.data.ions)) {
      for (const ionId of s.data.ions) {
        if (!byIon[ionId]) byIon[ionId] = [];
        byIon[ionId].push({
          id: s.data.id,
          formula: s.data.formula,
          name_ru: s.data.name_ru,
        });
      }
    }
  }
  for (const [ionId, items] of Object.entries(byIon)) {
    await writeFile(
      join(indicesDir, 'by_ion', `${ionId}.json`),
      JSON.stringify({ ion_id: ionId, substances: items }, null, 2),
    );
  }

  // By competency (from task templates)
  const byCompetency = {};
  for (const t of taskTemplates) {
    if (t.competencies) {
      for (const [compId, coverage] of Object.entries(t.competencies)) {
        if (!byCompetency[compId]) byCompetency[compId] = [];
        byCompetency[compId].push({
          task_id: t.id,
          type_number: t.type_number,
          name_ru: t.name_ru,
          coverage,
        });
      }
    }
  }
  for (const [compId, tasks] of Object.entries(byCompetency)) {
    await writeFile(
      join(indicesDir, 'by_competency', `${compId}.json`),
      JSON.stringify({ competency_id: compId, tasks }, null, 2),
    );
  }

  return {
    classes: Object.keys(byClass),
    ions: Object.keys(byIon),
    competencies: Object.keys(byCompetency),
  };
}
