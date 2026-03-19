import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OntologyIndex, OntRefKind } from '../../shared/types.js';

const ONT_REF_KINDS: OntRefKind[] = [
  'element', 'substance', 'ion', 'substance_class', 'element_group',
  'reaction_type', 'reaction_facet', 'domain_concept', 'process',
  'property', 'formula', 'concept',
];

const ADMISSION_POLICY = {
  admission_order: [
    'existing_ref_match',
    'alias_or_search_overlay',
    'localization_overlay',
    'relation',
    'entity_extension',
    'new_core_entity',
  ],
  auto_merge: ['alias_addition', 'overlay_addition'],
  human_review_required: ['new_core_entity', 'relation_addition', 'entity_extension'],
  negative_criteria: [
    'localized_label_only',
    'author_phrase',
    'pedagogical_paraphrase',
    'typo_or_colloquial',
    'one_off_example',
    'synonym_of_existing',
    'composite_phrase',
  ],
};

const LOOKUP_CONFIGS: Record<string, { material_language: string; fallback: string[] }> = {
  ru: { material_language: 'ru', fallback: ['en'] },
  en: { material_language: 'en', fallback: [] },
  pl: { material_language: 'pl', fallback: ['en'] },
  es: { material_language: 'es', fallback: ['en'] },
};

const FEWSHOT_AUTHORING = `Example: binding "кислота" in didactic text
Input:  "Кислота диссоциирует в воде на ионы."
Step 1: resolve_mention("кислота", lang="ru") → cls:acid (score 0.98)
Step 2: resolve_mention("воде", lang="ru") → sub:h2o (score 0.95)
Step 3: resolve_mention("ионы", lang="ru") → concept:ion (score 0.90)
Result: 3 annotations, 0 unresolved

Anti-pattern: Do NOT create concept:acid_in_water — "кислота в воде" is a phrase, not a concept.
Anti-pattern: Do NOT create concept:ion_formation — use existing concept:dissociation + relation.`;

const FEWSHOT_REVIEW = `Review checklist:
1. Does annotation bind to existing canonical ref where possible?
2. Is any new proposal actually just an alias or overlay?
3. Is there language leakage into core?
4. Are concept/substance/ion/reaction kinds used correctly?
5. Are ambiguous mentions flagged instead of guessed?
6. Does proposal include enough evidence?
7. Can candidate be represented by relations/extensions instead?`;

export function registerResources(server: McpServer, index: OntologyIndex): void {
  server.registerResource('schema-kinds', 'ontology://schema/kinds', {
    description: 'All recognized OntRefKind values',
    mimeType: 'application/json',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({ kinds: ONT_REF_KINDS }, null, 2),
    }],
  }));

  server.registerResource('schema-relations', 'ontology://schema/relations', {
    description: 'All relation predicates in the ontology graph',
    mimeType: 'application/json',
  }, async (uri) => {
    const predicates = [...index.relations.byPredicate.keys()].sort();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify({ predicates, count: predicates.length }, null, 2),
      }],
    };
  });

  server.registerResource('policy-admission', 'ontology://policy/admission', {
    description: 'Admission policy for new ontology additions',
    mimeType: 'application/json',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify(ADMISSION_POLICY, null, 2),
    }],
  }));

  server.registerResource('fewshot-authoring', 'ontology://fewshot/authoring', {
    description: 'Few-shot examples for ontology-bound authoring',
    mimeType: 'text/plain',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      text: FEWSHOT_AUTHORING,
    }],
  }));

  server.registerResource('fewshot-review', 'ontology://fewshot/review', {
    description: 'Review checklist for ontology annotation',
    mimeType: 'text/plain',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      text: FEWSHOT_REVIEW,
    }],
  }));

  server.registerResource(
    'entity-by-ref',
    new ResourceTemplate('ontology://entity/{ref}', { list: undefined }),
    { description: 'Full entity card by ontology ref', mimeType: 'application/json' },
    async (uri, { ref }) => {
      const refStr = ref as string;
      const entity = index.entitiesByRef.get(refStr);
      return {
        contents: [{
          uri: uri.href,
          text: entity
            ? JSON.stringify(entity, null, 2)
            : JSON.stringify({ error: 'not found', ref: refStr }),
        }],
      };
    }
  );

  server.registerResource(
    'lookup-policy',
    new ResourceTemplate('ontology://policy/lookup/{language}', { list: undefined }),
    { description: 'Lookup policy for a given locale', mimeType: 'application/json' },
    async (uri, { language }) => {
      const lang = language as string;
      const config = LOOKUP_CONFIGS[lang] ?? LOOKUP_CONFIGS['en'];
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(config, null, 2),
        }],
      };
    }
  );
}
