import type { BondExampleEntry } from '../../types/bond';
import type { CalcReaction, CalcSubstance } from '../../types/calculations';
import type { ClassificationRule } from '../../types/classification';
import type { Element } from '../../types/element';
import type { CommonCatalyst, EquilibriumShift, RateFactor } from '../../types/energy-catalyst';
import type { ChainStep, GeneticChain } from '../../types/genetic-chain';
import type { Ion } from '../../types/ion';
import type { AcidAnionPair, SuffixRule } from '../../types/ion-nomenclature';
import type { NamingRule } from '../../types/classification';
import type { QualitativeTest } from '../../types/qualitative';
import type { ActivitySeriesEntry } from '../../types/rules';
import type { OntologyData, PropertyDef, SlotValues } from './types';

// ── Helpers ──────────────────────────────────────────────────────

/** Pick a random item from an array. Throws if empty. */
function pickRandom<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error('pickRandom: empty array');
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick k unique random items from an array. */
function pickK<T>(arr: T[], k: number): T[] {
  if (arr.length < k) throw new Error(`pickK: need ${k} items but only ${arr.length} available`);
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}

/**
 * Resolve a param value that might be a `{placeholder}`.
 * If the value is wrapped in braces like `"{property}"`, strip braces and
 * look up a matching property from data.properties. If none matches or no
 * braces, return the raw value.
 */
function resolveParam(
  raw: unknown,
  data: OntologyData,
): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const m = raw.match(/^\{(.+)\}$/);
  if (!m) return raw;
  // It's a placeholder — pick a random property
  const inner = m[1];
  const match = data.core.properties.find(p => p.id === inner);
  if (match) return match.id; // exact match — but caller wanted random? No, just return the id.
  // Generic placeholder like {property} — pick random property
  return pickRandom(data.core.properties).id;
}

/** Get the value of a property field from an element. */
function getElementValue(el: Element, valueField: string): number | null {
  const val = (el as unknown as Record<string, unknown>)[valueField];
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return val;
  return null;
}

/** Apply "main_group" filter: Z<=86, exclude noble gases. */
function applyMainGroupFilter(elements: Element[]): Element[] {
  return elements.filter(el => el.Z <= 86 && el.element_group !== 'noble_gas');
}

/** Apply property-specific filter (from PropertyDef.filter). */
function applyPropertyFilter(elements: Element[], prop: PropertyDef): Element[] {
  let result = elements;
  if (prop.filter) {
    if (prop.filter.min_Z !== undefined) {
      result = result.filter(el => el.Z >= prop.filter!.min_Z!);
    }
    if (prop.filter.max_Z !== undefined) {
      result = result.filter(el => el.Z <= prop.filter!.max_Z!);
    }
    if (prop.filter.exclude_groups && prop.filter.exclude_groups.length > 0) {
      const excluded = new Set(prop.filter.exclude_groups);
      result = result.filter(el => !excluded.has(el.group));
    }
  }
  return result;
}

// ── Generator implementations ────────────────────────────────────

function genPickElementPair(params: Record<string, unknown>, data: OntologyData): SlotValues {
  const filter = typeof params.filter === 'string' ? params.filter : undefined;
  const requireFieldRaw = params.require_field;
  const propertyId = resolveParam(requireFieldRaw as string | undefined, data) ?? pickRandom(data.core.properties).id;
  const prop = data.core.properties.find(p => p.id === propertyId);
  if (!prop) throw new Error(`Unknown property: ${propertyId}`);

  let candidates = [...data.core.elements];

  // Apply filter
  if (filter === 'main_group') {
    candidates = applyMainGroupFilter(candidates);
  }

  // Apply property-level filter
  candidates = applyPropertyFilter(candidates, prop);

  // Keep only elements with non-null value for the property field
  candidates = candidates.filter(el => getElementValue(el, prop.value_field) !== null);

  // Pick 2 distinct elements
  const [a, b] = pickK(candidates, 2);

  return {
    elementA: a.symbol,
    elementB: b.symbol,
    property: prop.id,
  };
}

