# Reaction Cards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add rich reaction cards with ionic equations, driving forces, observations, and kinetics tips to the reactions page, plus 3 new exercise types covering OGE tasks 10-14, 20-22.

**Architecture:** Two-layer data — existing `reaction_templates.json` (type schemas) unchanged, new `reactions.json` (22 concrete reactions with full ionic/observation/kinetics data). New `ReactionCards` component replaces `ReactionCatalog`. Three new exercise generators work off `reactions.json`.

**Tech Stack:** Astro 5, React islands (`client:idle`), TypeScript strict, CSS modules (BEM), JSON data via `data-loader.ts`.

**Design doc:** `docs/plans/2026-02-16-reaction-cards-design.md`

---

### Task 1: Clean and transform reactions data

**Files:**
- Source: `data-src/reactions_bundle.v1.json` (read-only reference)
- Create: `data-src/reactions/reactions.json`

**What to do:**

Extract the `reactions` array from `reactions_bundle.v1.json` and save as `data-src/reactions/reactions.json`. Apply these transformations to each reaction object:

1. **Replace `skills` with `competencies`** — a `Record<string, 'P' | 'S'>` using this mapping:
   - `K_EXCHANGE_TYPES` → `reactions_exchange: 'P'`
   - `K_IONIC_EQUATIONS` → `reactions_exchange: 'P'` (merge with above)
   - `K_ACID_BASE` → `reactions_exchange: 'S'`
   - `K_SOLUBILITY_RULES` → `gas_precipitate_logic: 'P'`
   - `K_DRIVING_FORCES_GAS_PRECIP` → `gas_precipitate_logic: 'P'` (merge)
   - `K_REACTION_RATE` → `reaction_energy_profile: 'S'`
   - `K_AMPHOTERIC` → `amphoterism_logic: 'P'`
   - `K_ACIDIC_OXIDES` → `classification: 'S'`
   - `K_LAB_SAFETY` → drop (no competency)
   - When merging, `'P'` wins over `'S'`

2. **Fix `heat_effect: "mixed"`** — review each reaction and replace:
   - Neutralizations (`rx_neutral_*`) → `"exo"`
   - Carbonate + acid → `"exo"` (weakly exothermic)
   - Alkali + acidic oxide → `"exo"` (weakly)
   - CuO + HCl → `"exo"`
   - CaO + HCl → `"exo"`
   - Al(OH)₃ + HCl → `"exo"`
   - CaCO₃ decomposition → already `"endo"`, correct

