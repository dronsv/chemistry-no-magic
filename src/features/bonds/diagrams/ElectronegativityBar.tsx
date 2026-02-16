interface Props {
  symbolA: string;
  symbolB: string;
  chiA: number;
  chiB: number;
}

const SCALE_LEFT = 30;
const SCALE_RIGHT = 310;
const SCALE_WIDTH = SCALE_RIGHT - SCALE_LEFT;
const SCALE_Y = 42;
const CHI_MAX = 4.0;

const ZONES = [
  { from: 0, to: 0.4, fill: '#dcfce7', label: 'неполярная' },
  { from: 0.4, to: 1.7, fill: '#fef9c3', label: 'полярная' },
  { from: 1.7, to: CHI_MAX, fill: '#fee2e2', label: 'ионная' },
] as const;

function chiToX(chi: number): number {
  return SCALE_LEFT + (chi / CHI_MAX) * SCALE_WIDTH;
}

function getMarkerColor(chi: number): string {
  if (chi < 1.0) return '#22c55e';
  if (chi < 2.5) return '#2563eb';
  return '#dc2626';
}

export default function ElectronegativityBar({ symbolA, symbolB, chiA, chiB }: Props) {
  const xA = chiToX(chiA);
  const xB = chiToX(chiB);
  const delta = Math.abs(chiA - chiB);
  const leftX = Math.min(xA, xB);
  const rightX = Math.max(xA, xB);
  const bracketY = SCALE_Y + 18;
  const ticks = [0, 1.0, 2.0, 3.0, 4.0];

  return (
    <svg
      viewBox="0 0 340 80"
      width="100%"
      role="img"
      aria-label={`Электроотрицательность: ${symbolA} (${chiA}) и ${symbolB} (${chiB}), Δχ = ${delta.toFixed(2)}`}
    >
      {/* Background zone fills */}
      {ZONES.map((zone) => {
        const zoneLeftX = chiToX(zone.from);
        const zoneRightX = chiToX(zone.to);
        return (
          <rect
            key={zone.label}
            x={zoneLeftX}
            y={SCALE_Y - 14}
            width={zoneRightX - zoneLeftX}
            height={12}
            fill={zone.fill}
            rx={2}
          />
        );
      })}

      {/* Scale line */}
      <line
        x1={SCALE_LEFT}
        y1={SCALE_Y}
        x2={SCALE_RIGHT}
        y2={SCALE_Y}
        stroke="var(--color-border, #e5e7eb)"
        strokeWidth={2}
      />

      {/* Tick marks and labels */}
      {ticks.map((t) => {
        const tx = chiToX(t);
        return (
          <g key={t}>
            <line
              x1={tx}
              y1={SCALE_Y - 4}
              x2={tx}
              y2={SCALE_Y + 4}
              stroke="var(--color-text-muted, #6b7280)"
              strokeWidth={1}
            />
            <text
              x={tx}
              y={SCALE_Y + 14}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-text-muted, #6b7280)"
            >
              {t.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Marker A */}
      <circle cx={xA} cy={SCALE_Y} r={5} fill={getMarkerColor(chiA)} />
      <text
        x={xA}
        y={SCALE_Y - 10}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={getMarkerColor(chiA)}
      >
        {symbolA}
      </text>

      {/* Marker B */}
      <circle cx={xB} cy={SCALE_Y} r={5} fill={getMarkerColor(chiB)} />
      <text
        x={xB}
        y={SCALE_Y - 10}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={getMarkerColor(chiB)}
      >
        {symbolB}
      </text>

      {/* Delta bracket between markers */}
      {delta > 0 && (
        <g>
          <line
            x1={leftX}
            y1={bracketY}
            x2={leftX}
            y2={bracketY + 6}
            stroke="var(--color-text-muted, #6b7280)"
            strokeWidth={1}
          />
          <line
            x1={rightX}
            y1={bracketY}
            x2={rightX}
            y2={bracketY + 6}
            stroke="var(--color-text-muted, #6b7280)"
            strokeWidth={1}
          />
          <line
            x1={leftX}
            y1={bracketY + 6}
            x2={rightX}
            y2={bracketY + 6}
            stroke="var(--color-text-muted, #6b7280)"
            strokeWidth={1}
          />
          <text
            x={(leftX + rightX) / 2}
            y={bracketY + 18}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill="var(--color-text, #1a1a2e)"
          >
            {`Δχ = ${delta.toFixed(2)}`}
          </text>
        </g>
      )}
    </svg>
  );
}
