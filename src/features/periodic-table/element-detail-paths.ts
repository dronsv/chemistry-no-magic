import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cachedReadJson, cachedReadDataSrc } from '../../lib/build-data-cache';
import { loadRoutePolicy, isRouteAllowed } from '../../lib/route-policy';

export interface ElementDiscovery {
  year?: number;
  scientist?: string;
  country?: string;
}

export interface ElementData {
  Z: number;
  symbol: string;
  name?: string;
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
  hazards?: string[];
  storage?: string;
  industrial?: string;
  production?: string;
  abundance?: string;
  fun_facts?: string[];
  electron_exception?: {
    config_override: [number, string, number][];
    expected_formula: string;
    actual_formula: string;
    rule: string;
    reason: string;
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
  name?: string;
  class: string;
}

export interface ElementGroupInfo {
  name: string;
  name_singular: string;
}

export interface IonData {
  id: string;
  formula: string;
  name: string;
  charge: number;
  type: 'cation' | 'anion';
}

export interface QualitativeTestData {
  target_id: string;
  target_name: string;
  reagent_formula: string;
  reagent_name: string;
  observation: string;
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
  const allElements: ElementData[] = await cachedReadDataSrc('elements.json');
  const policy = await loadRoutePolicy();
  const fullSet = new Set(
    allElements.filter(el => isRouteAllowed(policy.elements, el.symbol)).map(el => el.symbol),
  );

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
      const data = await cachedReadJson<{ id: string; formula: string; name?: string; class: string }>(join(substancesDir, f));
      substances.push({ id: data.id, formula: data.formula, name: data.name, class: data.class });
    }
  } catch { /* optional */ }

  return allElements.map(el => {
    const isFull = fullSet.has(el.symbol);

    // Cross-references only for allowlisted (full) elements; stubs get empty arrays
    let elementReactions: ReactionData[] = [];
    let relatedSubstances: SubstanceEntry[] = [];
    let elementIons: IonData[] = [];
    let elQualTests: QualitativeTestData[] = [];

    if (isFull) {
      elementReactions = reactions.filter(r => {
        const allFormulas = [
          ...r.molecular.reactants.map(x => x.formula),
          ...r.molecular.products.map(x => x.formula),
        ];
        const re = new RegExp(`(^|[a-z\\d₂₃₄₅₆₇₈₉)])${el.symbol}([A-Z₂₃₄₅₆₇₈₉\\d(]|$)`);
        const reStart = new RegExp(`^${el.symbol}([A-Z₂₃₄₅₆₇₈₉\\d(]|$)`);
        return allFormulas.some(f => reStart.test(f) || re.test(f));
      });

      relatedSubstances = substances.filter(s => {
        const re = new RegExp(`(^|[a-z\\d₂₃₄₅₆₇₈₉)])${el.symbol}([A-Z₂₃₄₅₆₇₈₉\\d(]|$)`);
        const reStart = new RegExp(`^${el.symbol}([A-Z₂₃₄₅₆₇₈₉\\d(]|$)`);
        return reStart.test(s.formula) || re.test(s.formula);
      });

      elementIons = allIons.filter(ion => {
        const re = new RegExp(`(^|[^A-Za-z])${el.symbol}([^a-z]|$)`);
        return re.test(ion.formula);
      });

      elQualTests = qualitativeTests.filter(qt => {
        const targetFormula = qt.target_id;
        const re = new RegExp(`(^|[^A-Za-z])${el.symbol}([^a-z]|$)`);
        return re.test(targetFormula);
      });
    }

    const groupLabel = groupsDict[el.element_group]?.name_singular ?? el.element_group;

    return {
      params: { symbol: el.symbol },
      props: { element: el, elementReactions, relatedSubstances, groupLabel, elementIons, qualitativeTests: elQualTests },
    };
  });
}
