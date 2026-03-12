/**
 * Generate reacts_with_class and passivates_in triples from applicability rules.
 *
 * Extracts class-to-class reactions, passivation edges, and thermal decomposition rules.
 */

const ACID_ID_MAP = {
  H2SO4_conc: 'sub:h2so4',
  HNO3_conc: 'sub:hno3',
};

/**
 * @param {Array} applicabilityRules - Parsed applicability_rules.json
 * @returns {Array<import('../../src/types/relation').Relation>}
 */
export function generateReactsWithClass(applicabilityRules) {
  const triples = [];

  for (const rule of applicabilityRules) {
    if (rule.rule_kind === 'amphoteric_reaction') {
      for (const target of rule.reacts_with ?? []) {
        triples.push({
          subject: `class:${rule.subject_class}`,
          predicate: 'reacts_with_class',
          object: `class:${target}`,
          knowledge_level: 'school_convention',
          source_kind: 'derived',
        });
      }
    }

    if (rule.rule_kind === 'passivation') {
      for (const metal of rule.metals ?? []) {
        for (const acid of rule.acids ?? []) {
          triples.push({
            subject: `el:${metal}`,
            predicate: 'passivates_in',
            object: ACID_ID_MAP[acid] ?? `mol:${acid}`,
            condition: rule.condition ?? 'cold',
            knowledge_level: 'school_convention',
            source_kind: 'derived',
          });
        }
      }
    }

    if (rule.rule_kind === 'thermal_decomposition') {
      const cond = (rule.conditions ?? []).join('+') || undefined;
      for (const pc of rule.product_classes ?? []) {
        triples.push({
          subject: `class:${rule.reactant_class}`,
          predicate: 'decomposes_to',
          object: `class:${pc}`,
          ...(cond ? { condition: cond } : {}),
          knowledge_level: 'school_convention',
          source_kind: 'derived',
        });
      }
    }

    if (rule.rule_kind === 'gas_evolution') {
      triples.push({
        subject: `class:${rule.reactant_class}`,
        predicate: 'reacts_with_class',
        object: `class:${rule.reagent_class}`,
        knowledge_level: 'school_convention',
        source_kind: 'derived',
      });
    }
  }

  return triples;
}
