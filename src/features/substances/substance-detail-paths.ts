import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

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

export const CLASS_LABELS: Record<string, string> = {
  oxide: 'Оксид',
  acid: 'Кислота',
  base: 'Основание',
  salt: 'Соль',
  other: 'Другое',
};

export const SUBCLASS_LABELS: Record<string, string> = {
  basic: 'основный',
  acidic: 'кислотный',
  amphoteric: 'амфотерный',
  indifferent: 'несолеобразующий',
  oxygen_containing: 'кислородсодержащая',
  oxygen_free: 'бескислородная',
  soluble: 'растворимое (щёлочь)',
  insoluble: 'нерастворимое',
  normal: 'средняя (нормальная)',
  acidic_salt: 'кислая',
  basic_salt: 'основная',
  hydride: 'гидрид',
};

export const TAG_LABELS: Record<string, string> = {
  soluble: 'растворимое',
  insoluble: 'нерастворимое',
  slightly_soluble: 'малорастворимое',
  strong_electrolyte: 'сильный электролит',
  weak_electrolyte: 'слабый электролит',
  amphoteric: 'амфотерное',
  oxidizer: 'окислитель',
  reducer: 'восстановитель',
  strong_acid: 'сильная кислота',
  medium_acid: 'кислота средней силы',
  weak_acid: 'слабая кислота',
  alkali: 'щёлочь',
  diprotic: 'двухосновная',
  triprotic: 'трёхосновная',
  unstable: 'неустойчивое',
  decomposes: 'разлагается',
  decomposes_on_heating: 'разлагается при нагревании',
  reacts_with_water: 'реагирует с водой',
  no_water_reaction: 'не реагирует с водой',
  gas: 'газ',
  pungent_odor: 'резкий запах',
  white: 'белое',
  black: 'чёрное',
  blue: 'голубое',
  red_brown: 'красно-бурое',
  gelatinous: 'студенистое',
};

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
    classificationRules = JSON.parse(
      await readFile(join(rulesDir, 'classification_rules.json'), 'utf-8')
    );
    namingRules = JSON.parse(
      await readFile(join(rulesDir, 'naming_rules.json'), 'utf-8')
    );
  } catch { /* rules optional */ }

  try {
    const ions: IonData[] = JSON.parse(
      await readFile(join(process.cwd(), 'data-src', 'ions.json'), 'utf-8')
    );
    for (const ion of ions) ionMap.set(ion.id, ion);
  } catch { /* ions optional */ }

  // Load reactions for cross-referencing
  let reactions: ReactionData[] = [];
  try {
    reactions = JSON.parse(
      await readFile(join(process.cwd(), 'data-src', 'reactions', 'reactions.json'), 'utf-8')
    );
  } catch { /* reactions optional */ }

  const paths = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace('.json', '');
    const raw = await readFile(join(substancesDir, file), 'utf-8');
    const substance: SubstanceData = JSON.parse(raw);
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
