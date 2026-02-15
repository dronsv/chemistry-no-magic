import { getEnergyLevels } from '../../lib/electron-config';

interface Props {
  Z: number;
}

const LEVEL_H = 22;
const PADDING_X = 40;
const PADDING_Y = 12;
const LINE_W = 50;
const DOT_R = 3;

export default function EnergyLevelDiagram({ Z }: Props) {
  const levels = getEnergyLevels(Z);
  if (levels.length === 0) return null;

  const totalLevels = levels.length;
  const svgH = totalLevels * LEVEL_H + PADDING_Y * 2;
  const svgW = PADDING_X + LINE_W + 60;

  return (
    <div className="energy-level-diagram">
      <div className="energy-level-diagram__label">Энергетическая диаграмма</div>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        style={{ maxHeight: '300px' }}
        role="img"
        aria-label="Энергетическая диаграмма"
      >
        {/* Energy axis */}
        <line
          x1={12}
          y1={PADDING_Y}
          x2={12}
          y2={svgH - PADDING_Y}
          stroke="var(--color-border, #cbd5e1)"
          strokeWidth={1}
        />
        <text
          x={10}
          y={PADDING_Y - 2}
          textAnchor="middle"
          fontSize={9}
          fill="var(--color-text-muted, #64748b)"
        >
          E↑
        </text>

        {/* Levels — bottom = lowest energy (highest index), top = highest energy */}
        {levels.map((level, i) => {
          const y = svgH - PADDING_Y - (i + 0.5) * LEVEL_H;
          const x0 = PADDING_X;
          const x1 = PADDING_X + LINE_W;

          return (
            <g key={`${level.n}${level.l}`}>
              {/* Horizontal energy line */}
              <line
                x1={x0}
                y1={y}
                x2={x1}
                y2={y}
                stroke={level.is_valence ? 'var(--color-primary, #2563eb)' : 'var(--color-text-muted, #94a3b8)'}
                strokeWidth={level.is_valence ? 2 : 1.5}
              />

              {/* Label */}
              <text
                x={x0 - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fontWeight={level.is_valence ? 600 : 400}
                fill={level.is_valence ? 'var(--color-primary, #2563eb)' : 'var(--color-text, #334155)'}
              >
                {level.n}{level.l}
              </text>

              {/* Electron dots */}
              {Array.from({ length: level.electrons }, (_, j) => {
                const dotX = x0 + 8 + j * (DOT_R * 2 + 2);
                return (
                  <circle
                    key={j}
                    cx={dotX}
                    cy={y - 5}
                    r={DOT_R}
                    fill={level.is_valence ? 'var(--color-primary, #2563eb)' : 'var(--color-text-muted, #64748b)'}
                  />
                );
              })}

              {/* Electron count */}
              <text
                x={x1 + 6}
                y={y + 4}
                fontSize={9}
                fill="var(--color-text-muted, #64748b)"
              >
                {level.electrons}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
