import { useState, useMemo } from 'react';
import type {
  MoleculeStructure,
  MoleculeLayerVisibility,
  MoleculeAtom,
  MoleculeBond,
} from '../types/molecule.ts';
import './molecule-view.css';

// ── Constants ──

const UNIT = 60;
const PADDING = 40;
const BOND_SHORTEN = 9;
const DOUBLE_BOND_GAP = 4;
const TRIPLE_BOND_GAP = 5;
const LONE_PAIR_DIST = 16;
const LONE_PAIR_SPREAD = 4;
const LONE_PAIR_RADIUS = 2;

type Size = 'inline' | 'sm' | 'md' | 'lg';

interface MoleculeViewProps {
  structure: MoleculeStructure;
  layers?: MoleculeLayerVisibility;
  locked?: MoleculeLayerVisibility;
  size?: Size;
  interactive?: boolean;
  onAtomClick?: (symbol: string) => void;
}

interface LayerKey {
  id: keyof MoleculeLayerVisibility;
  label: string;
}

const LAYER_KEYS: LayerKey[] = [
  { id: 'bonds', label: 'Связи' },
  { id: 'oxStates', label: 'С.О.' },
  { id: 'charges', label: 'Заряды' },
  { id: 'lonePairs', label: 'Пары' },
];

const DEFAULT_VISIBILITY: MoleculeLayerVisibility = {
  bonds: true,
  oxStates: false,
  charges: false,
  lonePairs: false,
};

// ── Geometry helpers ──

function atomPos(atom: MoleculeAtom): { x: number; y: number } {
  return { x: atom.x * UNIT, y: atom.y * UNIT };
}

function shortenLine(
  x1: number, y1: number, x2: number, y2: number, amount: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < amount * 2) return { x1, y1, x2, y2 };
  const nx = dx / len;
  const ny = dy / len;
  return {
    x1: x1 + nx * amount,
    y1: y1 + ny * amount,
    x2: x2 - nx * amount,
    y2: y2 - ny * amount,
  };
}

function offsetLine(
  x1: number, y1: number, x2: number, y2: number, offset: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x1, y1, x2, y2 };
  const px = -dy / len * offset;
  const py = dx / len * offset;
  return { x1: x1 + px, y1: y1 + py, x2: x2 + px, y2: y2 + py };
}

/** Build a lookup from atom id to list of bond angles (in radians). */
function buildBondAngles(
  atoms: MoleculeAtom[],
  bonds: MoleculeBond[],
): Map<string, number[]> {
  const posMap = new Map(atoms.map(a => [a.id, atomPos(a)]));
  const angles = new Map<string, number[]>();

  for (const a of atoms) {
    angles.set(a.id, []);
  }

  for (const bond of bonds) {
    const pFrom = posMap.get(bond.from);
    const pTo = posMap.get(bond.to);
    if (!pFrom || !pTo) continue;

    const angleFromTo = Math.atan2(pTo.y - pFrom.y, pTo.x - pFrom.x);
    const angleToFrom = Math.atan2(pFrom.y - pTo.y, pFrom.x - pTo.x);

    angles.get(bond.from)!.push(angleFromTo);
    angles.get(bond.to)!.push(angleToFrom);
  }

  return angles;
}

/**
 * Compute placement angles for lone pairs around an atom.
 * Finds the largest angular gaps between existing bonds and places pairs there.
 * For atoms with no bonds, distributes pairs evenly starting from -PI/2 (top).
 */
function computeLonePairAngles(
  bondAngles: number[],
  pairCount: number,
): number[] {
  if (pairCount <= 0) return [];

  if (bondAngles.length === 0) {
    const step = (2 * Math.PI) / pairCount;
    return Array.from({ length: pairCount }, (_, i) => -Math.PI / 2 + i * step);
  }

  const sorted = [...bondAngles].sort((a, b) => a - b);
  const gaps: { midAngle: number; size: number }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 2 * Math.PI;
    const size = next - sorted[i];
    const mid = sorted[i] + size / 2;
    gaps.push({ midAngle: mid, size });
  }

  gaps.sort((a, b) => b.size - a.size);

  const result: number[] = [];
  for (let i = 0; i < pairCount && i < gaps.length; i++) {
    result.push(gaps[i].midAngle);
  }

  // If more pairs than gaps, distribute remaining evenly
  while (result.length < pairCount) {
    const step = (2 * Math.PI) / pairCount;
    result.push(-Math.PI / 2 + result.length * step);
  }

  return result;
}

