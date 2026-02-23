import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CompetencyNode } from '../../types/competency';

export interface Props {
  competency: CompetencyNode;
  prereqs: CompetencyNode[];
  unlocks: CompetencyNode[];
  contentProps: Record<string, unknown>;
}

export function getStaticPaths() {
  const loadJson = (relPath: string) =>
    JSON.parse(readFileSync(join(process.cwd(), relPath), 'utf-8'));

  const competencies: CompetencyNode[] = loadJson('data-src/rules/competencies.json');

  const geneticChains = loadJson('data-src/rules/genetic_chains.json');
  const qualitativeTests = loadJson('data-src/rules/qualitative_reactions.json');
  const energyCatalystTheory = loadJson('data-src/rules/energy_catalyst_theory.json');
  const reactionTemplates = loadJson('data-src/templates/reaction_templates.json');
  const applicabilityRules = loadJson('data-src/rules/applicability_rules.json');
  const classificationRules = loadJson('data-src/rules/classification_rules.json');
  const namingRules = loadJson('data-src/rules/naming_rules.json');

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
    }

    return {
      params: { id: c.id },
      props: { competency: c, prereqs, unlocks, contentProps },
    };
  });
}
