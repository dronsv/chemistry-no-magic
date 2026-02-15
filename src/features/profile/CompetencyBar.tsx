import type { CompetencyLevel } from '../../lib/bkt-engine';
import { getLevel } from '../../lib/bkt-engine';

const LEVEL_LABELS: Record<CompetencyLevel, string> = {
  none: 'Начальный',
  basic: 'Базовый',
  confident: 'Уверенный',
  automatic: 'Автоматизм',
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
        {LEVEL_LABELS[level]}
      </span>
    </div>
  );
}