function formatOxState(ox: number): string {
  if (ox === 0) return '0';
  if (ox > 0) return `+${ox}`;
  return `\u2212${Math.abs(ox)}`;
}

function oxColorClass(ox: number): string {
  if (ox > 0) return 'mol-ox--positive';
  if (ox < 0) return 'mol-ox--negative';
  return 'mol-ox--zero';
}

// ── Sub-components ──

function BondLines({ bonds, atoms }: { bonds: MoleculeBond[]; atoms: MoleculeAtom[] }) {
  const posMap = new Map(atoms.map(a => [a.id, atomPos(a)]));

  return (
    <>
      {bonds.map((bond, i) => {
        const pFrom = posMap.get(bond.from);
        const pTo = posMap.get(bond.to);
        if (!pFrom || !pTo) return null;

        const shortened = shortenLine(pFrom.x, pFrom.y, pTo.x, pTo.y, BOND_SHORTEN);
        const dativeClass = bond.dative ? ' mol-bond--dative' : '';

        if (bond.order === 1) {
          return (
            <line
              key={i}
              className={`mol-bond${dativeClass}`}
              x1={shortened.x1} y1={shortened.y1}
              x2={shortened.x2} y2={shortened.y2}
              strokeWidth={1.5}
            />
          );
        }

        if (bond.order === 2) {
          const top = offsetLine(shortened.x1, shortened.y1, shortened.x2, shortened.y2, DOUBLE_BOND_GAP / 2);
          const bot = offsetLine(shortened.x1, shortened.y1, shortened.x2, shortened.y2, -DOUBLE_BOND_GAP / 2);
          return (
            <g key={i}>
              <line className={`mol-bond${dativeClass}`} x1={top.x1} y1={top.y1} x2={top.x2} y2={top.y2} strokeWidth={1.5} />
              <line className={`mol-bond${dativeClass}`} x1={bot.x1} y1={bot.y1} x2={bot.x2} y2={bot.y2} strokeWidth={1.5} />
            </g>
          );
        }

        // Triple bond
        const center = shortened;
        const top = offsetLine(shortened.x1, shortened.y1, shortened.x2, shortened.y2, TRIPLE_BOND_GAP);
        const bot = offsetLine(shortened.x1, shortened.y1, shortened.x2, shortened.y2, -TRIPLE_BOND_GAP);
        return (
          <g key={i}>
            <line className={`mol-bond${dativeClass}`} x1={top.x1} y1={top.y1} x2={top.x2} y2={top.y2} strokeWidth={1.5} />
            <line className={`mol-bond${dativeClass}`} x1={center.x1} y1={center.y1} x2={center.x2} y2={center.y2} strokeWidth={1.5} />
            <line className={`mol-bond${dativeClass}`} x1={bot.x1} y1={bot.y1} x2={bot.x2} y2={bot.y2} strokeWidth={1.5} />
          </g>
        );
      })}
    </>
  );
}

function LonePairDots({
  atoms,
  bondAnglesMap,
}: {
  atoms: MoleculeAtom[];
  bondAnglesMap: Map<string, number[]>;
}) {
  return (
    <>
      {atoms.map(atom => {
        if (!atom.lonePairs || atom.lonePairs <= 0) return null;

        const pos = atomPos(atom);
        const bondAngles = bondAnglesMap.get(atom.id) ?? [];
        const pairAngles = computeLonePairAngles(bondAngles, atom.lonePairs);

        return pairAngles.map((angle, pi) => {
          const cx = pos.x + Math.cos(angle) * LONE_PAIR_DIST;
          const cy = pos.y + Math.sin(angle) * LONE_PAIR_DIST;
          // Perpendicular direction for the two dots in the pair
          const perpX = -Math.sin(angle) * (LONE_PAIR_SPREAD / 2);
          const perpY = Math.cos(angle) * (LONE_PAIR_SPREAD / 2);

          return (
            <g key={`${atom.id}-lp-${pi}`}>
              <circle
                className="mol-lone-pair"
                cx={cx + perpX} cy={cy + perpY}
                r={LONE_PAIR_RADIUS}
              />
              <circle
                className="mol-lone-pair"
                cx={cx - perpX} cy={cy - perpY}
                r={LONE_PAIR_RADIUS}
              />
            </g>
          );
        });
      })}
    </>
  );
}

