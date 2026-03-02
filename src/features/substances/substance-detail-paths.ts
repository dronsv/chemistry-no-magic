import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cachedReadJson, cachedReadDataSrc } from '../../lib/build-data-cache';

export interface SubstanceData {
  id: string;
  formula: string;
  name_ru?: string;
  class: string;
  subclass?: string;
  ions?: string[];
  notes?: string;
  tags?: string[];
  melting_point_C?: number | null;
  boiling_point_C?: number | null;
  density_g_cm3?: number | null;
  appearance_ru?: string;
  hazards_ru?: string[];
  storage_ru?: string;
  industrial_ru?: string;
  production_ru?: string;
  fun_facts_ru?: string[];
}

export interface ReactionMolecularItem {
  formula: string;
  name?: string;
  coeff: number;
}

export interface ReactionData {
  reaction_id: string;
  title: string;
  equation: string;
  molecular: {
    reactants: ReactionMolecularItem[];
    products: ReactionMolecularItem[];
  };
}

export interface IonData {
  id: string;
  formula: string;
  name_ru: string;
  charge: number;
  type: string;
}

export interface ClassificationRule {
  id: string;
  class: string;
  subclass: string;
  description_ru: string;
  examples: string[];
}

export interface NamingRule {
  id: string;
  class: string;
  template_ru: string;
  examples: Array<{ formula: string; name_ru: string }>;
}

export interface Props {
  substance: SubstanceData;
  classificationRules: ClassificationRule[];
  namingRules: NamingRule[];
  allSubstances: SubstanceData[];
  ions: Record<string, IonData>;
  substanceReactions: ReactionData[];
}

export async function getStaticPaths() {
  const substancesDir = join(process.cwd(), 'data-src', 'substances');
  const rulesDir = join(process.cwd(), 'data-src', 'rules');

  let files: string[];
  try {
    files = await readdir(substancesDir);
  } catch {
    return [];
  }

  // Load rules and ions at build time
  let classificationRules: ClassificationRule[] = [];
  let namingRules: NamingRule[] = [];
  let allSubstances: SubstanceData[] = [];
  let ionMap = new Map<string, IonData>();

  try {
    classificationRules = await cachedReadDataSrc('rules/classification_rules.json');
    namingRules = await cachedReadDataSrc('rules/naming_rules.json');
  } catch { /* rules optional */ }

  try {
    const ions: IonData[] = await cachedReadDataSrc('ions.json');
    for (const ion of ions) ionMap.set(ion.id, ion);
  } catch { /* ions optional */ }

  // Load reactions for cross-referencing
  let reactions: ReactionData[] = [];
  try {
    reactions = await cachedReadDataSrc('reactions/reactions.json');
  } catch { /* reactions optional */ }

  const paths = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace('.json', '');
    const substance: SubstanceData = await cachedReadJson(join(substancesDir, file));
    allSubstances.push(substance);
    paths.push({ params: { id }, props: { substance, classificationRules, namingRules } });
  }

  // Convert ionMap to plain object for serialization
  const ionRecord: Record<string, IonData> = Object.fromEntries(ionMap);

  // Build reactions map: for each substance, find reactions where its formula appears
  function findReactions(formula: string): ReactionData[] {
    const normalized = formula
      .replace(/₂/g, '2').replace(/₃/g, '3').replace(/₄/g, '4')
      .replace(/₅/g, '5').replace(/₆/g, '6').replace(/₇/g, '7')
      .replace(/₈/g, '8').replace(/₉/g, '9');
    return reactions.filter(r => {
      const allFormulas = [
        ...r.molecular.reactants.map(x => x.formula),
        ...r.molecular.products.map(x => x.formula),
      ];
      return allFormulas.some(f => {
        const fn = f.replace(/₂/g, '2').replace(/₃/g, '3').replace(/₄/g, '4')
          .replace(/₅/g, '5').replace(/₆/g, '6').replace(/₇/g, '7')
          .replace(/₈/g, '8').replace(/₉/g, '9');
        return fn === normalized;
      });
    });
  }

  // Add allSubstances, ions and reactions to each path
  return paths.map(p => ({
    ...p,
    props: {
      ...p.props,
      allSubstances,
      ions: ionRecord,
      substanceReactions: findReactions(p.props.substance.formula),
    },
  }));
}
