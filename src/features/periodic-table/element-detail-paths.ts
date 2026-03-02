import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cachedReadJson, cachedReadDataSrc } from '../../lib/build-data-cache';

export interface ElementDiscovery {
  year?: number;
  scientist_ru?: string;
  country_ru?: string;
}

export interface ElementData {
  Z: number;
  symbol: string;
  name_ru: string;
  name_en: string;
  name_latin: string;
  group: number;
  period: number;
  metal_type: string;
  element_group: string;
  atomic_mass: number;
  typical_oxidation_states: number[];
  electronegativity: number | null;
  melting_point_C?: number | null;
  boiling_point_C?: number | null;
  density_g_cm3?: number | null;
  discovery?: ElementDiscovery;
  hazards_ru?: string[];
  storage_ru?: string;
  industrial_ru?: string;
  production_ru?: string;
  abundance_ru?: string;
  fun_facts_ru?: string[];
  electron_exception?: {
    config_override: [number, string, number][];
    expected_formula: string;
    actual_formula: string;
    rule: string;
    reason_ru: string;
  };
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

export interface SubstanceEntry {
  id: string;
  formula: string;
  name_ru?: string;
  class: string;
}

export interface ElementGroupInfo {
  name_ru: string;
  name_singular_ru: string;
}

export interface IonData {
  id: string;
  formula: string;
  name_ru: string;
  charge: number;
  type: 'cation' | 'anion';
}

export interface QualitativeTestData {
  target_id: string;
  target_name_ru: string;
  reagent_formula: string;
  reagent_name_ru: string;
  observation_ru: string;
  reaction_id?: string;
}

export interface Props {
  element: ElementData;
  elementReactions: ReactionData[];
  relatedSubstances: SubstanceEntry[];
  groupLabel: string;
  elementIons: IonData[];
  qualitativeTests: QualitativeTestData[];
}

export async function getStaticPaths() {
  const elements: ElementData[] = await cachedReadDataSrc('elements.json');

  // Load element groups for display names
  const groupsDict: Record<string, ElementGroupInfo> = await cachedReadDataSrc('element-groups.json');

  // Load ions for cross-referencing
  let allIons: IonData[] = [];
  try {
    allIons = await cachedReadDataSrc('ions.json');
  } catch { /* optional */ }

  // Load qualitative tests for cross-referencing
  let qualitativeTests: QualitativeTestData[] = [];
  try {
    qualitativeTests = await cachedReadDataSrc('rules/qualitative_reactions.json');
  } catch { /* optional */ }

  // Load reactions for cross-referencing
  let reactions: ReactionData[] = [];
  try {
    reactions = await cachedReadDataSrc('reactions/reactions.json');
  } catch { /* optional */ }

  // Load substances index for linking
  const substancesDir = join(process.cwd(), 'data-src', 'substances');
  let substances: SubstanceEntry[] = [];
  try {
    const files = await readdir(substancesDir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const data = await cachedReadJson<{ id: string; formula: string; name_ru?: string; class: string }>(join(substancesDir, f));
      substances.push({ id: data.id, formula: data.formula, name_ru: data.name_ru, class: data.class });
    }
  } catch { /* optional */ }

  return elements.map(el => {
    // Find reactions involving this element's symbol in reactant/product formulas
    const elementReactions = reactions.filter(r => {
      const allFormulas = [
        ...r.molecular.reactants.map(x => x.formula),
        ...r.molecular.products.map(x => x.formula),
      ];
      const re = new RegExp(`(^|[a-z\\d₂₃₄₅₆₇₈₉)])${el.symbol}([A-Z₂₃₄₅₆₇₈₉\\d(]|$)`);
      const reStart = new RegExp(`^${el.symbol}([A-Z₂₃₄₅₆₇₈₉\\d(]|$)`);
      return allFormulas.some(f => reStart.test(f) || re.test(f));
    });

    // Find related substances (those containing this element)
    const relatedSubstances = substances.filter(s => {
      const re = new RegExp(`(^|[a-z\\d₂₃₄₅₆₇₈₉)])${el.symbol}([A-Z₂₃₄₅₆₇₈₉\\d(]|$)`);
      const reStart = new RegExp(`^${el.symbol}([A-Z₂₃₄₅₆₇₈₉\\d(]|$)`);
      return reStart.test(s.formula) || re.test(s.formula);
    });

    const groupLabel = groupsDict[el.element_group]?.name_singular_ru ?? el.element_group;

    // Find ions that contain this element's symbol
    const elementIons = allIons.filter(ion => {
      const re = new RegExp(`(^|[^A-Za-z])${el.symbol}([^a-z]|$)`);
      return re.test(ion.formula);
    });

    // Find qualitative tests whose target ion formula contains this element's symbol
    const elQualTests = qualitativeTests.filter(qt => {
      // Extract formula from target_name_ru (last word) or target_id
      const targetFormula = qt.target_id;
      const re = new RegExp(`(^|[^A-Za-z])${el.symbol}([^a-z]|$)`);
      return re.test(targetFormula);
    });

    return {
      params: { symbol: el.symbol },
      props: { element: el, elementReactions, relatedSubstances, groupLabel, elementIons, qualitativeTests: elQualTests },
    };
  });
}
