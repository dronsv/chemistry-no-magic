import type { SupportedLocale } from '../../../types/i18n';
import FormulaChip from '../../../components/FormulaChip';
import { formatState, stateColor } from '../ox-format';

interface Props {
  assignments: Array<{ symbol: string; state: number }>;
  locale?: SupportedLocale;
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
