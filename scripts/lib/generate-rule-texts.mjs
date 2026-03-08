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

// Locale-specific noun for precipitate (rendering logic, not data)
const PRECIPITATE_NOUN = { ru: 'осадок', en: 'precipitate', pl: 'osad', es: 'precipitado' };

/**
 * Build a localized precipitate description from ontology properties.
 *
 * Locale ordering:
 *   ru/en/pl: "{color} [texture] {noun} {formula}"
 *   es:       "{noun} {color} [texture] de {formula}"
 */
function buildPrecipitateDesc(obs, substancePropsMap, colorTermsForLocale, locale) {
  const props = substancePropsMap[obs.substance] ?? [];
  const colorProp = props.find(p => p.property === 'prop:color' && p.phase === 'phase:solid');
  const textureProp = props.find(p => p.property === 'prop:texture' && p.phase === 'phase:solid');
  const color = colorProp ? (colorTermsForLocale[colorProp.value] ?? '') : '';
  const texture = textureProp ? (colorTermsForLocale[textureProp.value] ?? '') : '';
  const noun = PRECIPITATE_NOUN[locale] ?? 'precipitate';
  const formula = obs.formula_display;

  if (locale === 'es') {
    return [noun, color, texture, 'de', formula].filter(Boolean).join(' ');
  }
  return [color, texture, noun, formula].filter(Boolean).join(' ');
}

/**
 * Generate observation_summary texts for qualitative reactions.
 * Reads observation entities, substance properties, color terms, and indicator overrides
 * from the ontology — no hardcoded text in data files.
 *
 * @param {Array<object>} qualitativeReactions - qualitative_reactions.json entries
 * @param {Array<object>} reactionObservations - reaction_observations.json entities
 * @param {Array<object>} substanceProperties - substance_properties.json entities
 * @param {Record<string, Record<string, string>>} colorTerms - merged color_terms locale packs
 * @param {Record<string, Record<string, object>>} indicatorResponseLocale - per-locale indicator_response_rules locale packs
 * @param {Record<string, Record<string, string>>} templates - rule_summary_templates
 * @returns {Array<object>} GeneratedQualitativeText[]
 */
export function generateQualitativeTexts(
  qualitativeReactions,
  reactionObservations,
  substanceProperties,
  colorTerms,
  indicatorResponseLocale,
  templates,
) {
  // Build obs lookup map
  const obsById = Object.fromEntries(reactionObservations.map(o => [o.id, o]));

  // Build substance props lookup: sub:* → [property entries]
  const substancePropsMap = {};
  for (const p of substanceProperties) {
    if (!substancePropsMap[p.subject]) substancePropsMap[p.subject] = [];
    substancePropsMap[p.subject].push(p);
  }

  return qualitativeReactions
    .filter(entry => entry.observation_facets?.length > 0)
    .map(entry => {
      const obsId = entry.observation_facets[0];
      const obs = obsById[obsId];
      if (!obs) return null;

      const templateId = `observation_summary:qualitative.${obs.observation_type}`;
      const tmpl = templates[templateId];
      const slots = {};

      if (obs.observation_type === 'precipitate' && tmpl) {
        slots.observation_summary = {};
        for (const locale of LOCALES) {
          if (!tmpl[locale]) continue;
          const colorTermsLocal = Object.fromEntries(
            Object.entries(colorTerms).map(([k, v]) => [k, v[locale] ?? '']),
          );
          const precipDesc = buildPrecipitateDesc(obs, substancePropsMap, colorTermsLocal, locale);
          slots.observation_summary[locale] = tmpl[locale].replace('{precipitate}', precipDesc);
        }
      } else if (obs.observation_type === 'gas_evolution' && tmpl) {
        slots.observation_summary = {};
        for (const locale of LOCALES) {
          if (!tmpl[locale]) continue;
          slots.observation_summary[locale] = tmpl[locale].replace('{gas_product}', obs.formula_display);
        }
      } else if (obs.observation_type === 'indicator_change') {
        const computedKey = `computed:indicator_change:${obs.indicator}:${obs.input_state}`;
        slots.observation_summary = {};
        for (const locale of LOCALES) {
          const override = indicatorResponseLocale[locale]?.[computedKey]?.short_statement_override;
          if (override) {
            slots.observation_summary[locale] = override;
          }
          // Non-override fallback deferred to future Phase (indicator name locale lookup needed)
        }
      }

      return {
        target_id: entry.target_id,
        observation_id: obsId,
        text_origin: 'generated',
        generation_kind: 'observation_summary',
        template_id: templateId,
        slots,
      };
    })
    .filter(Boolean);
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
