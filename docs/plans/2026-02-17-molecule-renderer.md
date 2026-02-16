# MoleculeView Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a universal `<MoleculeView>` React SVG component that renders 2D Lewis structures with toggleable layers (bonds, oxidation states, formal charges, lone pairs).

**Architecture:** Structure data lives in `data-src/structures/{id}.json` — one file per molecule, coordinates in abstract units. The component takes a `MoleculeStructure` object and renders layered SVG with interactive hover/click on atoms. Each layer can be toggled on/off and locked for exercises.

**Tech Stack:** React, SVG, TypeScript, Astro data pipeline

---

### Task 1: Types — `MoleculeStructure`

**Files:**
- Create: `src/types/molecule.ts`

**Step 1: Create the type file**

```ts
// src/types/molecule.ts

export interface MoleculeAtom {
  id: string;            // unique within structure, e.g. "S1", "O2"
  symbol: string;        // element symbol
  x: number;             // abstract coordinate
  y: number;
  ox?: number;           // oxidation state
  lonePairs?: number;    // number of lone pairs (renderer places dots automatically)
  label?: string;        // optional override label (e.g. for ions: "Na⁺")
}

export interface MoleculeBond {
  from: string;          // atom id
  to: string;            // atom id
  order: 1 | 2 | 3;     // single, double, triple
  dative?: boolean;      // coordinate/dative bond (arrow instead of line)
}

export interface MoleculePolarity {
  from: string;          // atom id (of bond start)
  to: string;            // atom id (of bond end)
  deltaPlus: string;     // atom id that is δ+
  deltaMinus: string;    // atom id that is δ−
}

export interface MoleculeStructure {
  id: string;            // matches substance id
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
  polarity?: MoleculePolarity[];
}

/** Which layers are visible */
export interface MoleculeLayerVisibility {
  bonds?: boolean;
  oxStates?: boolean;
  charges?: boolean;
  lonePairs?: boolean;
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: No errors related to molecule.ts

**Step 3: Commit**

```bash
git add src/types/molecule.ts
git commit -m "feat(molecule): add MoleculeStructure types"
```

---

### Task 2: Sample data — 5 starter structures

**Files:**
- Create: `data-src/structures/h2o.json`
- Create: `data-src/structures/hcl.json`
- Create: `data-src/structures/h2so4.json`
- Create: `data-src/structures/nacl.json`
- Create: `data-src/structures/ch4.json`

**Step 1: Create h2o.json**

```json
{
  "id": "h2o",
  "atoms": [
    { "id": "O1", "symbol": "O", "x": 0, "y": 0, "ox": -2, "lonePairs": 2 },
    { "id": "H1", "symbol": "H", "x": -0.96, "y": 0.6, "ox": 1, "lonePairs": 0 },
    { "id": "H2", "symbol": "H", "x": 0.96, "y": 0.6, "ox": 1, "lonePairs": 0 }
  ],
  "bonds": [
    { "from": "O1", "to": "H1", "order": 1 },
    { "from": "O1", "to": "H2", "order": 1 }
  ],
  "polarity": [
    { "from": "O1", "to": "H1", "deltaPlus": "H1", "deltaMinus": "O1" },
    { "from": "O1", "to": "H2", "deltaPlus": "H2", "deltaMinus": "O1" }
  ]
}
```

**Step 2: Create hcl.json**

```json
{
  "id": "hcl",
  "atoms": [
    { "id": "H1", "symbol": "H", "x": -0.7, "y": 0, "ox": 1, "lonePairs": 0 },
    { "id": "Cl1", "symbol": "Cl", "x": 0.7, "y": 0, "ox": -1, "lonePairs": 3 }
  ],
  "bonds": [
    { "from": "H1", "to": "Cl1", "order": 1 }
  ],
  "polarity": [
    { "from": "H1", "to": "Cl1", "deltaPlus": "H1", "deltaMinus": "Cl1" }
  ]
}
```

**Step 3: Create h2so4.json**

```json
{
  "id": "h2so4",
  "atoms": [
    { "id": "S1",  "symbol": "S",  "x": 0,    "y": 0,    "ox": 6,  "lonePairs": 0 },
    { "id": "O1",  "symbol": "O",  "x": 0,    "y": -1.3, "ox": -2, "lonePairs": 2 },
    { "id": "O2",  "symbol": "O",  "x": 0,    "y": 1.3,  "ox": -2, "lonePairs": 2 },
    { "id": "O3",  "symbol": "O",  "x": -1.3, "y": 0,    "ox": -2, "lonePairs": 2 },
    { "id": "O4",  "symbol": "O",  "x": 1.3,  "y": 0,    "ox": -2, "lonePairs": 2 },
    { "id": "H1",  "symbol": "H",  "x": -2.3, "y": 0,    "ox": 1,  "lonePairs": 0 },
    { "id": "H2",  "symbol": "H",  "x": 2.3,  "y": 0,    "ox": 1,  "lonePairs": 0 }
  ],
  "bonds": [
    { "from": "S1", "to": "O1", "order": 2 },
    { "from": "S1", "to": "O2", "order": 2 },
    { "from": "S1", "to": "O3", "order": 1 },
    { "from": "S1", "to": "O4", "order": 1 },
    { "from": "O3", "to": "H1", "order": 1 },
    { "from": "O4", "to": "H2", "order": 1 }
  ],
  "polarity": [
    { "from": "O3", "to": "H1", "deltaPlus": "H1", "deltaMinus": "O3" },
    { "from": "O4", "to": "H2", "deltaPlus": "H2", "deltaMinus": "O4" }
  ]
}
```

**Step 4: Create nacl.json (ionic — no covalent bonds)**

```json
{
  "id": "nacl",
  "atoms": [
    { "id": "Na1", "symbol": "Na", "x": -0.8, "y": 0, "ox": 1, "lonePairs": 0, "label": "Na⁺" },
    { "id": "Cl1", "symbol": "Cl", "x": 0.8,  "y": 0, "ox": -1, "lonePairs": 4, "label": "Cl⁻" }
  ],
  "bonds": []
}
```

**Step 5: Create ch4.json**

```json
{
  "id": "ch4",
  "atoms": [
    { "id": "C1",  "symbol": "C", "x": 0,     "y": 0,    "ox": -4, "lonePairs": 0 },
    { "id": "H1",  "symbol": "H", "x": 0,     "y": -1.1, "ox": 1,  "lonePairs": 0 },
    { "id": "H2",  "symbol": "H", "x": 1.1,   "y": 0,    "ox": 1,  "lonePairs": 0 },
    { "id": "H3",  "symbol": "H", "x": 0,     "y": 1.1,  "ox": 1,  "lonePairs": 0 },
    { "id": "H4",  "symbol": "H", "x": -1.1,  "y": 0,    "ox": 1,  "lonePairs": 0 }
  ],
  "bonds": [
    { "from": "C1", "to": "H1", "order": 1 },
    { "from": "C1", "to": "H2", "order": 1 },
    { "from": "C1", "to": "H3", "order": 1 },
    { "from": "C1", "to": "H4", "order": 1 }
  ]
}
```

**Step 6: Commit**

```bash
git add data-src/structures/
git commit -m "feat(molecule): add 5 starter molecule structures (H₂O, HCl, H₂SO₄, NaCl, CH₄)"
```

---

### Task 3: Data pipeline — structures in build

**Files:**
- Modify: `scripts/build-data.mjs`
- Modify: `scripts/lib/generate-manifest.mjs`
- Modify: `src/types/manifest.ts`
- Modify: `src/lib/data-loader.ts`

**Step 1: Add `structures` to ManifestEntrypoints in `src/types/manifest.ts`**

Add after line `reactions?: string;`:

```ts
  structures?: string;