function genPickElementsSamePeriod(params: Record<string, unknown>, data: OntologyData): SlotValues {
  const k = typeof params.k === 'number' ? params.k : 4;
  const requireFieldRaw = params.require_field;
  const propertyId = resolveParam(requireFieldRaw as string | undefined, data) ?? pickRandom(data.core.properties).id;
  const prop = data.core.properties.find(p => p.id === propertyId);
  if (!prop) throw new Error(`Unknown property: ${propertyId}`);

  let candidates = [...data.core.elements];

  // Apply property-level filter
  candidates = applyPropertyFilter(candidates, prop);

  // Keep only elements with non-null value
  candidates = candidates.filter(el => getElementValue(el, prop.value_field) !== null);

  // Group by period
  const byPeriod = new Map<number, Element[]>();
  for (const el of candidates) {
    const arr = byPeriod.get(el.period) ?? [];
    arr.push(el);
    byPeriod.set(el.period, arr);
  }

  // Find periods with enough candidates
  const validPeriods = [...byPeriod.entries()].filter(([, els]) => els.length >= k);
  if (validPeriods.length === 0) {
    throw new Error(`No period has ${k} elements with property ${propertyId}`);
  }

  const [, periodElements] = pickRandom(validPeriods);
  const chosen = pickK(periodElements, k);

  // Pick random order
  const orderRaw = params.order;
  let order: string;
  if (typeof orderRaw === 'string') {
    const resolved = orderRaw.match(/^\{(.+)\}$/) ? pickRandom(['ascending', 'descending']) : orderRaw;
    order = resolved;
  } else {
    order = pickRandom(['ascending', 'descending']);
  }

  const symbols = chosen.map(el => el.symbol);

  return {
    elements: symbols.join(', '),
    element_symbols: symbols,
    property: prop.id,
    order,
  };
}

function genPickOxidationExample(params: Record<string, unknown>, data: OntologyData): SlotValues {
  let examples = [...data.rules.oxidationExamples];

  // Optional difficulty filter
  const difficulty = typeof params.difficulty === 'string' ? params.difficulty : undefined;
  const resolvedDifficulty = difficulty ? (difficulty.match(/^\{.+\}$/) ? undefined : difficulty) : undefined;
  if (resolvedDifficulty) {
    examples = examples.filter(ex => ex.difficulty === resolvedDifficulty);
  }

  if (examples.length === 0) {
    throw new Error('No oxidation examples match the filter');
  }

  const ex = pickRandom(examples);

  return {
    formula: ex.formula,
    element: ex.target_element,
    expected_state: ex.oxidation_state,
  };
}

function genPickIonPair(params: Record<string, unknown>, data: OntologyData): SlotValues {
  const cations = data.core.ions.filter(i => i.type === 'cation');
  const anions = data.core.ions.filter(i => i.type === 'anion');

  let filteredCations = cations;
  let filteredAnions = anions;

  // Optional charge range filters
  if (typeof params.min_cation_charge === 'number') {
    filteredCations = filteredCations.filter(c => c.charge >= (params.min_cation_charge as number));
  }
  if (typeof params.max_cation_charge === 'number') {
    filteredCations = filteredCations.filter(c => c.charge <= (params.max_cation_charge as number));
  }
  if (typeof params.min_anion_charge === 'number') {
    filteredAnions = filteredAnions.filter(a => Math.abs(a.charge) >= (params.min_anion_charge as number));
  }
  if (typeof params.max_anion_charge === 'number') {
    filteredAnions = filteredAnions.filter(a => Math.abs(a.charge) <= (params.max_anion_charge as number));
  }

  if (filteredCations.length === 0 || filteredAnions.length === 0) {
    throw new Error('No ions match the charge filters');
  }

  const cat = pickRandom(filteredCations);
  const an = pickRandom(filteredAnions);

  return {
    cation: cat.formula,
    anion: an.formula,
    cation_id: cat.id,
    anion_id: an.id,
    cation_charge: cat.charge,
    anion_charge: an.charge,
  };
}