3. **Fill missing `ionic.full`** — add full ionic equations for these reactions:
   - `rx_precip_03_cuoh2`: `"Cu²⁺ + SO₄²⁻ + 2Na⁺ + 2OH⁻ → Cu(OH)₂↓ + 2Na⁺ + SO₄²⁻"`
   - `rx_gas_01_nahco3_hcl`: `"Na⁺ + HCO₃⁻ + H⁺ + Cl⁻ → Na⁺ + Cl⁻ + H₂O + CO₂↑"`
   - `rx_gas_02_na2s_hcl`: `"2Na⁺ + S²⁻ + 2H⁺ + 2Cl⁻ → 2Na⁺ + 2Cl⁻ + H₂S↑"`
   - `rx_gas_03_nh4cl_naoh`: `"NH₄⁺ + Cl⁻ + Na⁺ + OH⁻ → Na⁺ + Cl⁻ + NH₃↑ + H₂O"`
   - `rx_amph_01_aloh3_hcl`: `"Al(OH)₃(s) + 3H⁺ + 3Cl⁻ → Al³⁺ + 3Cl⁻ + 3H₂O"`
   - `rx_amph_02_aloh3_naoh`: `"Al(OH)₃(s) + Na⁺ + OH⁻ → Na⁺ + [Al(OH)₄]⁻"`
   - `rx_exchange_01_cuo_hcl`: `"CuO(s) + 2H⁺ + 2Cl⁻ → Cu²⁺ + 2Cl⁻ + H₂O"`
   - `rx_exchange_02_caoh2_co2`: full is complex (Ca(OH)₂ partly dissociated); use `"Ca²⁺ + 2OH⁻ + CO₂ → CaCO₃↓ + H₂O"`
   - `rx_exchange_03_cao_hcl`: `"CaO(s) + 2H⁺ + 2Cl⁻ → Ca²⁺ + 2Cl⁻ + H₂O"`
   - `rx_neutral_03_ch3cooh_naoh`: `"CH₃COOH + Na⁺ + OH⁻ → Na⁺ + CH₃COO⁻ + H₂O"`
   - `rx_neutral_04_hno3_caoh2`: `"2H⁺ + 2NO₃⁻ + Ca²⁺ + 2OH⁻ → Ca²⁺ + 2NO₃⁻ + 2H₂O"`
   - `rx_precip_04_feoh3`: `"Fe³⁺ + 3Cl⁻ + 3Na⁺ + 3OH⁻ → Fe(OH)₃↓ + 3Na⁺ + 3Cl⁻"`
   - `rx_precip_05_caco3_from_salts`: `"2Na⁺ + CO₃²⁻ + Ca²⁺ + 2Cl⁻ → CaCO₃↓ + 2Na⁺ + 2Cl⁻"`
   - `rx_precip_06_pbi2`: `"Pb²⁺ + 2NO₃⁻ + 2K⁺ + 2I⁻ → PbI₂↓ + 2K⁺ + 2NO₃⁻"`
   - `rx_precip_07_h2so4_bacl2`: `"2H⁺ + SO₄²⁻ + Ba²⁺ + 2Cl⁻ → BaSO₄↓ + 2H⁺ + 2Cl⁻"`
   - `rx_precip_08_caso4`: `"Ca²⁺ + 2Cl⁻ + 2Na⁺ + SO₄²⁻ → CaSO₄↓ + 2Na⁺ + 2Cl⁻"`
   - `rx_gas_04_na2so3_hcl`: `"2Na⁺ + SO₃²⁻ + 2H⁺ + 2Cl⁻ → 2Na⁺ + 2Cl⁻ + SO₂↑ + H₂O"`
   - `rx_acid_oxide_01_naoh_co2`: `"2Na⁺ + 2OH⁻ + CO₂ → 2Na⁺ + CO₃²⁻ + H₂O"`
   - `rx_acid_oxide_02_koh_so2`: `"2K⁺ + 2OH⁻ + SO₂ → 2K⁺ + SO₃²⁻ + H₂O"`

4. **Remove V2 fields** — delete `bond_energy_view` and `energy_profile` if present in any reaction.

5. **Normalize missing optional fields** — ensure every reaction has `safety_notes: []` (not missing), `observations.gas: []`, `observations.precipitate: []` where absent.

**Step 1:** Create `data-src/reactions/` directory and write the cleaned `reactions.json` array (22 objects).

**Step 2:** Verify with `npm run build:data`

Expected: Build passes (reactions.json is not yet in pipeline, so no effect yet — just verifying existing pipeline still works).

**Step 3:** Commit

```bash
git add data-src/reactions/reactions.json
git commit -m "data: add cleaned reactions bundle (22 reactions with ionic equations)"
```

---

### Task 2: Create Reaction type

**Files:**
- Create: `src/types/reaction.ts`

**Step 1:** Create the type file:

```typescript
import type { CompetencyId } from './competency';

export interface ReactionMolecularItem {
  formula: string;
  name?: string;
  coeff: number;
}

export interface ReactionIonic {
  full?: string;
  net?: string;
  notes?: string;
}

export interface ReactionObservations {
  gas?: string[];
  precipitate?: string[];
  heat?: string;
  color_change?: string;
  smell?: string;
  other?: string[];
}

export interface ReactionRateTips {
  how_to_speed_up: string[];
  what_slows_down?: string[];
}

export type HeatEffect = 'exo' | 'endo' | 'negligible' | 'unknown';

export interface Reaction {
  reaction_id: string;
  title: string;
  equation: string;
  template_id?: string;
  phase: { medium: 'aq' | 's' | 'l' | 'g' | 'mixed'; notes?: string };
  conditions?: { temperature?: string; catalyst?: string; pressure?: string; excess?: string };
  type_tags: string[];
  driving_forces: string[];
  molecular: {
    reactants: ReactionMolecularItem[];
    products: ReactionMolecularItem[];
  };
  ionic: ReactionIonic;
  observations: ReactionObservations;
  rate_tips: ReactionRateTips;
  heat_effect: HeatEffect;
  safety_notes: string[];
  competencies: Partial<Record<CompetencyId, 'P' | 'S'>>;
  oge?: { topics?: string[]; typical_tasks?: string[] };
}
```

