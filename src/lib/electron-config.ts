import type { SubshellType, OrbitalFilling, OrbitalBox, EnergyLevel } from '../types/electron-config';

// --- Constants (universal physics, not content) ---

/** Klechkowski (Madelung) filling order: [n, l] pairs. */
const FILLING_ORDER: [number, SubshellType][] = [
  [1,'s'],[2,'s'],[2,'p'],[3,'s'],[3,'p'],[4,'s'],[3,'d'],[4,'p'],
  [5,'s'],[4,'d'],[5,'p'],[6,'s'],[4,'f'],[5,'d'],[6,'p'],[7,'s'],
  [5,'f'],[6,'d'],[7,'p'],
];

const SUBSHELL_CAPACITY: Record<SubshellType, number> = { s: 2, p: 6, d: 10, f: 14 };
const SUBSHELL_ORBITALS: Record<SubshellType, number> = { s: 1, p: 3, d: 5, f: 7 };

const NOBLE_GASES = [
  { Z: 2, symbol: 'He' },
  { Z: 10, symbol: 'Ne' },
  { Z: 18, symbol: 'Ar' },
  { Z: 36, symbol: 'Kr' },
  { Z: 54, symbol: 'Xe' },
  { Z: 86, symbol: 'Rn' },
];

/** Exception overrides: Z → [n, l, electron_count] tuples replacing Aufbau result. */
const EXCEPTIONS: Record<number, [number, SubshellType, number][]> = {
  // Period 4
  24: [[3,'d',5],[4,'s',1]],    // Cr: half-filled 3d
  29: [[3,'d',10],[4,'s',1]],   // Cu: full 3d
  // Period 5
  41: [[4,'d',4],[5,'s',1]],    // Nb
  42: [[4,'d',5],[5,'s',1]],    // Mo: half-filled 4d
  44: [[4,'d',7],[5,'s',1]],    // Ru
  45: [[4,'d',8],[5,'s',1]],    // Rh
  46: [[4,'d',10],[5,'s',0]],   // Pd: full 4d, empty 5s
  47: [[4,'d',10],[5,'s',1]],   // Ag: full 4d
  // Lanthanides
  57: [[4,'f',0],[5,'d',1]],    // La: 5d¹ instead of 4f¹
  58: [[4,'f',1],[5,'d',1]],    // Ce: 4f¹5d¹ instead of 4f²
  64: [[4,'f',7],[5,'d',1]],    // Gd: half-filled 4f
  // Period 6 transition metals
  78: [[4,'f',14],[5,'d',9],[6,'s',1]],  // Pt
  79: [[4,'f',14],[5,'d',10],[6,'s',1]], // Au: full 5d
  // Actinides
  89: [[5,'f',0],[6,'d',1]],    // Ac: 6d¹ instead of 5f¹
  90: [[5,'f',0],[6,'d',2]],    // Th: 6d² instead of 5f²
  91: [[5,'f',2],[6,'d',1]],    // Pa: 5f²6d¹ instead of 5f³
  92: [[5,'f',3],[6,'d',1]],    // U: 5f³6d¹ instead of 5f⁴
  93: [[5,'f',4],[6,'d',1]],    // Np: 5f⁴6d¹ instead of 5f⁵
  96: [[5,'f',7],[6,'d',1]],    // Cm: half-filled 5f
};

const SUPERSCRIPT: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴',
  '5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
};

function toSuperscript(n: number): string {
  return String(n).split('').map(ch => SUPERSCRIPT[ch] ?? ch).join('');
}

// --- Core engine ---

/** Build config via Aufbau principle (no exceptions applied). */
function buildAufbau(Z: number): OrbitalFilling[] {
  const config: OrbitalFilling[] = [];
  let remaining = Z;

  for (const [n, l] of FILLING_ORDER) {
    if (remaining <= 0) break;
    const max = SUBSHELL_CAPACITY[l];
    const electrons = Math.min(remaining, max);
    config.push({ n, l, electrons, max });
    remaining -= electrons;
  }

  return config;
}

/** Apply exception overrides to an Aufbau config. */
function applyExceptions(config: OrbitalFilling[], Z: number): OrbitalFilling[] {
  const overrides = EXCEPTIONS[Z];
  if (!overrides) return config;

  const result = config.map(entry => ({ ...entry }));
  for (const [n, l, electrons] of overrides) {
    const idx = result.findIndex(e => e.n === n && e.l === l);
    if (idx !== -1) {
      result[idx].electrons = electrons;
    } else {
      // Subshell not in Aufbau config (e.g. 5d for La) — insert it
      result.push({ n, l, electrons, max: SUBSHELL_CAPACITY[l] });
    }
  }
  // Remove zero-electron entries (Pd: 5s⁰, La: 4f⁰)
  return result.filter(e => e.electrons > 0);
}

/** Get the full electron configuration for element Z. */
export function getElectronConfig(Z: number): OrbitalFilling[] {
  return applyExceptions(buildAufbau(Z), Z);
}

/** Get the Aufbau-only config (no exceptions), for comparison display. */
export function getExpectedConfig(Z: number): OrbitalFilling[] {
  return buildAufbau(Z);
}

