import type { ElementGroup } from '../../types/element';
import type { ElementGroupDict } from '../../types/element-group';

/** Order of groups in the legend display. */
const GROUP_ORDER: ElementGroup[] = [
  'alkali_metal', 'alkaline_earth', 'transition_metal', 'post_transition_metal',
  'metalloid', 'nonmetal', 'halogen', 'noble_gas', 'lanthanide', 'actinide',
];

/** CSS variable derived from group id: alkali_metal → var(--color-alkali-metal) */
function groupCssVar(id: string): string {
  return `var(--color-${id.replace(/_/g, '-')})`;
}

interface LegendProps {
  groups: ElementGroupDict;
  highlightedGroup: ElementGroup | null;
  onHoverGroup: (group: ElementGroup) => void;
  onHoverGroupEnd: () => void;
}

export default function Legend({ groups, highlightedGroup, onHoverGroup, onHoverGroupEnd }: LegendProps) {
  return (
    <div className="pt-legend">
      {GROUP_ORDER.map((id) => {
        const info = groups[id];
        if (!info) return null;
        return (
          <div
            className={`pt-legend__item ${highlightedGroup === id ? 'pt-legend__item--active' : ''}`}
            key={id}
            onMouseEnter={() => onHoverGroup(id)}
            onMouseLeave={onHoverGroupEnd}
          >
            <span
              className="pt-legend__swatch"
              style={{ backgroundColor: groupCssVar(id) }}
            />
            <span className="pt-legend__label">{info.name_ru}</span>
          </div>
        );
      })}
    </div>
  );
}