**Step 2:** Verify: `npm run build` (type is created but not used yet — should pass)

**Step 3:** Commit

```bash
git add src/types/reaction.ts
git commit -m "types: add Reaction type for reaction cards"
```

---

### Task 3: Integrate reactions into build pipeline

**Files:**
- Modify: `scripts/build-data.mjs` (lines 64-86: add loading, lines 146-176: add copying)
- Modify: `scripts/lib/generate-manifest.mjs` (lines 14-47: add reactions entrypoint)
- Modify: `src/types/manifest.ts` (lines 1-12: add reactions field, lines 14-20: add reactions_count)

**Step 1:** In `scripts/build-data.mjs`:

After line 75 (loading substances), add:
```javascript
const reactions = await loadJson(join(DATA_SRC, 'reactions', 'reactions.json'));
```

After line 86 (console.log templates), add:
```javascript
console.log(`  ${reactions.length} reactions`);
```

After line 175 (writing periodic-table-exercises), add:
```javascript
await mkdir(join(bundleDir, 'reactions'), { recursive: true });
await writeFile(join(bundleDir, 'reactions', 'reactions.json'), JSON.stringify(reactions));
```

In the `stats` object (line 183-189), add:
```javascript
reactions_count: reactions.length,
```

**Step 2:** In `scripts/lib/generate-manifest.mjs`:

In the `entrypoints` object, after `exercises` block (line 41), add:
```javascript
reactions: 'reactions/reactions.json',
```

**Step 3:** In `src/types/manifest.ts`:

Add to `ManifestEntrypoints` (after `exercises?`):
```typescript
reactions?: string;
```

Add to `ManifestStats`:
```typescript
reactions_count?: number;
```

**Step 4:** Verify: `npm run build:data`

Expected output includes: `22 reactions` in the loading summary. Build completes. Check `public/data/latest/manifest.json` contains `reactions` key.

**Step 5:** Commit

```bash
git add scripts/build-data.mjs scripts/lib/generate-manifest.mjs src/types/manifest.ts
git commit -m "pipeline: integrate reactions.json into data build"
```

---

### Task 4: Add loadReactions() to data-loader

**Files:**
- Modify: `src/lib/data-loader.ts` (add import + function at end)

**Step 1:** Add import at top (line 1 area):
```typescript
import type { Reaction } from '../types/reaction';
```

**Step 2:** Add loader function at end of file (after `loadReactionTemplates`):
```typescript
/** Load all reactions (concrete reaction cards with ionic equations, observations, kinetics). */
export async function loadReactions(): Promise<Reaction[]> {
  const manifest = await getManifest();
  const path = manifest.entrypoints.reactions;

  if (!path) {
    throw new Error(
      'Reactions not found in manifest. Expected key "reactions" in entrypoints.',
    );
  }

  return loadDataFile<Reaction[]>(path);
}
```

**Step 3:** Verify: `npm run build`

Expected: Passes. The function exists but is not called yet.

**Step 4:** Commit

```bash
git add src/lib/data-loader.ts
git commit -m "loader: add loadReactions() for reaction cards data"
```

---

### Task 5: Build ReactionCards component

**Files:**
- Create: `src/features/reactions/ReactionCards.tsx`
- Modify: `src/features/reactions/ReactionsPage.tsx` (replace ReactionCatalog import)
- Modify: `src/features/reactions/reactions.css` (add card tab styles)

**Step 1:** Create `src/features/reactions/ReactionCards.tsx`:

The component should:
- Load reactions via `loadReactions()` on mount
- Show filter buttons by type_tags: Все | Нейтрализация | Осадок | Газ | Амфотерность | Оксиды | Разложение
- Each reaction is a collapsible card (like existing `ReactionCard` pattern in `ReactionCatalog.tsx`)
- When expanded, show 4 tabs: Молекулярное | Ионное | Почему идёт | Как ускорить

Filter mapping (type_tag → label):
```typescript
const TAG_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'neutralization', label: 'Нейтрализация' },
  { value: 'precipitation', label: 'Осадок' },
  { value: 'gas_evolution', label: 'Газ' },
  { value: 'amphoteric', label: 'Амфотерность' },
  { value: 'acidic_oxide', label: 'Оксиды' },
  { value: 'decomposition', label: 'Разложение' },
];
```

Tab content:

