import type { SupportedLocale } from '../../../types/i18n';
import FormulaChip from '../../../components/FormulaChip';

interface Props {
  assignments: Array<{ symbol: string; state: number }>;
  locale?: SupportedLocale;
}

function formatState(state: number): string {
  if (state === 0) return '0';
  if (state > 0) return `+${state}`;
  return `\u2212${Math.abs(state)}`;
}

function stateColor(state: number): string {
  if (state > 0) return '#dc2626';
  if (state < 0) return '#2563eb';
  return '#6b7280';
}

export default function FormulaWithOxStates({ assignments, locale }: Props) {
  return (
    <div
      className="ox-formula-row"
      role="img"
      aria-label={assignments.map(a => `${a.symbol}: ${formatState(a.state)}`).join(', ')}
    >
      {assignments.map(({ symbol, state }, i) => (
        <div key={`${symbol}-${i}`} className="ox-formula-cell">
          <span
            className="ox-formula-cell__state"
            style={{ color: stateColor(state) }}
          >
            {formatState(state)}
          </span>
          <FormulaChip
            formula={symbol}
            elementId={symbol}
            substanceClass="simple"
            locale={locale}
          />
        </div>
      ))}
    </div>
  );
}