```

**Step 2: Add loader in `src/lib/data-loader.ts`**

Import the type at the top:

```ts
import type { MoleculeStructure } from '../types/molecule';
```

Add function at the end of the file:

```ts
/** Load a molecule structure by substance ID. */
export async function loadStructure(id: string): Promise<MoleculeStructure> {
  const manifest = await getManifest();
  const basePath = manifest.entrypoints.structures;

  if (!basePath) {
    throw new Error('Structures not found in manifest. Expected key "structures" in entrypoints.');
  }

  return loadDataFile<MoleculeStructure>(`${basePath}/${id}.json`);
}
```

**Step 3: Load and copy structures in `scripts/build-data.mjs`**

After the line that loads `elementGroups` (~line 87), add:

```js
  // Load structures
  const structuresDir = join(DATA_SRC, 'structures');
  let structureFiles = [];
  try {
    const files = await readdir(structuresDir);
    structureFiles = files.filter(f => f.endsWith('.json'));
    for (const f of structureFiles) {
      await loadJson(join(structuresDir, f)); // validate JSON
    }
  } catch { /* no structures yet — that's ok */ }
  if (structureFiles.length > 0) {
    console.log(`  ${structureFiles.length} molecule structures`);
  }
```

In the copy section (after reactions mkdir), add:

```js
  if (structureFiles.length > 0) {
    await mkdir(join(bundleDir, 'structures'), { recursive: true });
    for (const f of structureFiles) {
      const data = await loadJson(join(structuresDir, f));
      await writeFile(join(bundleDir, 'structures', f), JSON.stringify(data));
    }
  }
