import type { CompetencyLevel } from '../../lib/bkt-engine';
import { getLevel } from '../../lib/bkt-engine';
import * as m from '../../paraglide/messages.js';

const LEVEL_LABELS: Record<CompetencyLevel, () => string> = {
  none: m.level_none,
  basic: m.level_basic,
  confident: m.level_confident,
  automatic: m.level_automatic,
};

interface CompetencyBarProps {
  name: string;
  pL: number;
}

export default function CompetencyBar({ name, pL }: CompetencyBarProps) {
  const level = getLevel(pL);
  const percent = Math.round(pL * 100);

  return (
    <div className="comp-bar">
      <span className="comp-bar__name">{name}</span>
      <div className="comp-bar__track">
        <div
          className={`comp-bar__fill comp-bar__fill--${level}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="comp-bar__value">{percent}%</span>
      <span className={`comp-bar__level comp-bar__level--${level}`}>
        {LEVEL_LABELS[level]?.() ?? m.level_none()}
      </span>
    </div>
  );
}