function AtomLabels({
  atoms,
  isInteractive,
  hoveredAtom,
  onHover,
  onLeave,
  onClick,
}: {
  atoms: MoleculeAtom[];
  isInteractive: boolean;
  hoveredAtom: string | null;
  onHover: (id: string, event: React.MouseEvent) => void;
  onLeave: () => void;
  onClick: (symbol: string) => void;
}) {
  return (
    <>
      {atoms.map(atom => {
        const pos = atomPos(atom);
        const label = atom.label ?? atom.symbol;
        const cls = isInteractive
          ? 'mol-atom-label mol-atom-label--interactive'
          : 'mol-atom-label';

        return (
          <text
            key={atom.id}
            className={cls}
            x={pos.x}
            y={pos.y}
            fontSize={14}
            onMouseEnter={isInteractive ? (e) => onHover(atom.id, e) : undefined}
            onMouseLeave={isInteractive ? onLeave : undefined}
            onClick={isInteractive ? () => onClick(atom.symbol) : undefined}
          >
            {label}
          </text>
        );
      })}
    </>
  );
}

function OxStateLabels({
  atoms,
  showCharges,
}: {
  atoms: MoleculeAtom[];
  showCharges: boolean;
}) {
  // When charges are also visible, push ox labels higher to avoid overlap
  const yOffset = showCharges ? -18 : -12;

  return (
    <>
      {atoms.map(atom => {
        if (atom.ox === undefined) return null;
        const pos = atomPos(atom);

        return (
          <text
            key={atom.id}
            className={`mol-ox ${oxColorClass(atom.ox)}`}
            x={pos.x}
            y={pos.y + yOffset}
            fontSize={10}
          >
            {formatOxState(atom.ox)}
          </text>
        );
      })}
    </>
  );
}

function ChargeLabels({
  structure,
  showOx,
}: {
  structure: MoleculeStructure;
  showOx: boolean;
}) {
  if (!structure.polarity || structure.polarity.length === 0) return <></>;

  // When ox states are also visible, push charges slightly lower (less offset)
  const yOffset = showOx ? -6 : -12;
  const atomMap = new Map(structure.atoms.map(a => [a.id, a]));

  // Collect charge assignments: atom id -> 'plus' | 'minus'
  const chargeMap = new Map<string, 'plus' | 'minus'>();
  for (const pol of structure.polarity) {
    chargeMap.set(pol.deltaPlus, 'plus');
    chargeMap.set(pol.deltaMinus, 'minus');
  }

  return (
    <>
      {Array.from(chargeMap.entries()).map(([atomId, type]) => {
        const atom = atomMap.get(atomId);
        if (!atom) return null;
        const pos = atomPos(atom);
        const label = type === 'plus' ? '\u03B4+' : '\u03B4\u2212';
        const cls = type === 'plus' ? 'mol-charge mol-charge--plus' : 'mol-charge mol-charge--minus';

        return (
          <text
            key={`charge-${atomId}`}
            className={cls}
            x={pos.x}
            y={pos.y + yOffset}
            fontSize={10}
          >
            {label}
          </text>
        );
      })}
    </>
  );
}

function ToggleBar({
  visibility,
  locked,
  onToggle,
  showLabels,
}: {
  visibility: MoleculeLayerVisibility;
  locked: MoleculeLayerVisibility;
  onToggle: (key: keyof MoleculeLayerVisibility) => void;
  showLabels: boolean;
}) {
  return (
    <div className="mol-toggles">
      {LAYER_KEYS.map(({ id, label }) => {
        const isActive = visibility[id] ?? false;
        const isLocked = locked[id] ?? false;

        const cls = [
          'mol-toggle-btn',
          isActive ? 'mol-toggle-btn--active' : '',
          isLocked ? 'mol-toggle-btn--locked' : '',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={id}
            className={cls}
            disabled={isLocked}
            onClick={() => onToggle(id)}
            title={label}
            type="button"
          >
            {showLabels ? label : label.charAt(0)}
          </button>
        );
      })}
    </div>
  );
}

