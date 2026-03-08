/**
 * Phase B1: Controlled Rule Text Generation
 *
 * Generates localized rule summaries from structured rule fields + vocab + templates.
 * Input: applicabilityRules[], vocab{}, templates{}
 * Output: GeneratedRuleText[] (per rule × locale)
 */

const LOCALES = ['ru', 'en', 'pl', 'es'];

// Maps rule slot names to vocab namespace prefixes
const SLOT_NS_MAP = {
  reactant_class: 'class',
  product_classes: 'product',
  required_products: 'product',
  gas_product: 'substance',
  reagent_class: 'reagent',
  acids: 'substance',
  metals: 'metal_group',
  substance: 'substance',
  subject_class: 'class',
  exceptions: 'class',
  acid: 'substance',
  conditions: 'condition',
};

// Vocab key suffix for reactant_class with constraint (e.g. "metal_hydroxide" + "solubility:insoluble")
function buildReactantClassKey(rule) {
  const cls = rule.reactant_class;
  if (!cls) return null;
  if (rule.reactant_constraint === 'solubility:insoluble') return `class:${cls}.insoluble`;
  return `class:${cls}`;
}

/**
 * Resolve a single slot value to a localized string.
 * For arrays, joins resolved items with ', '.
 */
function resolveSlot(slot, rule, vocab, locale) {
  const val = rule[slot];
  if (val === undefined || val === null) return null;

  // Special case: reactant_class may have a compound vocab key with constraint
  if (slot === 'reactant_class') {
    const key = buildReactantClassKey(rule);
    if (key && vocab[key]) return vocab[key][locale] ?? null;
  }

  if (Array.isArray(val)) {
    const ns = SLOT_NS_MAP[slot];
    if (!ns) return val.join(', ');
    return val
      .map(v => {
        const k = `${ns}:${v}`;
        return (vocab[k] && vocab[k][locale]) ?? v;
      })
      .join(', ');
  }

  const ns = SLOT_NS_MAP[slot];
  if (ns) {
    const k = `${ns}:${val}`;
    if (vocab[k]) return vocab[k][locale] ?? null;
    // Fallback: try metal_group:<val> for metals field
    if (slot === 'metals') {
      const mg = `metal_group:${val}`;
      if (vocab[mg]) return vocab[mg][locale] ?? null;
    }
  }
  return String(val);
}

/**
 * Interpolate a template string, resolving {slot} placeholders.
 * Capitalizes the first character of the result.
 */
