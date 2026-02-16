interface Props {
  symbol: string;
}

const COLS = 3;
const ROWS = 2;
const CATION_R = 20;
const GAP_X = 60;
const GAP_Y = 52;
const OFFSET_X = 60;
const OFFSET_Y = 42;

export default function BondDiagramMetallic({ symbol }: Props) {
  const cations: Array<{ cx: number; cy: number }> = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      cations.push({
        cx: OFFSET_X + col * GAP_X,
        cy: OFFSET_Y + row * GAP_Y,
      });
    }
  }

  const electronPositions = [
    { x: 42, y: 30 },
    { x: 155, y: 25 },
    { x: 240, y: 45 },
    { x: 85, y: 98 },
    { x: 200, y: 105 },
    { x: 140, y: 68 },
  ];

  return (
    <svg
      viewBox="0 0 300 160"
      width="100%"
      role="img"
      aria-label={`Металлическая связь: кристаллическая решётка ${symbol}`}
    >
      {/* Electron cloud background */}
      <rect
        x={20}
        y={15}
        width={260}
        height={110}
        rx={20}
        fill="#93c5fd"
        opacity={0.25}
      />

      {/* Scattered electron labels */}
      {electronPositions.map((pos, i) => (
        <text
          key={i}
          x={pos.x}
          y={pos.y}
          fontSize={9}
          fill="#2563eb"
          opacity={0.7}
        >
          e⁻
        </text>
      ))}

      {/* Cation grid */}
      {cations.map((c, i) => (
        <g key={i}>
          <circle
            cx={c.cx}
            cy={c.cy}
            r={CATION_R}
            fill="#fef3c7"
            stroke="#d97706"
            strokeWidth={1.5}
          />
          <text
            x={c.cx}
            y={c.cy + 5}
            textAnchor="middle"
            fontSize={14}
            fontWeight={600}
            fill="#92400e"
          >
            {symbol}
          </text>
          {/* Superscript "+" */}
          <text
            x={c.cx + 12}
            y={c.cy - 4}
            fontSize={10}
            fontWeight={600}
            fill="#92400e"
          >
            +
          </text>
        </g>
      ))}

      {/* Bond type label */}
      <text
        x={150}
        y={150}
        textAnchor="middle"
        fontSize={12}
        fill="var(--color-text-muted, #6b7280)"
      >
        Металлическая связь
      </text>
    </svg>
  );
}
