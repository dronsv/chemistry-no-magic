import { getOrbitalBoxes, getValenceElectrons } from '../../lib/electron-config';
import type { OrbitalBox, SubshellType } from '../../types/electron-config';

interface Props {
  Z: number;
}

const BOX_W = 24;
const BOX_H = 30;
const GAP = 2;
const GROUP_GAP = 12;
const LABEL_H = 16;
const ARROW_SIZE = 10;

function Arrow({ x, y, direction }: { x: number; y: number; direction: 'up' | 'down' }) {
  const isUp = direction === 'up';
  const tipY = isUp ? y - ARROW_SIZE / 2 : y + ARROW_SIZE / 2;
  const baseY = isUp ? y + ARROW_SIZE / 2 : y - ARROW_SIZE / 2;
  return (
    <g>
      <line x1={x} y1={baseY} x2={x} y2={tipY} stroke="currentColor" strokeWidth={1.5} />
      <polygon
        points={`${x},${tipY} ${x - 3},${tipY + (isUp ? 4 : -4)} ${x + 3},${tipY + (isUp ? 4 : -4)}`}
        fill="currentColor"
      />
    </g>
  );
}

/** Group orbital boxes by subshell key (e.g. "3d"). */
function groupBySubshell(boxes: OrbitalBox[]): Map<string, OrbitalBox[]> {
  const groups = new Map<string, OrbitalBox[]>();
  for (const box of boxes) {
    const key = `${box.n}${box.l}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(box);
  }
  return groups;
}

export default function OrbitalBoxDiagram({ Z }: Props) {
  const boxes = getOrbitalBoxes(Z);
  const valence = getValenceElectrons(Z);
  const valenceKeys = new Set(valence.map(v => `${v.n}${v.l}`));
  const groups = groupBySubshell(boxes);

  // Calculate total width
  let totalW = 0;
  const groupPositions: { key: string; x: number; boxes: OrbitalBox[] }[] = [];
  for (const [key, groupBoxes] of groups) {
    groupPositions.push({ key, x: totalW, boxes: groupBoxes });
    totalW += groupBoxes.length * (BOX_W + GAP) - GAP + GROUP_GAP;
  }
  totalW -= GROUP_GAP; // remove trailing gap
  const totalH = BOX_H + LABEL_H + 4;

  return (
    <div className="orbital-box-diagram">
      <div className="orbital-box-diagram__label">Орбитальная диаграмма</div>
      <svg
        viewBox={`0 0 ${Math.max(totalW, 1)} ${totalH}`}
        width="100%"
        style={{ maxHeight: '80px' }}
        role="img"
        aria-label="Орбитальная диаграмма"
      >
        {groupPositions.map(({ key, x, boxes: groupBoxes }) => {
          const isValence = valenceKeys.has(key);
          return (
            <g key={key}>
              {groupBoxes.map((box, i) => {
                const bx = x + i * (BOX_W + GAP);
                const cy = BOX_H / 2;
                return (
                  <g key={i}>
                    <rect
                      x={bx}
                      y={0}
                      width={BOX_W}
                      height={BOX_H}
                      fill={isValence ? 'var(--color-primary-bg, #eff6ff)' : 'var(--color-bg-alt, #f8fafc)'}
                      stroke={isValence ? 'var(--color-primary, #2563eb)' : 'var(--color-border, #cbd5e1)'}
                      strokeWidth={isValence ? 1.5 : 1}
                      rx={2}
                    />
                    {box.spins[0] !== 'empty' && (
                      <Arrow x={bx + BOX_W / 2 - 4} y={cy} direction="up" />
                    )}
                    {box.spins[1] !== 'empty' && (
                      <Arrow x={bx + BOX_W / 2 + 4} y={cy} direction="down" />
                    )}
                  </g>
                );
              })}
              <text
                x={x + (groupBoxes.length * (BOX_W + GAP) - GAP) / 2}
                y={BOX_H + LABEL_H}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-text-muted, #64748b)"
              >
                {key}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