function genPickSaltPair(params: Record<string, unknown>, data: OntologyData): SlotValues {
  void params; // no params used currently
  if (data.rules.solubilityPairs.length === 0) {
    throw new Error('No solubility pairs available');
  }

  const pair = pickRandom(data.rules.solubilityPairs);

  // Look up ion formulas for display
  const catIon = data.core.ions.find(i => i.id === pair.cation);
  const anIon = data.core.ions.find(i => i.id === pair.anion);

  const catFormula = catIon?.formula ?? pair.cation;
  const anFormula = anIon?.formula ?? pair.anion;

  // Build a display salt formula from cation + anion
  const saltFormula = `${pair.cation}+${pair.anion}`;

  return {
    salt_formula: saltFormula,
    cation_id: pair.cation,
    anion_id: pair.anion,
    cation_formula: catFormula,
    anion_formula: anFormula,
    expected_solubility: pair.solubility,
  };
}

// ── Bond & substance generators ──────────────────────────────────

const BOND_TYPES = ['ionic', 'covalent_polar', 'covalent_nonpolar', 'metallic'] as const;

function genPickBondExample(params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.bondExamples) throw new Error('bondExamples not available in data');

  let examples: BondExampleEntry[] = [...data.rules.bondExamples.examples];

  const raw = typeof params.bond_type === 'string' ? params.bond_type : undefined;
  if (raw) {
    const m = raw.match(/^\{(.+)\}$/);
    if (m) {
      // Placeholder — pick random bond type, then filter
      const bondType = pickRandom([...BOND_TYPES]);
      examples = examples.filter(ex => ex.bond_type === bondType);
    } else {
      examples = examples.filter(ex => ex.bond_type === raw);
    }
  }

  const ex = pickRandom(examples);
  return {
    formula: ex.formula,
    bond_type: ex.bond_type,
    crystal_type: ex.crystal_type,
  };
}

function genPickBondPair(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.bondExamples) throw new Error('bondExamples not available in data');

  // Group examples by crystal_type
  const byCrystal = new Map<string, BondExampleEntry[]>();
  for (const ex of data.rules.bondExamples.examples) {
    const arr = byCrystal.get(ex.crystal_type) ?? [];
    arr.push(ex);
    byCrystal.set(ex.crystal_type, arr);
  }

  const crystalTypes = [...byCrystal.keys()];
  const [typeA, typeB] = pickK(crystalTypes, 2);
  const exA = pickRandom(byCrystal.get(typeA)!);
  const exB = pickRandom(byCrystal.get(typeB)!);

  return {
    formulaA: exA.formula,
    formulaB: exB.formula,
    crystal_typeA: exA.crystal_type,
    crystal_typeB: exB.crystal_type,
  };
}

const SUBSTANCE_CLASSES = ['oxide', 'acid', 'base', 'salt'] as const;

function genPickSubstanceByClass(params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.data.substances) throw new Error('substanceIndex not available in data');

  let candidates = [...data.data.substances];

  const raw = typeof params.substance_class === 'string' ? params.substance_class : undefined;
  if (raw) {
    const m = raw.match(/^\{(.+)\}$/);
    if (m) {
      const cls = pickRandom([...SUBSTANCE_CLASSES]);
      candidates = candidates.filter(s => s.class === cls);
    } else {
      candidates = candidates.filter(s => s.class === raw);
    }
  }

  // Amphoteric filter: keep only substances containing an amphoteric element
  if (params.amphoteric) {
    const amphotericSymbols = new Set(
      data.core.elements
        .filter(el => (el as unknown as Record<string, unknown>).amphoteric === true)
        .map(el => el.symbol),
    );
    candidates = candidates.filter(s =>
      [...amphotericSymbols].some(sym => s.formula.includes(sym)),
    );
  }

  const s = pickRandom(candidates);

  const result: SlotValues = {
    formula: s.formula,
    name: s.name_ru ?? '',
    substance_class: s.class,
    substance_subclass: s.subclass ?? '',
  };

  // When amphoteric filter is active, also provide reaction_partners
  if (params.amphoteric) {
    result.reaction_partners = ['acid', 'base'];
  }

  return result;
}

const REACTION_TYPE_TAGS = ['exchange', 'substitution', 'decomposition', 'redox'] as const;
const PRIMARY_TAGS_SET = new Set<string>(REACTION_TYPE_TAGS);

