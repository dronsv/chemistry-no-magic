import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { OntologyEntity, OntologyIndex, OntRefKind } from '../../shared/types.js';
import { findDataSrc } from './find-data-src.js';
import { loadRelations } from './load-relations.js';

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveKind(ref: string): OntRefKind {
  const prefix = ref.split(':')[0];
  const map: Record<string, OntRefKind> = {
    el: 'element',
    sub: 'substance',
    ion: 'ion',
    concept: 'domain_concept',
    cls: 'substance_class',
    rxtype: 'reaction_type',
    rxfacet: 'reaction_facet',
    formula: 'formula',
    proc: 'process',
    prop: 'property',
  };
  return map[prefix] ?? 'concept';
}

export async function buildOntologyIndex(): Promise<OntologyIndex> {
  const DATA_SRC = await findDataSrc();

  const entitiesByRef = new Map<string, OntologyEntity>();
  const aliasIndex = new Map<string, string[]>();
  const formulaIndex = new Map<string, string>();
  const symbolIndex = new Map<string, string>();

  function addAlias(text: string, ref: string): void {
    const key = normalize(text);
    if (!key) return;
    const existing = aliasIndex.get(key);
    if (existing) {
      if (!existing.includes(ref)) existing.push(ref);
    } else {
      aliasIndex.set(key, [ref]);
    }
  }

  // 1. Load concepts.json (object keyed by ref)
  // Each entry has a 'kind' field that is more precise than the ref prefix,
  // e.g. kind: 'property' on a 'concept:pKa' ref, or kind: 'element_group' on 'concept:alkali_metals'
  try {
    const conceptsRaw = JSON.parse(await readFile(join(DATA_SRC, 'concepts.json'), 'utf-8')) as Record<
      string,
      { kind?: string; parent_id?: string | null }
    >;
    for (const [ref, entry] of Object.entries(conceptsRaw)) {
      // Prefer the data's own 'kind' field; fall back to inferring from ref prefix
      const dataKind = entry.kind as OntRefKind | undefined;
      const kind: OntRefKind = dataKind ?? resolveKind(ref);
      entitiesByRef.set(ref, {
        ref,
        kind,
        labels: {},
        aliases: {},
        description: {},
        parent_ref: entry.parent_id ?? undefined,
      });
    }
    process.stderr.write(`[ontology-mcp] Loaded ${Object.keys(conceptsRaw).length} concepts\n`);
  } catch (err) {
    process.stderr.write(`[ontology-mcp] WARNING: could not load concepts.json: ${err}\n`);
  }

  // 2. Load elements.json (array)
  try {
    const elements = JSON.parse(await readFile(join(DATA_SRC, 'elements.json'), 'utf-8')) as Array<{
      symbol: string;
      name_latin: string;
      Z?: number;
    }>;
    for (const el of elements) {
      const ref = `el:${el.symbol}`;
      entitiesByRef.set(ref, {
        ref,
        kind: 'element',
        labels: { en: el.name_latin },
        aliases: {},
        formula: el.symbol,
        symbol: el.symbol,
      });
      symbolIndex.set(el.symbol, ref);
      symbolIndex.set(el.symbol.toLowerCase(), ref);
      addAlias(el.symbol, ref);
      if (el.name_latin) addAlias(el.name_latin, ref);
    }
    process.stderr.write(`[ontology-mcp] Loaded ${elements.length} elements\n`);
  } catch (err) {
    process.stderr.write(`[ontology-mcp] WARNING: could not load elements.json: ${err}\n`);
  }

  // 3. Load ions.json (array)
  try {
    const ions = JSON.parse(await readFile(join(DATA_SRC, 'ions.json'), 'utf-8')) as Array<{
      id: string;
      formula: string;
      type: string;
      tags?: string[];
    }>;
    for (const ion of ions) {
      entitiesByRef.set(ion.id, {
        ref: ion.id,
        kind: 'ion',
        labels: {},
        aliases: {},
        formula: ion.formula,
        tags: ion.tags,
      });
      formulaIndex.set(ion.formula, ion.id);
      addAlias(ion.formula, ion.id);
      // Also add the bare ID part as alias (e.g. "H_plus" for "ion:H_plus")
      addAlias(ion.id.replace('ion:', ''), ion.id);
    }
    process.stderr.write(`[ontology-mcp] Loaded ${ions.length} ions\n`);
  } catch (err) {
    process.stderr.write(`[ontology-mcp] WARNING: could not load ions.json: ${err}\n`);
  }

  // 4. Load substances from data-src/substances/ directory
  try {
    const subDir = join(DATA_SRC, 'substances');
    const subFiles = (await readdir(subDir)).filter(
      (f) => f.endsWith('.json') && f !== 'substance_properties.json'
    );
    let subCount = 0;
    for (const f of subFiles) {
      try {
        const sub = JSON.parse(await readFile(join(subDir, f), 'utf-8')) as {
          id?: string;
          formula?: string;
          class?: string;
          subclass?: string;
          tags?: string[];
        };
        if (!sub.id) continue;
        entitiesByRef.set(sub.id, {
          ref: sub.id,
          kind: 'substance',
          labels: {},
          aliases: {},
          formula: sub.formula,
          tags: sub.tags,
        });
        if (sub.formula) {
          formulaIndex.set(sub.formula, sub.id);
          addAlias(sub.formula, sub.id);
        }
        // Add substance id without prefix as alias
        addAlias(sub.id.replace('sub:', ''), sub.id);
        subCount++;
      } catch {
        // skip bad files
      }
    }
    process.stderr.write(`[ontology-mcp] Loaded ${subCount} substances\n`);
  } catch (err) {
    process.stderr.write(`[ontology-mcp] WARNING: could not load substances/: ${err}\n`);
  }

  // 5. Load foundations/formulas.json (array of formula definitions)
  try {
    const formulas = JSON.parse(
      await readFile(join(DATA_SRC, 'foundations', 'formulas.json'), 'utf-8')
    ) as Array<{ id: string; concept_refs?: string[] }>;
    for (const fm of formulas) {
      entitiesByRef.set(fm.id, {
        ref: fm.id,
        kind: 'formula',
        labels: {},
        aliases: {},
        related_refs: fm.concept_refs,
      });
      // Add shortname alias: "formula:molar_mass_from_composition" → "molar_mass_from_composition"
      addAlias(fm.id.replace('formula:', ''), fm.id);
    }
    process.stderr.write(`[ontology-mcp] Loaded ${formulas.length} formulas\n`);
  } catch {
    // foundations/formulas.json is optional
  }

  // 6. Load locale translation overlays and merge into entities
  const LOCALES = ['ru', 'en', 'pl', 'es'];
  for (const locale of LOCALES) {
    // Concept overlays
    try {
      const overlay = JSON.parse(
        await readFile(join(DATA_SRC, 'translations', locale, 'concepts.json'), 'utf-8')
      ) as Record<string, { name?: string; description?: string; surface_forms?: string[] }>;
      let merged = 0;
      for (const [ref, ov] of Object.entries(overlay)) {
        const entity = entitiesByRef.get(ref);
        if (!entity) continue;
        if (ov.name) {
          entity.labels[locale] = ov.name;
          addAlias(ov.name, ref);
        }
        if (ov.description) {
          if (!entity.description) entity.description = {};
          entity.description[locale] = ov.description;
        }
        if (ov.surface_forms) {
          if (!entity.aliases[locale]) entity.aliases[locale] = [];
          entity.aliases[locale].push(...ov.surface_forms);
          for (const sf of ov.surface_forms) addAlias(sf, ref);
        }
        merged++;
      }
      process.stderr.write(`[ontology-mcp] Merged ${merged} concept overlays for locale=${locale}\n`);
    } catch {
      // locale overlay optional
    }

    // Element overlays (keyed by symbol, not ref)
    try {
      const elOverlay = JSON.parse(
        await readFile(join(DATA_SRC, 'translations', locale, 'elements.json'), 'utf-8')
      ) as Record<string, { name?: string }>;
      let merged = 0;
      for (const [symbol, ov] of Object.entries(elOverlay)) {
        const ref = `el:${symbol}`;
        const entity = entitiesByRef.get(ref);
        if (!entity) continue;
        if (ov.name) {
          entity.labels[locale] = ov.name;
          addAlias(ov.name, ref);
        }
        merged++;
      }
      process.stderr.write(`[ontology-mcp] Merged ${merged} element overlays for locale=${locale}\n`);
    } catch {
      // optional
    }

    // Ion overlays (if present)
    // Ion overlay keys use the full ref format: "ion:H_plus" etc.
    try {
      const ionOverlay = JSON.parse(
        await readFile(join(DATA_SRC, 'translations', locale, 'ions.json'), 'utf-8')
      ) as Record<string, { name?: string; surface_forms?: string[] }>;
      let ionMerged = 0;
      for (const [ref, ov] of Object.entries(ionOverlay)) {
        const entity = entitiesByRef.get(ref);
        if (!entity) continue;
        if (ov.name) {
          entity.labels[locale] = ov.name;
          addAlias(ov.name, ref);
        }
        if (ov.surface_forms) {
          if (!entity.aliases[locale]) entity.aliases[locale] = [];
          entity.aliases[locale].push(...ov.surface_forms);
          for (const sf of ov.surface_forms) addAlias(sf, ref);
        }
        ionMerged++;
      }
      process.stderr.write(`[ontology-mcp] Merged ${ionMerged} ion overlays for locale=${locale}\n`);
    } catch {
      // optional
    }

    // Substance overlays (if present)
    // NOTE: overlay keys are short IDs (e.g. "hcl") but entity refs use "sub:" prefix ("sub:hcl")
    try {
      const subOverlay = JSON.parse(
        await readFile(join(DATA_SRC, 'translations', locale, 'substances.json'), 'utf-8')
      ) as Record<string, { name?: string; surface_forms?: string[] }>;
      let subMerged = 0;
      for (const [shortKey, ov] of Object.entries(subOverlay)) {
        const ref = `sub:${shortKey}`;
        const entity = entitiesByRef.get(ref);
        if (!entity) continue;
        if (ov.name) {
          entity.labels[locale] = ov.name;
          addAlias(ov.name, ref);
        }
        if (ov.surface_forms) {
          if (!entity.aliases[locale]) entity.aliases[locale] = [];
          entity.aliases[locale].push(...ov.surface_forms);
          for (const sf of ov.surface_forms) addAlias(sf, ref);
        }
        subMerged++;
      }
      process.stderr.write(`[ontology-mcp] Merged ${subMerged} substance overlays for locale=${locale}\n`);
    } catch {
      // optional
    }
  }

  // Load relations
  const relations = await loadRelations();

  process.stderr.write(
    `[ontology-mcp] Index built: ${entitiesByRef.size} entities, ${aliasIndex.size} aliases, ` +
    `${formulaIndex.size} formulas, ${symbolIndex.size} symbols\n`
  );

  return { entitiesByRef, aliasIndex, formulaIndex, symbolIndex, relations };
}
