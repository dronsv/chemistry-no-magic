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
import { listEntities } from './tools/write/list-entities.js';
import { coverageReport } from './tools/write/coverage-report.js';
import { addTranslation } from './tools/write/translation.js';
import { addRelation } from './tools/write/relation.js';
import { addSubstance, updateSubstance } from './tools/write/substance.js';
import { addConcept, updateConcept } from './tools/write/concept.js';
import { addCharacteristic, updateCharacteristic } from './tools/write/characteristic.js';
import { addIon, updateIon } from './tools/write/ion.js';
import { addProperty, updateProperty } from './tools/write/property.js';
import { addProcess, updateProcess } from './tools/write/process.js';
import { addEffect, updateEffect } from './tools/write/effect.js';
import { addReaction, updateReaction } from './tools/write/reaction.js';
import { addFormula, updateFormula } from './tools/write/formula.js';
import { addRuleTerm, updateRuleTerm } from './tools/write/rule-term.js';
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

  server.registerTool('list_entities', {
    description: 'List all ontology entities by kind with pagination. Returns lightweight summaries.',
    inputSchema: {
      kind: z.string().describe(
        'Entity kind to list: element, substance, ion, concept, substance_class, ' +
        'element_group, reaction_type, reaction_facet, domain_concept, formula, process, property, or "all"'
      ),
      limit: z.number().int().min(1).max(500).optional().describe('Max results (default 100)'),
      offset: z.number().int().min(0).optional().describe('Offset for pagination (default 0)'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(listEntities(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('coverage_report', {
    description: 'Audit ontology coverage: translation completeness, characteristics presence, relation gaps, and structural issues. Returns summary stats and gap list.',
    inputSchema: {
      kind: z.string().describe('Entity kind to audit, or "all"'),
      check: z.enum(['translations', 'characteristics', 'relations', 'all']).describe('What to check'),
      locales: z.array(z.string()).optional().describe('Locales to check (default: ru, en, pl, es)'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(coverageReport(indexRef.current, args), null, 2) }],
  }));

  server.registerTool('add_translation', {
    description: 'Add or update a translation overlay entry for any locale and data type. Merges top-level fields into existing entry (shallow merge).',
    inputSchema: {
      locale: z.enum(['ru', 'en', 'pl', 'es']).describe('Target locale'),
      data_key: z.string().describe('Overlay file name: substances, ions, concepts, elements, process_vocab, effects_vocab, etc.'),
      entity_id: z.string().describe('Key in the overlay file. Conventions: substances use short ID (hcl), ions use full ref (ion:H_plus), concepts use full ref (cls:oxide), elements use symbol (Na)'),
      fields: z.record(z.unknown()).describe('Translated fields to merge: name, description, surface_forms, forms, etc.'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addTranslation(indexRef, args), null, 2) }],
  }));

  server.registerTool('add_relation', {
    description: 'Append relation triples to a relation file. Deduplicates by subject+predicate+object. Warns on unknown refs.',
    inputSchema: {
      file: z.string().describe('Relation file name: acid_base_relations, ion_roles, has_naming_rule, or new name'),
      triples: z.array(z.object({
        subject: z.string().describe('Subject entity ref'),
        predicate: z.string().describe('Relation predicate'),
        object: z.string().describe('Object entity ref'),
        step: z.number().optional().describe('Step number for multi-step relations'),
        knowledge_level: z.enum(['strict_chemistry', 'school_convention', 'pedagogical']).optional(),
        source_kind: z.string().optional().describe('Provenance'),
        condition: z.string().optional().describe('Guard condition'),
      })).describe('Triples to add'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addRelation(indexRef, args), null, 2) }],
  }));

  server.registerTool('add_substance', {
    description: 'Create a new substance in data-src/substances/{id}.json. Fails if file already exists.',
    inputSchema: {
      id: z.string().describe('Short ID without prefix, e.g. "hcl" (stored as "sub:hcl")'),
      formula: z.string().describe('Chemical formula with Unicode subscripts/superscripts'),
      class: z.string().describe('Substance class, e.g. "acid", "salt", "oxide"'),
      subclass: z.string().optional().describe('Subclass, e.g. "strong_acid", "amphoteric"'),
      ions: z.array(z.string()).optional().describe('Ion refs, e.g. ["ion:H_plus", "ion:Cl_minus"]'),
      tags: z.array(z.string()).optional().describe('Free-form tags'),
      phase_standard: z.enum(['g', 'l', 's', 'aq']).optional().describe('Standard aggregate state'),
      characteristics: z.record(z.unknown()).optional().describe('Typed characteristics keyed by concept ref'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addSubstance(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('update_substance', {
    description: 'Update fields on an existing substance. Shallow-merges provided fields.',
    inputSchema: {
      id: z.string().describe('Short ID without prefix, e.g. "hcl"'),
      formula: z.string().optional(),
      class: z.string().optional(),
      subclass: z.string().optional(),
      ions: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      phase_standard: z.enum(['g', 'l', 's', 'aq']).optional(),
      characteristics: z.record(z.unknown()).optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateSubstance(indexRef, args), null, 2) }],
  }));

  server.registerTool('add_concept', {
    description: 'Add a new concept to concepts.json. Medium-risk: admission metadata recommended.',
    inputSchema: {
      ref: z.string().describe('Concept ref with prefix: cls:, concept:, prop:, rxtype:, rxfacet:'),
      kind: z.string().describe('substance_class, element_group, reaction_type, reaction_facet, domain_concept, process, property'),
      parent_id: z.string().nullable().optional().describe('Parent concept ref'),
      order: z.number().optional().describe('Display order'),
      filters: z.record(z.unknown()).optional(),
      examples: z.array(z.object({ kind: z.string(), id: z.string() })).optional(),
      children_order: z.array(z.string()).optional(),
      classification_facets: z.array(z.object({
        facet_ref: z.string(),
        children: z.array(z.string()),
      })).optional(),
      admission: z.object({
        reason: z.string(),
        nearest_existing_refs: z.array(z.string()).optional(),
        non_redundancy_note: z.string().optional(),
      }).optional().describe('Semantic guard: recommended to justify why this concept is needed'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addConcept(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('update_concept', {
    description: 'Update fields on an existing concept in concepts.json.',
    inputSchema: {
      ref: z.string().describe('Concept ref'),
      kind: z.string().optional(),
      parent_id: z.string().nullable().optional(),
      order: z.number().optional(),
      filters: z.record(z.unknown()).optional(),
      examples: z.array(z.object({ kind: z.string(), id: z.string() })).optional(),
      children_order: z.array(z.string()).optional(),
      classification_facets: z.array(z.object({
        facet_ref: z.string(),
        children: z.array(z.string()),
      })).optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateConcept(indexRef, args), null, 2) }],
  }));

  server.registerTool('add_characteristic', {
    description: 'Add a typed characteristic to a substance. Fails if the characteristic already exists on the substance.',
    inputSchema: {
      substance_id: z.string().describe('Substance short ID without prefix, e.g. "nacl"'),
      concept_ref: z.string().describe('Concept ref for the property, e.g. "concept:boiling_point"'),
      value: z.union([z.number(), z.string()]).describe('Characteristic value'),
      unit: z.string().describe('Unit ref, e.g. "unit:celsius", "unit:kJ_per_mol"'),
      conditions: z.record(z.unknown()).optional().describe('Measurement conditions'),
      source: z.string().optional().describe('Data source'),
      explanation: z.string().optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addCharacteristic(indexRef, args), null, 2) }],
  }));

  server.registerTool('update_characteristic', {
    description: 'Update an existing characteristic on a substance. Fails if characteristic not found.',
    inputSchema: {
      substance_id: z.string().describe('Substance short ID'),
      concept_ref: z.string().describe('Concept ref of the characteristic to update'),
      value: z.union([z.number(), z.string()]).describe('New value'),
      unit: z.string().describe('Unit ref'),
      conditions: z.record(z.unknown()).optional(),
      source: z.string().optional(),
      explanation: z.string().optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateCharacteristic(indexRef, args), null, 2) }],
  }));

  server.registerTool('add_ion', {
    description: 'Add a new ion to ions.json. Fails if id already exists.',
    inputSchema: {
      id: z.string().describe('Full ion ref, e.g. "ion:H_plus" (must start with "ion:")'),
      formula: z.string().describe('Chemical formula with Unicode superscripts, e.g. "H⁺"'),
      type: z.enum(['cation', 'anion']).describe('Ion type'),
      tags: z.array(z.string()).optional().describe('Free-form tags'),
      characteristics: z.record(z.unknown()).optional().describe('Typed characteristics keyed by concept ref'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addIon(indexRef, args), null, 2) }],
  }));

  server.registerTool('update_ion', {
    description: 'Update fields on an existing ion in ions.json. Shallow-merges provided fields.',
    inputSchema: {
      id: z.string().describe('Full ion ref, e.g. "ion:H_plus" (must start with "ion:")'),
      formula: z.string().optional(),
      type: z.enum(['cation', 'anion']).optional(),
      tags: z.array(z.string()).optional(),
      characteristics: z.record(z.unknown()).optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateIon(indexRef, args), null, 2) }],
  }));

  server.registerTool('add_property', {
    description: 'Add a new property definition to rules/properties.json. Fails if id already exists.',
    inputSchema: {
      id: z.string().describe('Property ID without prefix, e.g. "electronegativity" (ref becomes "prop:{id}")'),
      value_field: z.string().nullable().describe('Field name on the target object, or null'),
      object: z.enum(['element', 'substance', 'ion']).describe('What kind of entity this property applies to'),
      unit: z.string().nullable().describe('Unit string, e.g. "°C", "g/cm³", or null'),
      concept_ref: z.string().describe('Concept ref, e.g. "concept:electronegativity"'),
      trend_hint: z.object({
        period: z.string().nullable(),
        group: z.string().nullable(),
      }).optional().describe('Periodic trend hints'),
      filter: z.record(z.unknown()).nullable().optional().describe('Filter constraints'),
      i18n: z.record(z.record(z.string())).describe('Localized names: { ru: { nom: "...", gen: "..." }, en: { name: "..." }, ... }'),
      explanation_concept_ref: z.string().optional(),
      conditions_schema: z.array(z.string()).optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addProperty(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('update_property', {
    description: 'Update fields on an existing property in rules/properties.json.',
    inputSchema: {
      id: z.string().describe('Property ID without prefix'),
      value_field: z.string().nullable().optional(),
      object: z.enum(['element', 'substance', 'ion']).optional(),
      unit: z.string().nullable().optional(),
      concept_ref: z.string().optional(),
      trend_hint: z.object({
        period: z.string().nullable(),
        group: z.string().nullable(),
      }).optional(),
      filter: z.record(z.unknown()).nullable().optional(),
      i18n: z.record(z.record(z.string())).optional(),
      explanation_concept_ref: z.string().optional(),
      conditions_schema: z.array(z.string()).optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateProperty(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('add_process', {
    description: 'Add a new process to process_vocab.json. Fails if id already exists.',
    inputSchema: {
      id: z.string().describe('Process ID, e.g. "neutralization" (ref becomes "process:{id}")'),
      kind: z.enum(['chemical', 'physical', 'driving_force', 'operation', 'constraint']).describe('Process kind'),
      params: z.array(z.union([
        z.string(),
        z.object({
          key: z.string(),
          kind: z.string(),
          ref: z.string().optional(),
          unit: z.string().optional(),
        }),
      ])).optional().describe('Process parameters'),
      parent: z.string().optional().describe('Parent process ID'),
      effects: z.array(z.union([
        z.string(),
        z.object({
          id: z.string(),
          when: z.string(),
        }),
      ])).optional().describe('Effects (string IDs or conditional objects)'),
      concept_ref: z.string().optional().describe('Linked concept ref'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addProcess(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('update_process', {
    description: 'Update fields on an existing process in process_vocab.json.',
    inputSchema: {
      id: z.string().describe('Process ID'),
      kind: z.enum(['chemical', 'physical', 'driving_force', 'operation', 'constraint']).optional(),
      params: z.array(z.union([
        z.string(),
        z.object({
          key: z.string(),
          kind: z.string(),
          ref: z.string().optional(),
          unit: z.string().optional(),
        }),
      ])).optional(),
      parent: z.string().optional(),
      effects: z.array(z.union([
        z.string(),
        z.object({
          id: z.string(),
          when: z.string(),
        }),
      ])).optional(),
      concept_ref: z.string().optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateProcess(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('add_effect', {
    description: 'Add a new effect to effects_vocab.json. Fails if id already exists.',
    inputSchema: {
      id: z.string().describe('Effect ID, e.g. "speed_increase" (ref becomes "effect:{id}")'),
      category: z.enum(['kinetic', 'thermodynamic', 'mass_transfer', 'phase']).describe('Effect category'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addEffect(indexRef, args), null, 2) }],
  }));

  server.registerTool('update_effect', {
    description: 'Update an existing effect in effects_vocab.json.',
    inputSchema: {
      id: z.string().describe('Effect ID'),
      category: z.enum(['kinetic', 'thermodynamic', 'mass_transfer', 'phase']).optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateEffect(indexRef, args), null, 2) }],
  }));

  server.registerTool('add_reaction', {
    description: 'Add a new reaction to reactions.json. High-risk: complex nested schema.',
    inputSchema: {
      reaction_id: z.string().describe('Unique reaction ID, e.g. "rx_neutral_01_hcl_naoh"'),
      equation: z.string().describe('Full balanced equation string'),
      type_tags: z.array(z.string()).describe('Reaction type tags, e.g. ["exchange", "neutralization"]'),
      molecular: z.object({
        reactants: z.array(z.object({
          formula: z.string(),
          coeff: z.number(),
          phase: z.string().optional(),
        })).describe('Reactant formulas with coefficients'),
        products: z.array(z.object({
          formula: z.string(),
          coeff: z.number(),
          phase: z.string().optional(),
        })).describe('Product formulas with coefficients'),
      }).describe('Molecular equation block'),
      phase: z.object({
        medium: z.string().optional(),
        note_key: z.string().optional(),
      }).optional().describe('Phase/medium info'),
      conditions: z.record(z.unknown()).optional().describe('Reaction conditions'),
      driving_forces: z.array(z.string()).optional().describe('Driving force IDs'),
      ionic: z.object({
        full: z.string().optional(),
        net: z.string().optional(),
        spectators: z.array(z.string()).optional(),
      }).optional().describe('Ionic equation forms'),
      observations: z.record(z.unknown()).optional().describe('Observable effects'),
      rate_tips: z.record(z.unknown()).optional().describe('Rate/kinetics tips'),
      heat_effect: z.string().optional().describe('Heat effect label'),
      safety_notes: z.array(z.string()).optional().describe('Safety notes'),
      competencies: z.record(z.string()).optional().describe('Competency mappings'),
      template_id: z.string().optional().describe('Linked template ID'),
      schema_version: z.number().optional().describe('Schema version number'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addReaction(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('update_reaction', {
    description: 'Update fields on an existing reaction. Deep-merges provided fields.',
    inputSchema: {
      reaction_id: z.string().describe('Reaction ID to update'),
      equation: z.string().optional(),
      type_tags: z.array(z.string()).optional(),
      molecular: z.object({
        reactants: z.array(z.object({
          formula: z.string(),
          coeff: z.number(),
          phase: z.string().optional(),
        })),
        products: z.array(z.object({
          formula: z.string(),
          coeff: z.number(),
          phase: z.string().optional(),
        })),
      }).optional(),
      phase: z.object({
        medium: z.string().optional(),
        note_key: z.string().optional(),
      }).optional(),
      conditions: z.record(z.unknown()).optional(),
      driving_forces: z.array(z.string()).optional(),
      ionic: z.object({
        full: z.string().optional(),
        net: z.string().optional(),
        spectators: z.array(z.string()).optional(),
      }).optional(),
      observations: z.record(z.unknown()).optional(),
      rate_tips: z.record(z.unknown()).optional(),
      heat_effect: z.string().optional(),
      safety_notes: z.array(z.string()).optional(),
      competencies: z.record(z.string()).optional(),
      template_id: z.string().optional(),
      schema_version: z.number().optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateReaction(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('add_formula', {
    description: 'Add a new formula to foundations/formulas.json. High-risk: AST expression.',
    inputSchema: {
      id: z.string().describe('Formula ID with prefix, e.g. "formula:ideal_gas"'),
      kind: z.string().describe('Formula kind: "definition", "derived", etc.'),
      domain: z.string().describe('Domain, e.g. "stoichiometry", "thermodynamics"'),
      school_grade: z.array(z.number()).describe('School grade levels'),
      concept_refs: z.array(z.string()).optional().describe('Linked concept refs'),
      didactic_scope: z.string().optional().describe('Didactic scope'),
      variables: z.array(z.object({
        symbol: z.string(),
        display_symbol: z.string().optional(),
        quantity: z.string(),
        unit: z.string(),
        role: z.string(),
        binding: z.object({
          mode: z.string(),
          ref: z.string(),
        }).optional(),
        explanation_overrides: z.record(z.string()).optional(),
      })).describe('Formula variables'),
      expression: z.record(z.unknown()).describe('AST expression node — passed through as-is'),
      result_variable: z.string().describe('Result variable symbol'),
      invertible_for: z.array(z.string()).optional().describe('Variables this formula can be inverted for'),
      inversions: z.record(z.unknown()).optional().describe('Inversion AST nodes'),
      constants_used: z.array(z.string()).optional().describe('Constants referenced'),
      prerequisite_formulas: z.array(z.string()).optional().describe('Prerequisite formula IDs'),
      used_by_solvers: z.array(z.string()).optional().describe('Solver refs that use this formula'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addFormula(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('update_formula', {
    description: 'Update fields on an existing formula.',
    inputSchema: {
      id: z.string().describe('Formula ID with prefix, e.g. "formula:ideal_gas"'),
      kind: z.string().optional(),
      domain: z.string().optional(),
      school_grade: z.array(z.number()).optional(),
      concept_refs: z.array(z.string()).optional(),
      didactic_scope: z.string().optional(),
      variables: z.array(z.object({
        symbol: z.string(),
        display_symbol: z.string().optional(),
        quantity: z.string(),
        unit: z.string(),
        role: z.string(),
        binding: z.object({
          mode: z.string(),
          ref: z.string(),
        }).optional(),
        explanation_overrides: z.record(z.string()).optional(),
      })).optional(),
      expression: z.record(z.unknown()).optional(),
      result_variable: z.string().optional(),
      invertible_for: z.array(z.string()).optional(),
      inversions: z.record(z.unknown()).optional(),
      constants_used: z.array(z.string()).optional(),
      prerequisite_formulas: z.array(z.string()).optional(),
      used_by_solvers: z.array(z.string()).optional(),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateFormula(indexRef, args as any), null, 2) }],
  }));

  server.registerTool('add_rule_term', {
    description: 'Add a namespaced rule term to vocab/rule_terms.json.',
    inputSchema: {
      term: z.string().describe('Namespaced term string, e.g. "condition:cooling"'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await addRuleTerm(indexRef, args), null, 2) }],
  }));

  server.registerTool('update_rule_term', {
    description: 'Replace an existing rule term string.',
    inputSchema: {
      old_term: z.string().describe('Existing term to replace'),
      new_term: z.string().describe('New term value'),
    },
  }, async (args) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(await updateRuleTerm(indexRef, args), null, 2) }],
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