function Tooltip({
  atom,
  position,
}: {
  atom: MoleculeAtom;
  position: { x: number; y: number };
}) {
  const oxText = atom.ox !== undefined ? ` (${formatOxState(atom.ox)})` : '';

  return (
    <div
      className="mol-tooltip"
      style={{ left: position.x + 12, top: position.y - 28 }}
    >
      {atom.symbol}{oxText}
    </div>
  );
}

// ── Main component ──

export default function MoleculeView({
  structure,
  layers,
  locked = {},
  size = 'md',
  interactive = true,
  onAtomClick,
}: MoleculeViewProps) {
  const initialVisibility: MoleculeLayerVisibility = {
    ...DEFAULT_VISIBILITY,
    ...layers,
  };

  const [visibility, setVisibility] = useState<MoleculeLayerVisibility>(initialVisibility);
  const [hoveredAtom, setHoveredAtom] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const isInteractive = interactive && size !== 'inline';
  const showToggles = size === 'md' || size === 'lg';
  const showLabels = size === 'lg';

  const atomMap = useMemo(
    () => new Map(structure.atoms.map(a => [a.id, a])),
    [structure.atoms],
  );

  const bondAnglesMap = useMemo(
    () => buildBondAngles(structure.atoms, structure.bonds),
    [structure.atoms, structure.bonds],
  );

  // Compute viewBox from atom positions
  const viewBox = useMemo(() => {
    if (structure.atoms.length === 0) return '0 0 100 100';

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const atom of structure.atoms) {
      const pos = atomPos(atom);
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y > maxY) maxY = pos.y;
    }

    return `${minX - PADDING} ${minY - PADDING} ${maxX - minX + PADDING * 2} ${maxY - minY + PADDING * 2}`;
  }, [structure.atoms]);

  function handleToggle(key: keyof MoleculeLayerVisibility): void {
    if (locked[key]) return;
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleAtomHover(id: string, event: React.MouseEvent): void {
    setHoveredAtom(id);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  }

  function handleAtomLeave(): void {
    setHoveredAtom(null);
  }

  function handleAtomClick(symbol: string): void {
    onAtomClick?.(symbol);
  }

  const containerCls = `mol-view mol-view--${size}`;
  const bondsVisible = visibility.bonds ?? true;
  const oxVisible = visibility.oxStates ?? false;
  const chargesVisible = visibility.charges ?? false;
  const lonePairsVisible = visibility.lonePairs ?? false;

  const hoveredAtomData = hoveredAtom ? atomMap.get(hoveredAtom) ?? null : null;

  return (
    <div className={containerCls}>
      <svg
        className="mol-view__svg"
        viewBox={viewBox}
        role="img"
        aria-label={`Структура молекулы ${structure.id}`}
      >
        {/* Layer: bonds */}
        <g className={`mol-layer${bondsVisible ? '' : ' mol-layer--hidden'}`}>
          <BondLines bonds={structure.bonds} atoms={structure.atoms} />
        </g>

        {/* Layer: lone pairs */}
        <g className={`mol-layer${lonePairsVisible ? '' : ' mol-layer--hidden'}`}>
          <LonePairDots atoms={structure.atoms} bondAnglesMap={bondAnglesMap} />
        </g>

        {/* Atom labels (always visible) */}
        <g className="mol-layer">
          <AtomLabels
            atoms={structure.atoms}
            isInteractive={isInteractive}
            hoveredAtom={hoveredAtom}
            onHover={handleAtomHover}
            onLeave={handleAtomLeave}
            onClick={handleAtomClick}
          />
        </g>

        {/* Layer: oxidation states */}
        <g className={`mol-layer${oxVisible ? '' : ' mol-layer--hidden'}`}>
          <OxStateLabels atoms={structure.atoms} showCharges={chargesVisible} />
        </g>

        {/* Layer: polarity charges */}
        <g className={`mol-layer${chargesVisible ? '' : ' mol-layer--hidden'}`}>
          <ChargeLabels structure={structure} showOx={oxVisible} />
        </g>
      </svg>

      {showToggles && (
        <ToggleBar
          visibility={visibility}
          locked={locked}
          onToggle={handleToggle}
          showLabels={showLabels}
        />
      )}

      {isInteractive && hoveredAtomData && (
        <Tooltip atom={hoveredAtomData} position={tooltipPos} />
      )}
    </div>
  );
}
