/**
 * Generate PredicateDef entries from ontology sources.
 *
 * Produces predicate defs from:
 *   - properties.json  → one predicate per property entry
 *   - formulas.json    → one predicate per unique quantity variable
 *   - concepts.json    → one predicate per unique concept kind
 * Plus hardcoded constructor predicates.
 *
 * Exported functions:
 *   predicatesFromProperties(properties)           → PredicateDef[]
 *   predicatesFromFormulas(formulas)               → PredicateDef[]
 *   predicatesFromConcepts(concepts)               → PredicateDef[]
 *   constructorPredicates()                        → PredicateDef[]
 *   mergePredicates(generated, overrides)          → PredicateDef[]
 *   buildPredicateIndex(predicates)                → Record<string, PredicateDef[]>
 *   generatePredicateRegistry(props, formulas, concepts, overrides, outDir)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Object → ArgDef type mapping ──────────────────────────────────────────────

/** @param {string} objectKind */
function objectToArgType(objectKind) {
  switch (objectKind) {
    case 'element':
      return 'ElementRef';
    case 'substance':
      return 'SubstanceRef';
    case 'ion':
      return 'IonRef';
    case 'reaction':
      return 'ReactionRef';
    default:
      return 'EntityRef';
  }
}

/** @param {string} objectKind */
function objectToNamespace(objectKind) {
  // namespace mirrors the object kind directly
  return objectKind;
}

// ── Quantity ref → predicate id ───────────────────────────────────────────────

/**
 * Convert "q:mass" → "quantity.mass".
 * @param {string} qRef
 * @returns {string}
 */
function quantityToPredicate(qRef) {
  if (!qRef || !qRef.startsWith('q:')) return qRef ?? '';
  return `quantity.${qRef.slice(2)}`;
}

// ── predicatesFromProperties ──────────────────────────────────────────────────

/**
 * Generate one PredicateDef per property entry.
 *
 * Mapping:
 *   property.id + property.object → predicate id "{object}.{property.id}"
 *   property.object → namespace, positional_arg type
 *
 * @param {Array<{id: string, object: string, unit: string|null, concept_ref?: string}>} properties
 * @returns {Array<object>}
 */
export function predicatesFromProperties(properties) {
  const results = [];

  for (const prop of properties) {
    if (!prop.id || !prop.object) continue;

    const namespace = objectToNamespace(prop.object);
    const predicateId = `${namespace}.${prop.id}`;
    const argType = objectToArgType(prop.object);

    /** @type {object} */
    const predicate = {
      id: predicateId,
      namespace,
      role: 'goal',
      returns: prop.unit ? `scalar:${prop.unit}` : 'scalar',
      positional_args: [
        {
          name: prop.object,
          type: argType,
        },
      ],
      named_args: [],
      temporal_kind: 'static',
      aliases: {},
      search_tokens: {},
      source: {
        kind: 'property',
        property_id: prop.id,
      },
    };

    results.push(predicate);
  }

  return results;
}

// ── predicatesFromFormulas ────────────────────────────────────────────────────

/**
 * Generate one PredicateDef per unique quantity reference across all formula
 * variables. Roles 'index' and 'constant' are skipped (no standalone predicate).
 *
 * Deduplication: first occurrence by quantity ref wins.
 *
 * @param {Array<{variables?: Array<{symbol: string, quantity: string, role: string, unit?: string}>}>} formulas
 * @returns {Array<object>}
 */
export function predicatesFromFormulas(formulas) {
  /** @type {Map<string, object>} quantity ref → predicate def */
  const seen = new Map();

  for (const formula of formulas) {
    const variables = formula.variables ?? [];

    for (const variable of variables) {
      const { quantity, role, unit } = variable;

      if (!quantity || !quantity.startsWith('q:')) continue;
      if (role === 'index' || role === 'constant') continue;
      if (seen.has(quantity)) continue;

      const predicateId = quantityToPredicate(quantity);

      /** @type {object} */
      const predicate = {
        id: predicateId,
        namespace: 'quantity',
        role: 'goal',
        returns: unit ? `scalar:${unit}` : 'scalar',
        positional_args: [
          {
            name: 'entity',
            type: 'EntityRef',
          },
        ],
        named_args: [],
        temporal_kind: 'static',
        aliases: {},
        search_tokens: {},
        source: {
          kind: 'formula_variable',
          formula_id: formula.id,
          variable: variable.symbol,
        },
      };

      seen.set(quantity, predicate);
    }
  }

  return Array.from(seen.values());
}