```

**Step 4: Add to manifest in `scripts/lib/generate-manifest.mjs`**

After line `reactions: 'reactions/reactions.json',` add:

```js
      structures: 'structures',
```

**Step 5: Verify**

Run: `npm run build`
Expected: Build passes, output includes "5 molecule structures"

**Step 6: Commit**

```bash
git add scripts/build-data.mjs scripts/lib/generate-manifest.mjs src/types/manifest.ts src/lib/data-loader.ts
git commit -m "feat(molecule): add structures to data pipeline and loader"
```

---

### Task 4: Core SVG renderer — atoms + bonds

**Files:**
- Create: `src/components/MoleculeView.tsx`
- Create: `src/components/molecule-view.css`

This is the main task. Build the component that renders atoms and bond lines.

**Step 1: Create `src/components/molecule-view.css`**

```css
/* ---- MoleculeView ---- */

.mol-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.mol-view--inline {
  display: inline-flex;
  vertical-align: middle;
  gap: 0;
}

.mol-view__svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.mol-view--inline .mol-view__svg {
  width: auto;
  height: 1.4em;
}

.mol-view--sm .mol-view__svg { max-width: 180px; }
.mol-view--md .mol-view__svg { max-width: 320px; }
.mol-view--lg .mol-view__svg { max-width: 500px; }

/* Layers use CSS transitions for smooth toggle */
.mol-layer { transition: opacity 0.2s ease; }
.mol-layer--hidden { opacity: 0; pointer-events: none; }

/* Atom labels */
.mol-atom-label {
  font-weight: 700;
  fill: currentColor;
  user-select: none;
}

.mol-atom-label--interactive {
  cursor: pointer;
}