const L_ORDER: Record<SubshellType, number> = { s: 0, p: 1, d: 2, f: 3 };

/** Sort subshells by principal quantum number, then angular momentum. */
function sortByNL(config: OrbitalFilling[]): OrbitalFilling[] {
  return [...config].sort((a, b) => a.n - b.n || L_ORDER[a.l] - L_ORDER[b.l]);
}

function formatConfig(config: OrbitalFilling[]): string {
  return config.map(e => `${e.n}${e.l}${toSuperscript(e.electrons)}`).join('');
}

/** Format config as formula string in conventional (n,l) order: "1s²2s²2p⁶3s²3p⁵". */
export function getElectronFormula(Z: number): string {
  return formatConfig(sortByNL(getElectronConfig(Z)));
}

/** Format with noble gas core: "[Ar] 3d⁵4s¹". */
export function getShorthandFormula(Z: number): string {
  const core = getNobleGasCore(Z);
  if (!core) return getElectronFormula(Z);

  const coreConfig = getElectronConfig(core.Z);
  const fullConfig = getElectronConfig(Z);

  // Valence = subshells beyond core (in filling order), then sort for display
  const valence = sortByNL(fullConfig.slice(coreConfig.length));
  if (valence.length === 0) return `[${core.symbol}]`;

  return `[${core.symbol}] ${formatConfig(valence)}`;
}

/** Expected (Aufbau) shorthand formula — valence part only, conventional order. */
export function getExpectedShorthandValence(Z: number): string {
  const core = getNobleGasCore(Z);
  const expected = getExpectedConfig(Z);
  if (!core) return formatConfig(sortByNL(expected));

  const coreLen = buildAufbau(core.Z).length;
  return formatConfig(sortByNL(expected.slice(coreLen)));
}

/** Get the nearest noble gas with Z less than the element's Z. */
export function getNobleGasCore(Z: number): { Z: number; symbol: string } | null {
  let result: { Z: number; symbol: string } | null = null;
  for (const ng of NOBLE_GASES) {
    if (ng.Z < Z) result = ng;
    else break;
  }
  return result;
}

/** Get valence electrons (outermost principal quantum number). */
export function getValenceElectrons(Z: number): OrbitalFilling[] {
  const config = getElectronConfig(Z);
  if (config.length === 0) return [];

  // Use Aufbau config to determine the outer shell number (= period).
  // This matters for exceptions like Pd where 5s⁰ is filtered out and actual
  // maxN drops to 4, which would incorrectly report the entire 4th shell (18e⁻)
  // as valence. In school, Pd's outer shell is 5 and it has 0 valence electrons.
  const aufbau = buildAufbau(Z);
  const outerN = Math.max(...aufbau.map(e => e.n));

  const outerShell = config.filter(e => e.n === outerN);
  // For transition metals, include (n-1)d if partially filled along with ns
  const penultimateD = config.find(
    e => e.n === outerN - 1 && e.l === 'd' && e.electrons < e.max,
  );

  if (penultimateD) {
    return [penultimateD, ...outerShell];
  }
  return outerShell;
}

/** Check if element Z is an exception. */
export function isException(Z: number): boolean {
  return Z in EXCEPTIONS;
}

/** Build orbital box data with Hund's rule applied. */
export function getOrbitalBoxes(Z: number): OrbitalBox[] {
  const config = getElectronConfig(Z);
  const boxes: OrbitalBox[] = [];

  for (const entry of config) {
    const numOrbitals = SUBSHELL_ORBITALS[entry.l];
    // Apply Hund's rule: first fill all orbitals with up, then pair with down
    const orbitals: [spin1: 'up' | 'empty', spin2: 'down' | 'empty'][] = [];
    let remaining = entry.electrons;

    // Initialize empty orbitals
    for (let i = 0; i < numOrbitals; i++) {
      orbitals.push(['empty', 'empty']);
    }

    // First pass: one electron (up) per orbital
    for (let i = 0; i < numOrbitals && remaining > 0; i++) {
      orbitals[i][0] = 'up';
      remaining--;
    }

    // Second pass: pair with down
    for (let i = 0; i < numOrbitals && remaining > 0; i++) {
      orbitals[i][1] = 'down';
      remaining--;
    }

    for (let i = 0; i < numOrbitals; i++) {
      boxes.push({
        n: entry.n,
        l: entry.l,
        index: i,
        spins: [orbitals[i][0], orbitals[i][1]],
      });
    }
  }

  return boxes;
}

/** Get energy levels in filling order with valence flag. */
export function getEnergyLevels(Z: number): EnergyLevel[] {
  const config = getElectronConfig(Z);
  const valence = getValenceElectrons(Z);
  const valenceKeys = new Set(valence.map(v => `${v.n}${v.l}`));

  return config.map((entry, i) => ({
    n: entry.n,
    l: entry.l,
    energy_order: i,
    electrons: entry.electrons,
    is_valence: valenceKeys.has(`${entry.n}${entry.l}`),
  }));
}