// ── predicatesFromConcepts ────────────────────────────────────────────────────

/**
 * Concept kind → predicate config.
 * One predicate per unique concept kind.
 *
 * @type {Record<string, {id: string, namespace: string, returns: string, argType: string, temporal_kind: string}>}
 */
const CONCEPT_KIND_MAP = {
  substance_class: {
    id: 'substance.class',
    namespace: 'substance',
    returns: 'categorical:substance_class',
    argType: 'SubstanceRef',
    temporal_kind: 'static',
  },
  reaction_type: {
    id: 'reaction.type',
    namespace: 'reaction',
    returns: 'categorical:reaction_type',
    argType: 'ReactionRef',
    temporal_kind: 'static',
  },
  reaction_facet: {
    id: 'reaction.observation',
    namespace: 'reaction',
    returns: 'categorical:observation',
    argType: 'ReactionRef',
    temporal_kind: 'observable',
  },
};

/**
 * Generate one PredicateDef per unique concept kind found in concepts data.
 * Only kinds listed in CONCEPT_KIND_MAP produce predicates.
 *
 * @param {Record<string, {kind: string}>} concepts  - keyed by concept id
 * @returns {Array<object>}
 */
export function predicatesFromConcepts(concepts) {
  const emittedKinds = new Set();
  const results = [];

  for (const entry of Object.values(concepts)) {
    const { kind } = entry;
    if (!kind || emittedKinds.has(kind)) continue;

    const config = CONCEPT_KIND_MAP[kind];
    if (!config) continue;

    emittedKinds.add(kind);

    /** @type {object} */
    const predicate = {
      id: config.id,
      namespace: config.namespace,
      role: 'goal',
      returns: config.returns,
      positional_args: [
        {
          name: config.namespace === 'reaction' ? 'reaction' : 'substance',
          type: config.argType,
        },
      ],
      named_args: [],
      temporal_kind: config.temporal_kind,
      aliases: {},
      search_tokens: {},
      source: {
        kind: 'concept',
        concept_id: kind,
      },
    };

    results.push(predicate);
  }

  return results;
}

// ── constructorPredicates ─────────────────────────────────────────────────────

/**
 * Return the 3 hardcoded constructor predicates:
 *   ctor.solution, ctor.mixture, ctor.env
 *
 * @returns {Array<object>}
 */
export function constructorPredicates() {
  return [
    {
      id: 'ctor.solution',
      namespace: 'ctor',
      role: 'context',
      returns: 'ChemicalSystem',
      positional_args: [
        {
          name: 'substance',
          type: 'SubstanceRef',
        },
      ],
      named_args: [
        {
          name: 'mass_fraction',
          type: 'number',
          optional: true,
        },
        {
          name: 'concentration',
          type: 'number',
          optional: true,
        },
        {
          name: 'mass',
          type: 'number',
          optional: true,
        },
      ],
      temporal_kind: 'static',
      aliases: {
        ru: ['раствор', 'растворить'],
        en: ['solution', 'dissolve'],
        pl: ['roztwór', 'rozpuścić'],
        es: ['solución', 'disolver'],
      },
      search_tokens: {
        ru: ['раствор', 'растворение', 'концентрация'],
        en: ['solution', 'dissolving', 'concentration'],
        pl: ['roztwór', 'rozpuszczanie', 'stężenie'],
        es: ['solución', 'disolvencia', 'concentración'],
      },
      source: {
        kind: 'constructor',
      },
    },
    {
      id: 'ctor.mixture',
      namespace: 'ctor',
      role: 'context',
      positional_args: [],
      named_args: [
        {
          name: 'components',
          type: 'Expr[]',
          optional: false,
        },
      ],
      returns: 'ChemicalSystem',
      temporal_kind: 'static',
      aliases: {
        ru: ['смесь', 'смешать'],
        en: ['mixture', 'mix'],
        pl: ['mieszanina', 'mieszać'],
        es: ['mezcla', 'mezclar'],
      },
      search_tokens: {
        ru: ['смесь', 'компоненты'],
        en: ['mixture', 'components'],
        pl: ['mieszanina', 'komponenty'],
        es: ['mezcla', 'componentes'],
      },
      source: {
        kind: 'constructor',
      },
    },
    {
      id: 'ctor.env',
      namespace: 'ctor',
      role: 'context',
      positional_args: [],
      named_args: [
        {
          name: 't',
          type: 'number',
          optional: true,
        },
        {
          name: 'p',
          type: 'number',
          optional: true,
        },
      ],
      returns: 'Environment',
      temporal_kind: 'static',
      aliases: {
        ru: ['условия', 'температура', 'давление'],
        en: ['conditions', 'temperature', 'pressure'],
        pl: ['warunki', 'temperatura', 'ciśnienie'],
        es: ['condiciones', 'temperatura', 'presión'],
      },
      search_tokens: {
        ru: ['условия', 'температура', 'давление', 'среда'],
        en: ['conditions', 'temperature', 'pressure', 'environment'],
        pl: ['warunki', 'temperatura', 'ciśnienie', 'środowisko'],
        es: ['condiciones', 'temperatura', 'presión', 'entorno'],
      },
      source: {
        kind: 'constructor',
      },
    },
  ];
}

