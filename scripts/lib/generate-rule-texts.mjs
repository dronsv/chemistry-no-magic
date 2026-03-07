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