**Молекулярное tab:**
- `reaction.equation` as the main equation (monospace)
- List reactants/products with names: "HCl — соляная кислота"
- Phase badge: `reaction.phase.medium` + notes
- Conditions if present

**Ионное tab:**
- `ionic.full` labeled "Полное ионное:"
- `ionic.net` labeled "Сокращённое ионное:" (highlighted/bold)
- `ionic.notes` if present (italics, smaller)

**Почему идёт tab:**
- Driving forces as badges with icons:
  - `precipitation` → "↓ Осадок"
  - `gas_release` → "↑ Газ"
  - `water_formation` → "💧 Вода"
  - `weak_electrolyte` → "Слабый электролит"
  - `complex_formation` → "Комплекс"
- Observations section: gas, precipitate, heat, smell, color_change, other
- Heat effect badge: exo=green "Экзотермическая", endo=red "Эндотермическая", unknown=gray

**Как ускорить tab:**
- `rate_tips.how_to_speed_up` as bullet list
- `rate_tips.what_slows_down` as separate list "Что замедляет:"
- `safety_notes` if present, in a warning box

**Step 2:** Modify `ReactionsPage.tsx` — replace `ReactionCatalog` import and usage:

```typescript
import ReactionCards from './ReactionCards';
// Remove: import ReactionCatalog from './ReactionCatalog';

export default function ReactionsPage() {
  return (
    <div className="reactions-page">
      <ReactionCards />
      <ReactionTheoryPanel />
      <PracticeSection />
    </div>
  );
}
```

**Step 3:** Add CSS for tabs in `reactions.css`. Reuse existing `.rxn-card` and `.rxn-catalog` class patterns. Add:
- `.rxn-tabs` — tab button row inside card body
- `.rxn-tab-btn` / `.rxn-tab-btn--active` — tab buttons
- `.rxn-tab-content` — tab panel
- `.rxn-driving-badge` — driving force badge (small pill with icon)
- `.rxn-heat-badge` / `.rxn-heat-badge--exo` / `--endo` — heat effect badge
- `.rxn-ionic-full` / `.rxn-ionic-net` — ionic equation display
- `.rxn-safety` — safety warning box
- `.rxn-observation` — observation list item

Keep reusing existing CSS variables. Follow BEM naming convention matching existing code.

**Step 4:** Verify: `npm run build`

Expected: Build passes. Page renders at `/reactions/`.

**Step 5:** Verify visually: `npm run dev`, open `http://localhost:4321/reactions/`

Check: filters work, cards expand, all 4 tabs show correct content, mobile responsive.

**Step 6:** Commit

```bash
git add src/features/reactions/ReactionCards.tsx src/features/reactions/ReactionsPage.tsx src/features/reactions/reactions.css
git commit -m "feat: add reaction cards with ionic equations and driving forces"
```

---

### Task 6: Add new exercise types

**Files:**
- Modify: `src/features/reactions/practice/generate-exercises.ts`

The `GeneratorFn` type needs a new parameter `reactions: Reaction[]`. Update the type and all existing generators to accept (and ignore) it.

**Step 1:** Add import at top:
```typescript
import type { Reaction } from '../../../types/reaction';
```

**Step 2:** Update `GeneratorFn` type:
```typescript
type GeneratorFn = (
  templates: ReactionTemplate[],
  solubility: SolubilityEntry[],
  activitySeries: ActivitySeriesEntry[],
  applicabilityRules: ApplicabilityRule[],
  reactions: Reaction[],
) => Exercise;
```

**Step 3:** Update all existing generator function signatures to accept 5th parameter `_reactions: Reaction[]` (unused in existing generators). Update `generateExercise` function to pass `reactions` through.

**Step 4:** Add generator `match_ionic_equation`:

