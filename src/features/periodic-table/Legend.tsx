import type { ElementGroup } from '../../types/element';

interface LegendEntry {
  group: ElementGroup;
  label: string;
  cssVar: string;
}

const LEGEND_ITEMS: LegendEntry[] = [
  { group: 'alkali_metal', label: 'Щелочные металлы', cssVar: 'var(--color-alkali-metal)' },
  { group: 'alkaline_earth', label: 'Щёлочноземельные', cssVar: 'var(--color-alkaline-earth)' },
  { group: 'transition_metal', label: 'Переходные металлы', cssVar: 'var(--color-transition-metal)' },
  { group: 'post_transition_metal', label: 'Постпереходные металлы', cssVar: 'var(--color-post-transition-metal)' },
  { group: 'metalloid', label: 'Металлоиды', cssVar: 'var(--color-metalloid)' },
  { group: 'nonmetal', label: 'Неметаллы', cssVar: 'var(--color-nonmetal)' },
  { group: 'halogen', label: 'Галогены', cssVar: 'var(--color-halogen)' },
  { group: 'noble_gas', label: 'Благородные газы', cssVar: 'var(--color-noble-gas)' },
  { group: 'lanthanide', label: 'Лантаноиды', cssVar: 'var(--color-lanthanide)' },
  { group: 'actinide', label: 'Актиноиды', cssVar: 'var(--color-actinide)' },
];

interface LegendProps {
  highlightedGroup: ElementGroup | null;
  onHoverGroup: (group: ElementGroup) => void;
  onHoverGroupEnd: () => void;
}

export default function Legend({ highlightedGroup, onHoverGroup, onHoverGroupEnd }: LegendProps) {
  return (
    <div className="pt-legend">
      {LEGEND_ITEMS.map((item) => (
        <div
          className={`pt-legend__item ${highlightedGroup === item.group ? 'pt-legend__item--active' : ''}`}
          key={item.group}
          onMouseEnter={() => onHoverGroup(item.group)}
          onMouseLeave={onHoverGroupEnd}
        >
          <span
            className="pt-legend__swatch"
            style={{ backgroundColor: item.cssVar }}
          />
          <span className="pt-legend__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