function genPickReaction(params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.data.reactions) throw new Error('reactions not available in data');

  let candidates = [...data.data.reactions];

  const raw = typeof params.type_tag === 'string' ? params.type_tag : undefined;
  if (raw) {
    const m = raw.match(/^\{(.+)\}$/);
    if (m) {
      const tag = pickRandom([...REACTION_TYPE_TAGS]);
      candidates = candidates.filter(r => r.type_tags.includes(tag));
    } else {
      candidates = candidates.filter(r => r.type_tags.includes(raw));
    }
  }

  const r = pickRandom(candidates);
  const reactionType = r.type_tags.find(t => PRIMARY_TAGS_SET.has(t)) ?? r.type_tags[0];

  // Extract reactants (left side of equation before →)
  const arrowIdx = r.equation.indexOf('→');
  const reactants = arrowIdx >= 0 ? r.equation.slice(0, arrowIdx).trim() : r.equation;

  // Driving force booleans
  const df = r.driving_forces ?? [];
  const hasPrecipitate = df.some(f => f === 'precipitate' || f === 'precipitation');
  const hasGas = df.some(f => f === 'gas_evolution' || f === 'gas');
  const hasWater = df.some(f => f === 'water_formation' || f === 'water');
  const hasWeakElectrolyte = df.includes('weak_electrolyte');

  const slots: SlotValues = {
    equation: r.equation,
    reaction_type: reactionType,
    reaction_id: r.reaction_id,
    reactants,
    heat_effect: r.heat_effect ?? 'unknown',
    has_precipitate: hasPrecipitate ? 1 : 0,
    has_gas: hasGas ? 1 : 0,
    has_water: hasWater ? 1 : 0,
    has_weak_electrolyte: hasWeakElectrolyte ? 1 : 0,
    will_occur: df.length > 0 ? 'yes' : 'no',
  };

  // Ionic data (if available)
  if (r.ionic) {
    if (r.ionic.net) slots.net_ionic = r.ionic.net;
    if (r.ionic.notes) slots.spectator_ions = r.ionic.notes;
  }

  // Redox data (if available)
  if (r.redox) {
    slots.oxidizer = r.redox.oxidizer.formula;
    slots.reducer = r.redox.reducer.formula;
  }

  return slots;
}

function genPickElementPosition(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  const candidates = data.core.elements.filter(
    el =>
      el.period >= 1 &&
      el.period <= 6 &&
      el.group >= 1 &&
      el.group <= 18 &&
      el.element_group !== 'lanthanide' &&
      el.element_group !== 'actinide',
  );

  const el = pickRandom(candidates);
  const maxOx =
    el.typical_oxidation_states.length > 0
      ? Math.max(...el.typical_oxidation_states)
      : 0;
  const minOx =
    el.typical_oxidation_states.length > 0
      ? Math.min(...el.typical_oxidation_states)
      : 0;

  return {
    element: el.symbol,
    period: el.period,
    group: el.group,
    max_oxidation_state: maxOx,
    min_oxidation_state: minOx,
  };
}

// ── Phase 3 generators ───────────────────────────────────────────

/** Klechkowski filling order for electron config computation. */
const KLECHKOWSKI_ORDER: [number, string, number][] = [
  [1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6],
  [4, 's', 2], [3, 'd', 10], [4, 'p', 6], [5, 's', 2], [4, 'd', 10],
  [5, 'p', 6], [6, 's', 2], [4, 'f', 14], [5, 'd', 10], [6, 'p', 6],
  [7, 's', 2], [5, 'f', 14], [6, 'd', 10], [7, 'p', 6],
];

/** Unicode superscript digit map. */
const SUPERSCRIPT_DIGITS: Record<number, string> = {
  0: '\u2070', 1: '\u00b9', 2: '\u00b2', 3: '\u00b3',
  4: '\u2074', 5: '\u2075', 6: '\u2076', 7: '\u2077',
  8: '\u2078', 9: '\u2079',
};

/** Convert an integer to Unicode superscript string. */
function toSuperscript(n: number): string {
  return String(n).split('').map(d => SUPERSCRIPT_DIGITS[Number(d)] ?? d).join('');
}