```typescript
match_ionic_equation(_templates, _solubility, _activitySeries, _applicabilityRules, reactions) {
  // Filter reactions that have ionic.net
  const withIonic = reactions.filter(r => r.ionic.net);
  if (withIonic.length < 4) throw new Error('Not enough reactions with ionic equations');

  const target = pick(withIonic);
  const correctNet = target.ionic.net!;

  // Pick 2 distractor ionic.net from other reactions
  const others = withIonic.filter(r => r.reaction_id !== target.reaction_id && r.ionic.net !== correctNet);
  const shuffledOthers = [...others].sort(() => Math.random() - 0.5);
  const distractorNets = shuffledOthers.slice(0, 2).map(r => r.ionic.net!);
  distractorNets.push('Реакция не идёт (ионное уравнение не составляется)');

  const options = shuffleOptions([
    { id: 'correct', text: correctNet },
    ...distractorNets.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'match_ionic_equation',
    question: `Сокращённое ионное уравнение для реакции: ${target.equation}`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `Полное ионное: ${target.ionic.full ?? '—'}. Сокращённое: ${correctNet}.${target.ionic.notes ? ' ' + target.ionic.notes : ''}`,
    competencyMap: { reactions_exchange: 'P' },
  };
},
```

**Step 5:** Add generator `identify_spectator_ions`:

```typescript
identify_spectator_ions(_templates, _solubility, _activitySeries, _applicabilityRules, reactions) {
  // Need reactions with both full and net ionic (to extract spectators)
  const withBoth = reactions.filter(r => r.ionic.full && r.ionic.net);
  if (withBoth.length === 0) throw new Error('No reactions with full ionic equations');

  const target = pick(withBoth);
  const full = target.ionic.full!;
  const net = target.ionic.net!;

  // Extract ions from full that don't appear in net (spectators)
  // Simple heuristic: find ion patterns like Na⁺, Cl⁻, SO₄²⁻, etc.
  const ionPattern = /[A-Z][a-z]?(?:[\d₀-₉]*)(?:[⁺⁻²³⁴]?[⁺⁻])/g;
  const fullIons = new Set(full.match(ionPattern) ?? []);
  const netIons = new Set(net.match(ionPattern) ?? []);
  const spectators = [...fullIons].filter(ion => !netIons.has(ion));

  if (spectators.length === 0) {
    // Fallback: just use a different exercise
    return generators.match_ionic_equation(_templates, _solubility, _activitySeries, _applicabilityRules, reactions);
  }

  const correctText = spectators.join(', ');

  // Generate distractors by mixing spectator and non-spectator ions
  const nonSpectators = [...netIons];
  const distractors: string[] = [];

  if (nonSpectators.length >= 1 && spectators.length >= 1) {
    distractors.push([nonSpectators[0], spectators[0]].join(', '));
  }
  if (nonSpectators.length >= 2) {
    distractors.push(nonSpectators.slice(0, 2).join(', '));
  }
  distractors.push('Ионов-наблюдателей нет');

  const options = shuffleOptions([
    { id: 'correct', text: correctText },
    ...distractors.slice(0, 3).map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'identify_spectator_ions',
    question: `Ионы-наблюдатели в реакции: ${target.equation}`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `Полное: ${full}. Сокращённое: ${net}. Ионы ${correctText} не изменились — они наблюдатели.`,
    competencyMap: { reactions_exchange: 'P', electrolyte_logic: 'S' },
  };
},
```

**Step 6:** Add generator `predict_observation`:

```typescript
predict_observation(_templates, _solubility, _activitySeries, _applicabilityRules, reactions) {
  // Build observation descriptions
  function describeObservation(r: Reaction): string {
    const parts: string[] = [];
    if (r.observations.precipitate?.length) {
      parts.push(`Выпадает осадок: ${r.observations.precipitate.join(', ')}`);
    }
    if (r.observations.gas?.length) {
      parts.push(`Выделяется газ: ${r.observations.gas.join(', ')}`);
    }
    if (r.observations.smell) {
      parts.push(r.observations.smell);
    }
    if (r.observations.color_change) {
      parts.push(r.observations.color_change);
    }
    if (parts.length === 0 && r.observations.heat) {
      parts.push(r.observations.heat);
    }
    if (parts.length === 0 && r.observations.other?.length) {
      parts.push(r.observations.other[0]);
    }
    return parts.join('; ') || 'Видимых признаков нет';
  }

  const target = pick(reactions);
  const correctObs = describeObservation(target);

  // Distractor observations from other reactions
  const others = reactions
    .filter(r => r.reaction_id !== target.reaction_id)
    .map(r => describeObservation(r))
    .filter(obs => obs !== correctObs && obs !== 'Видимых признаков нет');

  const uniqueOthers = [...new Set(others)].sort(() => Math.random() - 0.5);
  const distractors = uniqueOthers.slice(0, 2);
  distractors.push('Видимых признаков нет');

  const reactantNames = target.molecular.reactants
    .map(r => r.name ?? r.formula)
    .join(' и ');

  const options = shuffleOptions([
    { id: 'correct', text: correctObs },
    ...distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'predict_observation',
    question: `Что наблюдается при смешивании ${reactantNames}?`,
    format: 'multiple_choice',
    options,
    correctId: 'correct',
    explanation: `${target.equation}. ${correctObs}.`,
    competencyMap: { gas_precipitate_logic: 'P', qualitative_analysis_logic: 'S' },
  };
},
```