.mol-atom-label--interactive:hover {
  fill: var(--color-primary, #2563eb);
}

/* Bond lines */
.mol-bond {
  stroke: var(--color-text, #1e293b);
  stroke-linecap: round;
  fill: none;
}

/* Oxidation state labels above atoms */
.mol-ox {
  font-size: 0.65em;
  font-weight: 600;
  text-anchor: middle;
}

.mol-ox--positive { fill: #dc2626; }
.mol-ox--negative { fill: #2563eb; }
.mol-ox--zero { fill: #6b7280; }

/* Charge labels (δ+/δ−) on bonds */
.mol-charge {
  font-size: 0.55em;
  font-weight: 600;
}
.mol-charge--plus { fill: #dc2626; }
.mol-charge--minus { fill: #2563eb; }

/* Lone pair dots */
.mol-lone-pair {
  fill: var(--color-text-muted, #64748b);
}

/* Toggle bar */
.mol-toggles {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: center;
}

.mol-toggle-btn {
  font-size: 0.6875rem;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 1rem;
  background: var(--color-bg, #fff);
  color: var(--color-text-muted, #64748b);
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1.4;
}

.mol-toggle-btn--active {
  background: var(--color-primary, #2563eb);
  color: #fff;
  border-color: var(--color-primary, #2563eb);
}

.mol-toggle-btn--locked {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Hover tooltip */
.mol-tooltip {
  position: fixed;
  padding: 0.35rem 0.6rem;
  background: var(--color-text, #1e293b);
  color: var(--color-bg, #fff);
  font-size: 0.75rem;
  border-radius: 0.25rem;
  pointer-events: none;
  z-index: 100;
  white-space: nowrap;
  line-height: 1.4;
}

@media (prefers-color-scheme: dark) {
  .mol-bond { stroke: #e2e8f0; }
  .mol-lone-pair { fill: #94a3b8; }
}
```

**Step 2: Create `src/components/MoleculeView.tsx`**

```tsx
import { useState, useCallback, useMemo, useRef } from 'react';
import type {
  MoleculeStructure,
  MoleculeAtom,
  MoleculeBond,
  MoleculePolarity,
  MoleculeLayerVisibility,
} from '../types/molecule';
import './molecule-view.css';

type Size = 'inline' | 'sm' | 'md' | 'lg';

interface MoleculeViewProps {
  structure: MoleculeStructure;
  layers?: MoleculeLayerVisibility;
  locked?: MoleculeLayerVisibility;
  size?: Size;
  interactive?: boolean;
  onAtomClick?: (symbol: string) => void;
}

// Layout constants — abstract units → SVG units
const UNIT = 60;       // 1 abstract unit = 60 SVG px
const PADDING = 40;    // padding around structure
const ATOM_FONT = 18;
const BOND_WIDTH = 2;
const DOUBLE_GAP = 4;  // gap between double bond lines

// ---------- Layer labels (Russian) ----------
const LAYER_LABELS: Record<keyof MoleculeLayerVisibility, string> = {
  bonds: 'Связи',
  oxStates: 'С.О.',
  charges: 'Заряды',
  lonePairs: 'Пары',
};

// ---------- Helpers ----------

function formatOx(ox: number): string {
  if (ox === 0) return '0';
  if (ox > 0) return `+${ox}`;
  return `\u2212${Math.abs(ox)}`;
}

function oxClass(ox: number): string {
  if (ox > 0) return 'mol-ox--positive';
  if (ox < 0) return 'mol-ox--negative';
  return 'mol-ox--zero';
}

/** Compute bounding box and viewBox from atom positions */
function computeViewBox(atoms: MoleculeAtom[]) {
  if (atoms.length === 0) return { viewBox: '0 0 100 100', width: 100, height: 100, offsetX: 0, offsetY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const a of atoms) {
    if (a.x < minX) minX = a.x;
    if (a.y < minY) minY = a.y;
    if (a.x > maxX) maxX = a.x;
    if (a.y > maxY) maxY = a.y;
  }
  const offsetX = -minX * UNIT + PADDING;
  const offsetY = -minY * UNIT + PADDING;
  const width = (maxX - minX) * UNIT + PADDING * 2;
  const height = (maxY - minY) * UNIT + PADDING * 2;
  return { viewBox: `0 0 ${width} ${height}`, width, height, offsetX, offsetY };
}

/** Get SVG coords for an atom */
function atomPos(atom: MoleculeAtom, offsetX: number, offsetY: number) {
  return { cx: atom.x * UNIT + offsetX, cy: atom.y * UNIT + offsetY };
}

/** Compute angle from atom a to atom b */
function bondAngle(a: { cx: number; cy: number }, b: { cx: number; cy: number }): number {
  return Math.atan2(b.cy - a.cy, b.cx - a.cx);
}

/** Compute perpendicular offset for double/triple bonds */
function perpOffset(angle: number, dist: number): { dx: number; dy: number } {
  return { dx: -Math.sin(angle) * dist, dy: Math.cos(angle) * dist };
}

/** Place lone pair dots around an atom, avoiding directions where bonds exist */
function lonePairPositions(
  atom: MoleculeAtom,
  pairCount: number,
  bonds: MoleculeBond[],
  atomMap: Map<string, MoleculeAtom>,
  offsetX: number,
  offsetY: number,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  if (pairCount <= 0) return [];

  const { cx, cy } = atomPos(atom, offsetX, offsetY);

  // Find angles occupied by bonds
  const bondAngles: number[] = [];
  for (const b of bonds) {
    let otherAtom: MoleculeAtom | undefined;
    if (b.from === atom.id) otherAtom = atomMap.get(b.to);
    else if (b.to === atom.id) otherAtom = atomMap.get(b.from);
    if (otherAtom) {
      const otherPos = atomPos(otherAtom, offsetX, offsetY);
      bondAngles.push(Math.atan2(otherPos.cy - cy, otherPos.cx - cx));
    }
  }

  // Distribute lone pairs evenly in remaining space
  const allAngles: number[] = [];
  const totalSlots = bondAngles.length + pairCount;
  if (bondAngles.length === 0) {
    // No bonds — distribute evenly starting from top
    for (let i = 0; i < pairCount; i++) {
      allAngles.push(-Math.PI / 2 + (2 * Math.PI * i) / pairCount);
    }
  } else {
    // Place lone pairs opposite to bonds
    const sorted = [...bondAngles].sort((a, b) => a - b);
    // Find the largest gap and distribute pairs there
    const gaps: Array<{ start: number; size: number }> = [];
    for (let i = 0; i < sorted.length; i++) {
      const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 2 * Math.PI;
      gaps.push({ start: sorted[i], size: next - sorted[i] });
    }
    gaps.sort((a, b) => b.size - a.size);

    let placed = 0;
    for (const gap of gaps) {
      if (placed >= pairCount) break;
      const pairsInGap = Math.min(pairCount - placed, Math.max(1, Math.round(gap.size / (2 * Math.PI / totalSlots))));
      for (let j = 0; j < pairsInGap; j++) {
        const angle = gap.start + gap.size * (j + 1) / (pairsInGap + 1);
        allAngles.push(angle);
        placed++;
      }
    }
  }

  const DOT_DIST = 16;
  const DOT_GAP = 4;

  return allAngles.map((angle) => {
    const dx = Math.cos(angle) * DOT_DIST;
    const dy = Math.sin(angle) * DOT_DIST;
    const pdx = -Math.sin(angle) * DOT_GAP;
    const pdy = Math.cos(angle) * DOT_GAP;
    return {
      x1: cx + dx + pdx,
      y1: cy + dy + pdy,
      x2: cx + dx - pdx,
      y2: cy + dy - pdy,
    };
  });
}

// ---------- Sub-renderers ----------

function BondLayer({
  bonds,
  atomMap,
  offsetX,
  offsetY,
}: {
  bonds: MoleculeBond[];
  atomMap: Map<string, MoleculeAtom>;
  offsetX: number;
  offsetY: number;
}) {
  return (
    <>
      {bonds.map((bond, i) => {
        const a = atomMap.get(bond.from);
        const b = atomMap.get(bond.to);
        if (!a || !b) return null;
        const posA = atomPos(a, offsetX, offsetY);
        const posB = atomPos(b, offsetX, offsetY);
        const angle = bondAngle(posA, posB);

        // Shorten lines so they don't overlap atom labels
        const shorten = ATOM_FONT * 0.5;
        const dx = Math.cos(angle) * shorten;
        const dy = Math.sin(angle) * shorten;
        const x1 = posA.cx + dx;
        const y1 = posA.cy + dy;
        const x2 = posB.cx - dx;
        const y2 = posB.cy - dy;

        if (bond.order === 1) {
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              className="mol-bond" strokeWidth={BOND_WIDTH} />
          );
        }

        if (bond.order === 2) {
          const p = perpOffset(angle, DOUBLE_GAP);
          return (
            <g key={i}>
              <line x1={x1 + p.dx} y1={y1 + p.dy} x2={x2 + p.dx} y2={y2 + p.dy}
                className="mol-bond" strokeWidth={BOND_WIDTH} />
              <line x1={x1 - p.dx} y1={y1 - p.dy} x2={x2 - p.dx} y2={y2 - p.dy}
                className="mol-bond" strokeWidth={BOND_WIDTH} />
            </g>
          );
        }

        // Triple bond
        const p = perpOffset(angle, DOUBLE_GAP + 1);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              className="mol-bond" strokeWidth={BOND_WIDTH} />
            <line x1={x1 + p.dx} y1={y1 + p.dy} x2={x2 + p.dx} y2={y2 + p.dy}
              className="mol-bond" strokeWidth={BOND_WIDTH} />
            <line x1={x1 - p.dx} y1={y1 - p.dy} x2={x2 - p.dx} y2={y2 - p.dy}
              className="mol-bond" strokeWidth={BOND_WIDTH} />
          </g>
        );
      })}
    </>
  );
}

function LonePairsLayer({
  atoms,
  bonds,
  atomMap,
  offsetX,
  offsetY,
}: {
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
  atomMap: Map<string, MoleculeAtom>;
  offsetX: number;
  offsetY: number;
}) {
  return (
    <>
      {atoms.map((atom) => {
        if (!atom.lonePairs || atom.lonePairs <= 0) return null;
        const pairs = lonePairPositions(atom, atom.lonePairs, bonds, atomMap, offsetX, offsetY);
        return pairs.map((p, j) => (
          <g key={`${atom.id}-lp-${j}`}>
            <circle cx={p.x1} cy={p.y1} r={2} className="mol-lone-pair" />
            <circle cx={p.x2} cy={p.y2} r={2} className="mol-lone-pair" />
          </g>
        ));
      })}
    </>
  );
}

function OxStatesLayer({
  atoms,
  offsetX,
  offsetY,
}: {
  atoms: MoleculeAtom[];
  offsetX: number;
  offsetY: number;
}) {
  return (
    <>
      {atoms.map((atom) => {
        if (atom.ox === undefined) return null;
        const { cx, cy } = atomPos(atom, offsetX, offsetY);
        return (
          <text
            key={`ox-${atom.id}`}
            x={cx}
            y={cy - ATOM_FONT * 0.9}
            textAnchor="middle"
            className={`mol-ox ${oxClass(atom.ox)}`}
          >
            {formatOx(atom.ox)}
          </text>
        );
      })}
    </>
  );
}

function ChargesLayer({
  polarity,
  atomMap,
  offsetX,
  offsetY,
}: {
  polarity: MoleculePolarity[];
  atomMap: Map<string, MoleculeAtom>;
  offsetX: number;
  offsetY: number;
}) {
  return (
    <>
      {polarity.map((p, i) => {
        const plus = atomMap.get(p.deltaPlus);
        const minus = atomMap.get(p.deltaMinus);
        if (!plus || !minus) return null;
        const plusPos = atomPos(plus, offsetX, offsetY);
        const minusPos = atomPos(minus, offsetX, offsetY);
        // Place charge labels slightly above and to the side of atoms
        return (
          <g key={i}>
            <text
              x={plusPos.cx}
              y={plusPos.cy - ATOM_FONT * 1.5}
              textAnchor="middle"
              className="mol-charge mol-charge--plus"
            >
              δ+
            </text>
            <text
              x={minusPos.cx}
              y={minusPos.cy - ATOM_FONT * 1.5}
              textAnchor="middle"
              className="mol-charge mol-charge--minus"
            >
              δ−
            </text>
          </g>
        );
      })}
    </>
  );
}

// ---------- Main Component ----------

export default function MoleculeView({
  structure,
  layers: layersProp,
  locked: lockedProp,
  size = 'md',
  interactive = true,
  onAtomClick,
}: MoleculeViewProps) {
  const defaultLayers: MoleculeLayerVisibility = {
    bonds: true,
    oxStates: false,
    charges: false,
    lonePairs: false,
  };
  const [layers, setLayers] = useState<MoleculeLayerVisibility>({
    ...defaultLayers,
    ...layersProp,
  });
  const locked = lockedProp ?? {};

  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const atomMap = useMemo(() => {
    const map = new Map<string, MoleculeAtom>();
    for (const a of structure.atoms) map.set(a.id, a);
    return map;
  }, [structure]);

  const { viewBox, offsetX, offsetY } = useMemo(
    () => computeViewBox(structure.atoms),
    [structure.atoms],
  );

  const toggleLayer = useCallback((key: keyof MoleculeLayerVisibility) => {
    if (locked[key]) return;
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, [locked]);

  const handleAtomHover = useCallback((atom: MoleculeAtom, e: React.MouseEvent) => {
    if (!interactive || size === 'inline') return;
    const parts: string[] = [atom.symbol];
    if (atom.ox !== undefined) parts.push(`С.О. ${formatOx(atom.ox)}`);
    setTooltip({ text: parts.join(' · '), x: e.clientX + 12, y: e.clientY - 8 });
  }, [interactive, size]);

  const handleAtomLeave = useCallback(() => setTooltip(null), []);

  const handleAtomClick = useCallback((atom: MoleculeAtom) => {
    if (!interactive || size === 'inline') return;
    onAtomClick?.(atom.symbol);
  }, [interactive, size, onAtomClick]);

  const showToggles = size === 'md' || size === 'lg';

  const containerClass = [
    'mol-view',
    `mol-view--${size}`,
  ].join(' ');

  // Build aria label
  const ariaLabel = `Структура ${structure.id}: ${structure.atoms.map((a) => a.label ?? a.symbol).join(', ')}`;

  return (
    <div className={containerClass}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="mol-view__svg"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Layer: bonds */}
        <g className={`mol-layer ${layers.bonds ? '' : 'mol-layer--hidden'}`}>
          <BondLayer bonds={structure.bonds} atomMap={atomMap} offsetX={offsetX} offsetY={offsetY} />
        </g>

        {/* Layer: lone pairs */}
        <g className={`mol-layer ${layers.lonePairs ? '' : 'mol-layer--hidden'}`}>
          <LonePairsLayer atoms={structure.atoms} bonds={structure.bonds} atomMap={atomMap} offsetX={offsetX} offsetY={offsetY} />
        </g>

        {/* Atoms — always visible */}
        <g>
          {structure.atoms.map((atom) => {
            const { cx, cy } = atomPos(atom, offsetX, offsetY);
            const label = atom.label ?? atom.symbol;
            return (
              <text
                key={atom.id}
                x={cx}
                y={cy + ATOM_FONT * 0.35}
                textAnchor="middle"
                fontSize={ATOM_FONT}
                className={`mol-atom-label ${interactive && size !== 'inline' ? 'mol-atom-label--interactive' : ''}`}
                onMouseEnter={(e) => handleAtomHover(atom, e)}
                onMouseMove={(e) => tooltip && setTooltip({ ...tooltip, x: e.clientX + 12, y: e.clientY - 8 })}
                onMouseLeave={handleAtomLeave}
                onClick={() => handleAtomClick(atom)}
              >
                {label}
              </text>
            );
          })}
        </g>

        {/* Layer: oxidation states */}
        <g className={`mol-layer ${layers.oxStates ? '' : 'mol-layer--hidden'}`}>
          <OxStatesLayer atoms={structure.atoms} offsetX={offsetX} offsetY={offsetY} />
        </g>

        {/* Layer: charges */}
        {structure.polarity && (
          <g className={`mol-layer ${layers.charges ? '' : 'mol-layer--hidden'}`}>
            <ChargesLayer polarity={structure.polarity} atomMap={atomMap} offsetX={offsetX} offsetY={offsetY} />
          </g>
        )}
      </svg>

      {/* Toggle bar */}
      {showToggles && (
        <div className="mol-toggles">
          {(Object.keys(LAYER_LABELS) as Array<keyof MoleculeLayerVisibility>).map((key) => (
            <button
              key={key}
              type="button"
              className={[
                'mol-toggle-btn',
                layers[key] ? 'mol-toggle-btn--active' : '',
                locked[key] ? 'mol-toggle-btn--locked' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => toggleLayer(key)}
              disabled={!!locked[key]}
            >
              {LAYER_LABELS[key]}
            </button>
          ))}
        </div>
      )}

      {/* Hover tooltip (portal to body via fixed positioning) */}
      {tooltip && (
        <div className="mol-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/components/MoleculeView.tsx src/components/molecule-view.css
git commit -m "feat(molecule): add MoleculeView SVG renderer with 4 toggleable layers"
```

---

### Task 5: Visual test — demo page

**Files:**
- Modify: `src/pages/substances/[id].astro`

Add `<MoleculeView>` on substance pages that have a matching structure file. This is the integration test — build the site and visually check H₂O, HCl, H₂SO₄, NaCl, CH₄.

**Step 1: Add structure loading to `[id].astro`**

In the frontmatter, after loading substance data, try to load the matching structure:

```ts
// Try to load molecule structure
let structure = null;
try {
  const structRaw = await readFile(
    new URL(`../../data-src/structures/${id}.json`, import.meta.url), 'utf-8'
  );
  structure = JSON.parse(structRaw);
} catch { /* no structure for this substance */ }
```

In the template, add before the physical properties section:

```astro
{structure && (
  <section class="substance-page__section">
    <h2>Структурная формула</h2>
    <MoleculeView
      client:idle
      structure={structure}
      layers={{ bonds: true, oxStates: false, charges: false, lonePairs: false }}
      size="md"
      interactive={true}
      onAtomClick={(symbol) => window.location.href = `/periodic-table/${symbol}/`}
    />
  </section>
)}
```

Add import at top of frontmatter:

```ts
import MoleculeView from '../../components/MoleculeView';
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build passes

Run: `npm run preview`
Then open in browser:
- `/substances/h2o/` — should show O with two H atoms, bonds
- `/substances/h2so4/` — should show tetrahedral S with 4 O atoms, 2 H atoms
- `/substances/nacl/` — should show Na⁺ and Cl⁻ without bonds
- `/substances/hcl/` — should show H—Cl with bond

Toggle layers on each page to verify they work.

**Step 3: Commit**

```bash
git add src/pages/substances/[id].astro
git commit -m "feat(molecule): integrate MoleculeView on substance pages"
```

---

### Task 6: Generate remaining ~30 structures

**Files:**
- Create: `scripts/generate-structures.mjs` (one-time generator)
- Create: ~30 more files in `data-src/structures/`

**Step 1: Write generator script**

The script should generate Lewis structure JSON for all substances in `data-src/substances/`. For each substance, use known chemistry rules to place atoms and assign bonds. The script outputs JSON files to `data-src/structures/`.

Key algorithm:
1. Parse formula → get atoms and counts
2. Central atom = least electronegative (except H)
3. Place terminal atoms around central atom
4. Assign single bonds first, then distribute remaining electrons as lone pairs or multiple bonds
5. Compute oxidation states from element data
6. Place coordinates in 2D using geometry (linear, trigonal, tetrahedral, etc.)

The script will have hard-coded overrides for tricky molecules (H₂O₂, NH₃, etc.).

This is a one-time script — run it, inspect output, hand-correct if needed.

**Step 2: Run generator**

```bash
node scripts/generate-structures.mjs
```

Inspect output files. Hand-correct any wrong structures.

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build passes with N molecule structures

**Step 4: Commit**

```bash
git add data-src/structures/ scripts/generate-structures.mjs
git commit -m "feat(molecule): generate structures for all 35 substances"
```

---

### Task 7: Replace FormulaWithOxStates

**Files:**
- Modify: `src/features/oxidation-states/OxidationCalculator.tsx`

Replace `<FormulaWithOxStates>` usage with `<MoleculeView>` where a structure file exists. For formulas without a pre-built structure, keep FormulaWithOxStates as fallback (it works for any formula dynamically).

**Step 1: In OxidationCalculator, add conditional rendering**

When the calculator shows results for a known substance, load its structure and render `<MoleculeView layers={{oxStates: true}} size="sm" />`. When no structure exists, fall back to `<FormulaWithOxStates>`.

**Step 2: Build and verify**

Run: `npm run build`
Open `/oxidation-states/`, enter H₂SO₄ — should show MoleculeView with oxStates layer. Enter an unknown formula — should fall back to FormulaWithOxStates.

**Step 3: Commit**

```bash
git add src/features/oxidation-states/OxidationCalculator.tsx
git commit -m "feat(molecule): use MoleculeView in oxidation calculator when structure available"
```

---

### Task 8: Replace BondDiagramCovalent

**Files:**
- Modify: `src/features/bonds/BondTheoryPanel.tsx`

Replace `<BondDiagramCovalent>` with `<MoleculeView>` for examples (e.g. HCl for polar covalent). Use `layers={{bonds: true, charges: true}}`.

**Step 1: Update BondTheoryPanel**

Where bond type cards currently render BondDiagramCovalent, check if a matching structure exists and use MoleculeView. Keep BondDiagramIonic and BondDiagramMetallic — those are conceptually different models.

**Step 2: Build and verify**

Run: `npm run build`
Open `/bonds/` — covalent bond examples should show MoleculeView.

**Step 3: Commit**

```bash
git add src/features/bonds/BondTheoryPanel.tsx
git commit -m "feat(molecule): use MoleculeView for covalent bond examples"
```

---

## Verification Checklist

After all tasks:

- [ ] `npm run build` passes
- [ ] Substance pages with structures show MoleculeView
- [ ] All 4 layers toggle correctly
- [ ] Locked layers cannot be toggled
- [ ] Hover on atoms shows tooltip
- [ ] Click on atoms navigates to element page
- [ ] Inline size works (no toggles, fits in text line)
- [ ] FormulaWithOxStates still works as fallback
- [ ] Bond diagrams use MoleculeView where appropriate
- [ ] Dark mode renders correctly (bond strokes, lone pair dots)
