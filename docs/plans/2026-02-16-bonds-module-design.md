# Block B: Chemical Bonds & Crystal Structures — Design

## Goal
Separate page `/bonds/` with an interactive bond-type calculator as the central element,
theory panel, and BKT-tracked practice. Covers competencies `bond_type` and `crystal_structure_type`
(OGE task types 5 and 6).

## Architecture
Calculator-centric approach: user inputs a formula or selects an element pair →
algorithms determine bond type, crystal structure, and physical properties →
results shown with programmatic SVG diagrams.

Three-layer page (same pattern as /substances/ and /reactions/):
BondCalculator → BondTheoryPanel → PracticeSection.

## Algorithms (src/lib/bond-calculator.ts)

**Bond type** — `determineBondType(elA, elB)`:
1. Same element, metal → metallic
2. Same element, nonmetal → covalent nonpolar
3. Both metals → metallic
4. Δχ ≥ 1.7 (or metal+nonmetal with Δχ > 1.5) → ionic
5. 0.4 < Δχ < 1.7 → covalent polar
6. Δχ ≤ 0.4 → covalent nonpolar

**Crystal structure** — `determineCrystalStructure(bondType, formula)`:
- ionic → ionic lattice
- metallic → metallic lattice
- covalent + atomic substance (hardcoded: C, Si, SiO2, B2O3, SiC, Al2O3) → atomic lattice
- covalent + everything else → molecular lattice

**Properties** — static lookup by lattice type (melting point, hardness, conductivity, solubility).

## Components

- **BondCalculator**: formula input (reuses formula-parser.ts) + element pair selector. Shows result card with Δχ, bond type, lattice type, properties table.
- **SVG diagrams** (programmatic React):
  - BondDiagramIonic: two atoms, e⁻ transfer arrow, charges
  - BondDiagramCovalent: two atoms, shared electron pairs, δ+/δ− for polar
  - BondDiagramMetallic: atom grid with electron cloud
  - ElectronegativityBar: horizontal χ scale with two markers and Δχ
- **BondTheoryPanel**: collapsible sections per bond type + crystal structure comparison table. Content from `data-src/rules/bond_theory.json`.
- **PracticeSection**: exercises for bond_type + crystal_structure_type competencies. Types: identify bond type, identify lattice, select substance by bond/lattice, compare melting points.

## Data Files
- Create: `data-src/rules/bond_theory.json` — theory content (rules, examples, properties)
- Create: `data-src/exercises/bonds-exercises.json` — exercise templates
- Update: `competencies.json` link field for bond_type, crystal_structure_type → "/bonds/"
- Update: build pipeline, manifest, data-loader for new files

## Visuals
All SVG generated programmatically by React components. No static images.