// ── mergePredicates ───────────────────────────────────────────────────────────

/**
 * Merge generated and override PredicateDef arrays.
 * Overrides win on id collision (override entries replace generated ones).
 *
 * @param {Array<object>} generated
 * @param {Array<object>} overrides
 * @returns {Array<object>}
 */
export function mergePredicates(generated, overrides) {
  /** @type {Map<string, object>} */
  const byId = new Map();

  // generated first
  for (const pred of generated) {
    if (pred.id) byId.set(pred.id, pred);
  }

  // overrides win — replace generated entries with same id
  for (const pred of overrides) {
    if (pred.id) byId.set(pred.id, pred);
  }

  const merged = Array.from(byId.values());

  // Sort by namespace ASC then id ASC for stable output
  merged.sort((a, b) => {
    const nsCmp = (a.namespace ?? '').localeCompare(b.namespace ?? '');
    if (nsCmp !== 0) return nsCmp;
    return (a.id ?? '').localeCompare(b.id ?? '');
  });

  return merged;
}

// ── buildPredicateIndex ───────────────────────────────────────────────────────

/**
 * Build a predicate index grouped by namespace.
 *
 * @param {Array<object>} predicates
 * @returns {Record<string, Array<object>>}
 */
export function buildPredicateIndex(predicates) {
  /** @type {Record<string, Array<object>>} */
  const index = {};

  for (const pred of predicates) {
    const key = pred.namespace ?? '';
    if (!index[key]) index[key] = [];
    index[key].push(pred);
  }

  return index;
}

// ── File output ───────────────────────────────────────────────────────────────

/**
 * Generate predicate_registry.json and predicate_index.json in outDir.
 *
 * @param {Array<object>} properties   - from properties.json
 * @param {Array<object>} formulas     - from formulas.json
 * @param {Record<string, object>} concepts  - from concepts.json
 * @param {Array<object>} overrides    - from predicate_overrides.json
 * @param {string}        outDir       - output directory path
 * @returns {{ total: number, byNamespace: Record<string, number> }}
 */
export function generatePredicateRegistry(properties, formulas, concepts, overrides, outDir) {
  const fromProperties = predicatesFromProperties(properties);
  const fromFormulas = predicatesFromFormulas(formulas);
  const fromConcepts = predicatesFromConcepts(concepts);
  const ctors = constructorPredicates();

  const generated = [...fromProperties, ...fromFormulas, ...fromConcepts, ...ctors];
  const merged = mergePredicates(generated, overrides);
  const index = buildPredicateIndex(merged);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'predicate_registry.json'), JSON.stringify(merged, null, 2));
  writeFileSync(join(outDir, 'predicate_index.json'), JSON.stringify(index, null, 2));

  const byNamespace = {};
  for (const [ns, preds] of Object.entries(index)) {
    byNamespace[ns] = preds.length;
  }

  return { total: merged.length, byNamespace };
}
