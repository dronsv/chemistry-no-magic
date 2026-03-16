import { cachedReadDataSrcSync } from '../../lib/build-data-cache';
import type { CompetencyNode } from '../../types/competency';

export interface Props {
  competency: CompetencyNode;
  prereqs: CompetencyNode[];
  unlocks: CompetencyNode[];
  contentProps: Record<string, unknown>;
}

export function getStaticPaths() {
  const competencies: CompetencyNode[] = cachedReadDataSrcSync('rules/competencies.json');

  const geneticChains = cachedReadDataSrcSync('rules/genetic_chains.json');
  const qualitativeTests = cachedReadDataSrcSync('rules/qualitative_reactions.json');
  const energyCatalystTheory = cachedReadDataSrcSync('rules/energy_catalyst_theory.json');
  const reactionTemplates = cachedReadDataSrcSync('reactions/reaction_templates.json');
  const applicabilityRules = cachedReadDataSrcSync('rules/applicability_rules.json');
  const classificationRules = cachedReadDataSrcSync('rules/classification_rules.json');
  const namingRules = cachedReadDataSrcSync('rules/naming_rules.json');
  const ionNomenclature = cachedReadDataSrcSync('rules/ion_nomenclature.json');

  return competencies.map(c => {
    const unlocks = competencies.filter(u => u.prerequisites.includes(c.id));
    const prereqs = competencies.filter(p => c.prerequisites.includes(p.id));

    let contentProps: Record<string, unknown> = {};
    switch (c.id) {
      case 'genetic_chain_logic':
        contentProps = { type: 'chains', chains: geneticChains };
        break;
      case 'qualitative_analysis_logic':
        contentProps = { type: 'qualTests', tests: qualitativeTests };
        break;
      case 'reaction_energy_profile':
        contentProps = { type: 'rate', theory: energyCatalystTheory };
        break;
      case 'catalyst_role_understanding':
        contentProps = {
          type: 'catalyst',
          catalystProperties: energyCatalystTheory.catalyst_properties,
          commonCatalysts: energyCatalystTheory.common_catalysts,
        };
        break;
      case 'reactions_exchange':
        contentProps = { type: 'exchange', templates: reactionTemplates, rules: applicabilityRules };
        break;
      case 'classification':
        contentProps = { type: 'classRules', rules: classificationRules };
        break;
      case 'naming':
        contentProps = { type: 'naming', rules: namingRules };
        break;
      case 'ion_nomenclature':
        contentProps = { type: 'ionNomenclature', rules: ionNomenclature };
        break;
    }

    return {
      params: { id: c.id },
      props: { competency: c, prereqs, unlocks, contentProps },
    };
  });
}