/** Compute electron configuration string from atomic number. */
function computeElectronConfig(Z: number): string {
  let remaining = Z;
  const parts: string[] = [];
  for (const [n, l, capacity] of KLECHKOWSKI_ORDER) {
    if (remaining <= 0) break;
    const electrons = Math.min(remaining, capacity);
    parts.push(`${n}${l}${toSuperscript(electrons)}`);
    remaining -= electrons;
  }
  return parts.join(' ');
}

function genPickElementForConfig(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  // Pick a random element with Z <= 36 (first 4 periods, covers d-block)
  const candidates = data.core.elements.filter(el => el.Z <= 36);
  if (candidates.length === 0) throw new Error('No elements with Z <= 36');
  const el = pickRandom(candidates);
  return {
    element: el.symbol,
    Z: el.Z,
    period: el.period,
    group: el.group,
    config: computeElectronConfig(el.Z),
  };
}

function genPickClassificationRule(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.classificationRules || data.rules.classificationRules.length === 0) {
    throw new Error('classificationRules not available in data');
  }
  const rule: ClassificationRule = pickRandom(data.rules.classificationRules);
  return {
    rule_id: rule.id,
    class_label: rule.class,
    subclass: rule.subclass ?? '',
    pattern: rule.pattern,
    description: rule.description_ru,
    example: rule.examples.length > 0 ? rule.examples[0] : '',
    examples: rule.examples,
  };
}

function genPickNamingRule(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.namingRules || data.rules.namingRules.length === 0) {
    throw new Error('namingRules not available in data');
  }
  const rule: NamingRule = pickRandom(data.rules.namingRules);
  const ex = rule.examples.length > 0 ? pickRandom(rule.examples) : null;
  return {
    rule_id: rule.id,
    class_label: rule.class,
    pattern: rule.pattern,
    template: rule.template_ru,
    example_formula: ex?.formula ?? '',
    example_name: ex?.name_ru ?? '',
  };
}

function genPickActivityPair(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.activitySeries || data.rules.activitySeries.length < 2) {
    throw new Error('activitySeries not available or too few entries');
  }
  const [a, b]: ActivitySeriesEntry[] = pickK(data.rules.activitySeries, 2);
  return {
    metalA: a.symbol,
    metalB: b.symbol,
    nameA: a.name_ru,
    nameB: b.name_ru,
    positionA: a.position,
    positionB: b.position,
    reduces_H_A: a.reduces_H ? 1 : 0,
    reduces_H_B: b.reduces_H ? 1 : 0,
    more_active: a.position < b.position ? a.symbol : b.symbol,
  };
}

function genPickQualitativeTest(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.qualitativeTests || data.rules.qualitativeTests.length === 0) {
    throw new Error('qualitativeTests not available in data');
  }
  const test: QualitativeTest = pickRandom(data.rules.qualitativeTests);
  return {
    target_id: test.target_id,
    target_name: test.target_name_ru,
    reagent_formula: test.reagent_formula,
    reagent_name: test.reagent_name_ru,
    observation: test.observation_ru,
    reaction_id: test.reaction_id ?? '',
  };
}

function genPickChainStep(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.data.geneticChains || data.data.geneticChains.length === 0) {
    throw new Error('geneticChains not available in data');
  }
  const chain: GeneticChain = pickRandom(data.data.geneticChains);
  if (chain.steps.length === 0) throw new Error('Empty chain steps');

  const stepIdx = Math.floor(Math.random() * chain.steps.length);
  const step: ChainStep = chain.steps[stepIdx];

  // Build chain_substances: all substances in the chain, with '?' at the gap position
  // A chain's substances = [step0.substance, step1.substance, ..., lastStep.next]
  const substances: string[] = chain.steps.map(s => s.substance);
  substances.push(chain.steps[chain.steps.length - 1].next);

  // Gap position: hide the "next" substance of the selected step (= position stepIdx + 1)
  const gapIndex = stepIdx + 1;
  const chainWithGap = substances.map((s, i) => (i === gapIndex ? '?' : s));

  return {
    chain_id: chain.chain_id,
    substance: step.substance,
    reagent: step.reagent,
    next: step.next,
    step_type: step.type,
    gap_index: gapIndex,
    chain_substances: chainWithGap,
  };
}

const ENERGY_MODES = ['rate', 'cat', 'eq'] as const;