function interpolate(template, rule, vocab, locale) {
  if (!template) return null;
  const text = template.replace(/\{(\w+)\}/g, (_, slot) => {
    return resolveSlot(slot, rule, vocab, locale) ?? `{${slot}}`;
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Determine the template key for canonical_summary lookup.
 */
function resolveTemplateKey(rule) {
  if (rule.rule_kind === 'activity_restriction' && rule.constraint) {
    return `activity_restriction.${rule.constraint}`;
  }
  return rule.rule_kind;
}

/**
 * Generate localized text slots for a single rule.
 */
function generateRuleText(rule, vocab, templates) {
  const templateKey = resolveTemplateKey(rule);
  const summaryTmplKey = `canonical_summary:${templateKey}`;
  const tmpl = templates[summaryTmplKey];

  const slots = {};

  if (tmpl) {
    slots.canonical_summary = {};
    for (const locale of LOCALES) {
      const text = interpolate(tmpl[locale], rule, vocab, locale);
      if (text) slots.canonical_summary[locale] = text;
    }
  }

  // Exception note for thermal decomposition rules
  if (rule.exceptions?.length) {
    const exTmpl = templates['exception_note:thermally_stable'];
    if (exTmpl) {
      slots.exception_note = {};
      for (const locale of LOCALES) {
        const text = interpolate(exTmpl[locale], rule, vocab, locale);
        if (text) slots.exception_note[locale] = text;
      }
    }
  }

  // Observation summary — uses the first observation facet (current rules have exactly one)
  if (rule.observation_facets?.length) {
    const [facetKind] = rule.observation_facets[0].split(':');
    const obsTmpl = templates[`observation_summary:${facetKind}`];
    if (obsTmpl) {
      slots.observation_summary = {};
      for (const locale of LOCALES) {
        const text = interpolate(obsTmpl[locale], rule, vocab, locale);
        if (text) slots.observation_summary[locale] = text;
      }
    }
  }

  return {
    rule_id: rule.id,
    text_origin: 'generated',
    generation_kind: 'rule_summary',
    template_id: summaryTmplKey,
    slots,
  };
}

/**
 * Generate rule texts for all rules.
 *
 * @param {Array<object>} rules - applicability rules with structured fields
 * @param {Record<string, Record<string, string>>} vocab - rule_terms vocab
 * @param {Record<string, Record<string, string>>} templates - rule_summary_templates
 * @returns {Array<object>} GeneratedRuleText[]
 */
export function generateRuleTexts(rules, vocab, templates) {
  return rules.map(rule => generateRuleText(rule, vocab, templates));
}

// Maps facet namespace to the slot name used in the observation template
const FACET_SLOT_MAP = {
  precipitate: 'precipitate',
  gas_evolution: 'gas_product',
  indicator: 'indicator',
};

// Maps facet namespace to vocab namespace prefix for slot resolution
const FACET_VOCAB_NS_MAP = {
  precipitate: 'precipitate',
  gas_evolution: 'substance',
  indicator: 'indicator',
};

/**
 * Generate observation_summary texts for qualitative reactions.
 * Each entry must have observation_facets (e.g. ["precipitate:AgCl"]).
 *
 * @param {Array<object>} qualitativeReactions - qualitative_reactions.json entries
 * @param {Record<string, Record<string, string>>} vocab - merged rule_terms vocab
 * @param {Record<string, Record<string, string>>} templates - rule_summary_templates
 * @returns {Array<object>} GeneratedQualitativeText[]
 */
export function generateQualitativeTexts(qualitativeReactions, vocab, templates) {
  return qualitativeReactions
    .filter(entry => entry.observation_facets?.length > 0)
    .map(entry => {
      const facet = entry.observation_facets[0]; // primary facet
      const [kind, id] = facet.split(':');
      const templateId = `observation_summary:qualitative.${kind}`;
      const tmpl = templates[templateId];

      const slots = {};
      if (tmpl) {
        const slotName = FACET_SLOT_MAP[kind] ?? kind;
        const vocabNs = FACET_VOCAB_NS_MAP[kind] ?? kind;
        const vocabKey = `${vocabNs}:${id}`;
        slots.observation_summary = {};
        for (const locale of LOCALES) {
          if (!tmpl[locale]) continue;
          const facetText = (vocab[vocabKey] && vocab[vocabKey][locale]) ?? id;
          const text = tmpl[locale].replace(`{${slotName}}`, facetText);
          slots.observation_summary[locale] = text.charAt(0).toUpperCase() + text.slice(1);
        }
      }

      return {
        target_id: entry.target_id,
        primary_facet: facet,
        text_origin: 'generated',
        generation_kind: 'observation_summary',
        template_id: templateId,
        slots,
      };
    });
}

/**
 * Determine activity_summary template key from machine flags.
 *
 * @param {{ reduces_H_from_water: boolean, reduces_H: boolean }} entry
 * @returns {string}
 */
function resolveActivityTemplateKey(entry) {
  if (entry.reduces_H_from_water) return 'reacts_water_and_acids';
  if (entry.reduces_H) return 'reacts_acids_only';
  return 'noble_metal';
}

/**
 * Generate activity_summary texts for each metal in the activity series.
 * H (the reference point) is excluded from output.
 *
 * @param {Array<object>} activitySeries - activity_series.json entries
 * @param {Record<string, Record<string, string>>} templates - rule_summary_templates
 * @returns {Array<object>} GeneratedActivityText[]
 */
export function generateActivityTexts(activitySeries, templates) {
  return activitySeries
    .filter(entry => entry.symbol !== 'H')
    .map(entry => {
      const key = resolveActivityTemplateKey(entry);
      const templateId = `activity_summary:${key}`;
      const tmpl = templates[templateId];
      const slots = {};
      if (tmpl) {
        slots.activity_summary = {};
        for (const locale of LOCALES) {
          if (tmpl[locale]) slots.activity_summary[locale] = tmpl[locale];
        }
      }
      return {
        metal_symbol: entry.symbol,
        text_origin: 'generated',
        generation_kind: 'activity_summary',
        template_id: templateId,
        slots,
      };
    });
}
