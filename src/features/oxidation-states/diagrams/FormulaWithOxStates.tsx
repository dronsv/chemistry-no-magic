import * as m from '../../../paraglide/messages.js';

interface Props {
  assignments: Array<{ symbol: string; state: number }>;
  counts: Record<string, number>;
}

const COL_WIDTH = 50;
const STATE_Y = 18;
const SYMBOL_Y = 48;
const SUBSCRIPT_Y = 58;

function formatState(state: number): string {
  if (state === 0) return "0";
  if (state > 0) return `+${state}`;
  return `\u2212${Math.abs(state)}`;
}

function stateColor(state: number): string {
  if (state > 0) return "#dc2626";
  if (state < 0) return "#2563eb";
  return "#6b7280";
}

function buildAriaLabel(
  assignments: Array<{ symbol: string; state: number }>,
  counts: Record<string, number>,
): string {
  const parts = assignments.map(({ symbol, state }) => {
    const count = counts[symbol] ?? 1;
    const countStr = count > 1 ? `${count}` : "";
    return `${symbol}${countStr}: ${formatState(state)}`;
  });
  return m.pt_ox_states({ parts: parts.join(", ") });
}

export default function FormulaWithOxStates({ assignments, counts }: Props) {
  const totalWidth = assignments.length * COL_WIDTH;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} 70`}
      width="100%"
      role="img"
      aria-label={buildAriaLabel(assignments, counts)}
    >
      {assignments.map(({ symbol, state }, i) => {
        const cx = i * COL_WIDTH + COL_WIDTH / 2;
        const count = counts[symbol] ?? 1;

        return (
          <g key={`${symbol}-${i}`}>
            {/* Oxidation state above */}
            <text
              x={cx}
              y={STATE_Y}
              textAnchor="middle"
              fontSize={14}
              fill={stateColor(state)}
            >
              {formatState(state)}
            </text>

            {/* Element symbol */}
            <text
              x={cx}
              y={SYMBOL_Y}
              textAnchor="middle"
              fontSize={24}
              fontWeight={700}
              fill="currentColor"
            >
              {symbol}
            </text>

            {/* Subscript count (only if > 1) */}
            {count > 1 && (
              <text
                x={cx + symbol.length * 7 + 4}
                y={SUBSCRIPT_Y}
                textAnchor="start"
                fontSize={14}
                fill="var(--color-text-muted, #6b7280)"
              >
                {count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