function genPickEnergyCatalyst(params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.rules.energyCatalyst) {
    throw new Error('energyCatalyst not available in data');
  }
  const ec = data.rules.energyCatalyst;

  // Resolve mode
  let mode: string;
  const rawMode = typeof params.mode === 'string' ? params.mode : undefined;
  if (rawMode) {
    const m = rawMode.match(/^\{(.+)\}$/);
    mode = m ? pickRandom([...ENERGY_MODES]) : rawMode;
  } else {
    mode = pickRandom([...ENERGY_MODES]);
  }

  if (mode === 'rate') {
    if (ec.rate_factors.length === 0) throw new Error('No rate factors available');
    const factor: RateFactor = pickRandom(ec.rate_factors);
    return {
      mode: 'rate',
      factor_id: factor.factor_id,
      factor_name: factor.name_ru,
      factor_effect: factor.effect_ru,
      applies_to: factor.applies_to,
    };
  } else if (mode === 'cat') {
    if (ec.common_catalysts.length === 0) throw new Error('No common catalysts available');
    const cat: CommonCatalyst = pickRandom(ec.common_catalysts);
    return {
      mode: 'cat',
      catalyst: cat.catalyst,
      catalyst_name: cat.name_ru,
      catalyst_reaction: cat.reaction_ru,
    };
  } else {
    // eq
    if (ec.equilibrium_shifts.length === 0) throw new Error('No equilibrium shifts available');
    const shift: EquilibriumShift = pickRandom(ec.equilibrium_shifts);
    return {
      mode: 'eq',
      eq_factor: shift.factor,
      eq_shift: shift.shift_ru,
      eq_explanation: shift.explanation_ru,
    };
  }
}

function genPickCalcSubstance(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.data.calculations || data.data.calculations.calc_substances.length === 0) {
    throw new Error('calculations data not available');
  }
  const sub: CalcSubstance = pickRandom(data.data.calculations.calc_substances);

  // Generate random mass between 10 and 100 g (rounded to 1 decimal)
  const mass = Math.round((10 + Math.random() * 90) * 10) / 10;
  // amount = mass / M
  const amount = Math.round((mass / sub.M) * 10000) / 10000;

  return {
    formula: sub.formula,
    name: sub.name_ru,
    M: sub.M,
    mass,
    amount,
    composition: sub.composition.map(c => `${c.element}:${c.Ar}×${c.count}`),
  };
}

function genPickCalcReaction(_params: Record<string, unknown>, data: OntologyData): SlotValues {
  if (!data.data.calculations || data.data.calculations.calc_reactions.length === 0) {
    throw new Error('calculations data not available');
  }
  const rx: CalcReaction = pickRandom(data.data.calculations.calc_reactions);

  // Generate random given mass (10-100 g, rounded to 1 decimal)
  const givenMass = Math.round((10 + Math.random() * 90) * 10) / 10;
  // given moles = mass / M
  const givenMoles = givenMass / rx.given.M;
  // find moles = given_moles * (find_coeff / given_coeff)
  const findMoles = givenMoles * (rx.find.coeff / rx.given.coeff);
  // find mass = find_moles * find_M
  const findMass = Math.round(findMoles * rx.find.M * 100) / 100;

  return {
    equation: rx.equation_ru,
    given_formula: rx.given.formula,
    given_coeff: rx.given.coeff,
    given_M: rx.given.M,
    given_mass: givenMass,
    find_formula: rx.find.formula,
    find_coeff: rx.find.coeff,
    find_M: rx.find.M,
    find_mass: findMass,
  };
}

function genPickSolutionParams(_params: Record<string, unknown>, _data: OntologyData): SlotValues {
  // Random solute mass: 5-50 g (rounded to 1 decimal)
  const mSolute = Math.round((5 + Math.random() * 45) * 10) / 10;
  // Random solution mass: solute + 50..250 g of solvent (rounded to 1 decimal)
  const mSolution = Math.round((mSolute + 50 + Math.random() * 200) * 10) / 10;
  // omega (mass fraction) = m_solute / m_solution
  const omega = Math.round((mSolute / mSolution) * 10000) / 10000;

  return {
    m_solute: mSolute,
    m_solution: mSolution,
    omega,
  };
}

