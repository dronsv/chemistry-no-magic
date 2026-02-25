import type { BondExampleEntry } from '../../types/bond';
import type { Element } from '../../types/element';
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

  const s = pickRandom(candidates);
  return {
    formula: s.formula,
    substance_class: s.class,
    substance_subclass: s.subclass ?? '',
  };
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

  return {
    equation: r.equation,
    reaction_type: reactionType,
    reaction_id: r.reaction_id,
  };
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

  return {
    element: el.symbol,
    period: el.period,
    group: el.group,
    max_oxidation_state: maxOx,
  };
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