**Step 7:** Update `generateExercise` function signature:

```typescript
export function generateExercise(
  templates: ReactionTemplate[],
  solubility: SolubilityEntry[],
  activitySeries: ActivitySeriesEntry[],
  applicabilityRules: ApplicabilityRule[],
  reactions: Reaction[],
  type?: string,
): Exercise {
  const t = type ?? pick(EXERCISE_TYPES);
  const gen = generators[t];
  if (!gen) throw new Error(`Unknown exercise type: ${t}`);
  return gen(templates, solubility, activitySeries, applicabilityRules, reactions);
}
```

**Step 8:** Verify: `npm run build`

Expected: Passes. Type-checks all generators.

**Step 9:** Commit

```bash
git add src/features/reactions/practice/generate-exercises.ts
git commit -m "feat: add 3 exercise types — ionic equations, spectator ions, observations"
```

---

### Task 7: Wire PracticeSection to load reactions

**Files:**
- Modify: `src/features/reactions/practice/PracticeSection.tsx`

**Step 1:** Add import:
```typescript
import type { Reaction } from '../../../types/reaction';
import { loadReactions } from '../../../lib/data-loader';
```

**Step 2:** Add state:
```typescript
const [reactions, setReactions] = useState<Reaction[]>([]);
```

**Step 3:** Add `loadReactions()` to the `Promise.all` in `useEffect` (line 42-66):

Update to load 7 things:
```typescript
Promise.all([
  loadReactionTemplates(),
  loadSolubilityRules(),
  loadActivitySeries(),
  loadApplicabilityRules(),
  loadBktParams(),
  loadCompetencies(),
  loadReactions(),
]).then(([tmpl, sol, act, appl, params, comps, rxns]) => {
  // ... existing setters ...
  setReactions(rxns);
  // ...
});
```

**Step 4:** Update `nextExercise` callback to pass `reactions`:

```typescript
const nextExercise = useCallback(() => {
  if (templates.length === 0 || solubility.length === 0 || activitySeries.length === 0) return;
  setExercise(generateExercise(templates, solubility, activitySeries, applicabilityRules, reactions));
  setCount(c => c + 1);
}, [templates, solubility, activitySeries, applicabilityRules, reactions]);
```

**Step 5:** Expand `COMPETENCY_IDS` to track new competencies:

```typescript
const COMPETENCY_IDS = [
  'reactions_exchange',
  'gas_precipitate_logic',
  'reaction_energy_profile',
  'qualitative_analysis_logic',
  'electrolyte_logic',
] as const;
```

Update `mastered` check to include new competencies:
```typescript
const mastered = COMPETENCY_IDS.every(id => (pLevels.get(id) ?? 0) >= 0.8);
```

**Step 6:** Verify: `npm run build`

Expected: Passes.

**Step 7:** Verify visually: `npm run dev`, open `/reactions/`, do exercises. All 9 exercise types should randomly appear. New types show ionic equations and observations.

**Step 8:** Commit

```bash
git add src/features/reactions/practice/PracticeSection.tsx
git commit -m "feat: wire PracticeSection to load reactions and use new exercise types"
```

---

### Task 8: Final verification and cleanup

**Step 1:** Run full build: `npm run build`

Expected: Clean build, no warnings.

**Step 2:** Preview: `npm run preview`, open `/reactions/`

Check:
- [ ] Reaction cards load and display correctly
- [ ] All 4 tabs work in each card
- [ ] Filters filter correctly
- [ ] Exercises include new types (may need to click through 10+ to see all)
- [ ] BKT updates work for new competencies
- [ ] Mobile responsive (resize window to 375px)

**Step 3:** Delete the original bundle file (no longer needed):

```bash
git rm data-src/reactions_bundle.v1.json
git commit -m "chore: remove original reactions bundle (replaced by data-src/reactions/)"
```