function genPickIonNomenclature(params: Record<string, unknown>, data: OntologyData): SlotValues {
  const rawMode = typeof params.mode === 'string' ? params.mode : undefined;
  const m = rawMode?.match(/^\{(.+)\}$/);
  const mode = m ? pickRandom(['default', 'acid_pair', 'paired']) : (rawMode ?? 'default');

  if (mode === 'acid_pair') {
    if (!data.rules.ionNomenclature || data.rules.ionNomenclature.acid_to_anion_pairs.length === 0) {
      throw new Error('ionNomenclature acid_to_anion_pairs not available');
    }
    const pair: AcidAnionPair = pickRandom(data.rules.ionNomenclature.acid_to_anion_pairs);
    // Look up the anion from ions data
    const anion: Ion | undefined = data.core.ions.find(i => i.id === pair.anion_id);
    return {
      mode: 'acid_pair',
      acid_formula: pair.acid,
      acid_name: pair.acid_name_ru,
      anion_id: pair.anion_id,
      anion_formula: anion?.formula ?? pair.anion_id,
      anion_name: anion?.name_ru ?? '',
    };
  } else if (mode === 'paired') {
    // Pick two ions with naming info for comparison
    const withNaming = data.core.ions.filter(i => i.naming);
    if (withNaming.length < 2) throw new Error('Not enough ions with naming data');
    const [ionA, ionB] = pickK(withNaming, 2);
    return {
      mode: 'paired',
      ionA_id: ionA.id,
      ionA_formula: ionA.formula,
      ionA_name: ionA.name_ru,
      ionA_suffix: ionA.naming!.suffix_ru,
      ionB_id: ionB.id,
      ionB_formula: ionB.formula,
      ionB_name: ionB.name_ru,
      ionB_suffix: ionB.naming!.suffix_ru,
    };
  } else {
    // default: pick a random suffix rule
    if (!data.rules.ionNomenclature || data.rules.ionNomenclature.suffix_rules.length === 0) {
      throw new Error('ionNomenclature suffix_rules not available');
    }
    const rule: SuffixRule = pickRandom(data.rules.ionNomenclature.suffix_rules);
    return {
      mode: 'default',
      rule_id: rule.id,
      condition: rule.condition,
      suffix_ru: rule.suffix_ru,
      suffix_en: rule.suffix_en,
      description: rule.description_ru,
      example: rule.examples.length > 0 ? rule.examples[0] : '',
      examples: rule.examples,
    };
  }
}

// ── Registry ─────────────────────────────────────────────────────

const GENERATORS: Record<string, (params: Record<string, unknown>, data: OntologyData) => SlotValues> = {
  'gen.pick_element_pair': genPickElementPair,
  'gen.pick_elements_same_period': genPickElementsSamePeriod,
  'gen.pick_oxidation_example': genPickOxidationExample,
  'gen.pick_ion_pair': genPickIonPair,
  'gen.pick_salt_pair': genPickSaltPair,
  'gen.pick_bond_example': genPickBondExample,
  'gen.pick_bond_pair': genPickBondPair,
  'gen.pick_substance_by_class': genPickSubstanceByClass,
  'gen.pick_reaction': genPickReaction,
  'gen.pick_element_position': genPickElementPosition,
  'gen.pick_element_for_config': genPickElementForConfig,
  'gen.pick_classification_rule': genPickClassificationRule,
  'gen.pick_naming_rule': genPickNamingRule,
  'gen.pick_activity_pair': genPickActivityPair,
  'gen.pick_qualitative_test': genPickQualitativeTest,
  'gen.pick_chain_step': genPickChainStep,
  'gen.pick_energy_catalyst': genPickEnergyCatalyst,
  'gen.pick_calc_substance': genPickCalcSubstance,
  'gen.pick_calc_reaction': genPickCalcReaction,
  'gen.pick_solution_params': genPickSolutionParams,
  'gen.pick_ion_nomenclature': genPickIonNomenclature,
};

export function runGenerator(
  generatorId: string,
  params: Record<string, unknown>,
  data: OntologyData,
): SlotValues {
  const fn = GENERATORS[generatorId];
  if (!fn) throw new Error(`Unknown generator: ${generatorId}`);
  return fn(params, data);
}
