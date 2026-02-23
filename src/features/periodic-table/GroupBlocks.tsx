import type { ElementGroup } from '../../types/element';
import * as m from '../../paraglide/messages.js';

interface GroupBlocksProps {
  highlightedGroup: ElementGroup | null;
  onHoverGroup: (group: ElementGroup) => void;
  onHoverGroupEnd: () => void;
  /** Vertical layout — categories stacked top-to-bottom (used beside the short form) */
  vertical?: boolean;
}

/** CSS variable from group id: alkali_metal → var(--color-alkali-metal) */
function groupCssVar(id: string): string {
  return `var(--color-${id.replace(/_/g, '-')})`;
}

interface BlockDef {
  id: ElementGroup;
  short: () => string;
  desc: () => string;
}

interface CategoryDef {
  key: string;
  label: () => string;
  blocks: BlockDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    key: 'metals',
    label: () => m.group_cat_metals(),
    blocks: [
      { id: 'alkali_metal', short: () => m.group_alkali_metal_short(), desc: () => m.group_alkali_metal_desc() },
      { id: 'alkaline_earth', short: () => m.group_alkaline_earth_short(), desc: () => m.group_alkaline_earth_desc() },
      { id: 'transition_metal', short: () => m.group_transition_metal_short(), desc: () => m.group_transition_metal_desc() },
      { id: 'post_transition_metal', short: () => m.group_post_transition_metal_short(), desc: () => m.group_post_transition_metal_desc() },
      { id: 'lanthanide', short: () => m.group_lanthanide_short(), desc: () => m.group_lanthanide_desc() },
      { id: 'actinide', short: () => m.group_actinide_short(), desc: () => m.group_actinide_desc() },
    ],
  },
  {
    key: 'metalloids',
    label: () => m.group_cat_metalloids(),
    blocks: [
      { id: 'metalloid', short: () => m.group_metalloid_short(), desc: () => m.group_metalloid_desc() },
    ],
  },
  {
    key: 'nonmetals',
    label: () => m.group_cat_nonmetals(),
    blocks: [
      { id: 'nonmetal', short: () => m.group_nonmetal_short(), desc: () => m.group_nonmetal_desc() },
      { id: 'halogen', short: () => m.group_halogen_short(), desc: () => m.group_halogen_desc() },
      { id: 'noble_gas', short: () => m.group_noble_gas_short(), desc: () => m.group_noble_gas_desc() },
    ],
  },
];

/**
 * Structured group legend placed inside the d-block empty space (periods 1-2, groups 3-12).
 * Organized into 3 categories: Metals (6 blocks), Metalloids (1 block), Nonmetals (3 blocks).
 * Renders as a single grid child spanning the d-block area.
 */
export default function GroupBlocks({ highlightedGroup, onHoverGroup, onHoverGroupEnd, vertical }: GroupBlocksProps) {
  const cls = vertical ? 'pt-group-blocks pt-group-blocks--vertical' : 'pt-group-blocks';
  // In long form, position inside d-block empty space via grid placement
  const style = vertical ? undefined : { gridRow: '2 / span 2', gridColumn: '4 / span 10' };
  return (
    <div className={cls} style={style}>
      {CATEGORIES.map((cat) => (
        <div key={cat.key} className={`pt-group-cat pt-group-cat--${cat.key}`}>
          <span className="pt-group-cat__label">{cat.label()}</span>
          <div className="pt-group-cat__blocks">
            {cat.blocks.map((block) => {
              const isActive = highlightedGroup === block.id;
              return (
                <div
                  key={block.id}
                  className={`pt-group-block${isActive ? ' pt-group-block--active' : ''}`}
                  style={{ backgroundColor: groupCssVar(block.id) }}
                  title={`${block.short()} — ${block.desc()}`}
                  role="button"
                  tabIndex={0}
                  onMouseEnter={() => onHoverGroup(block.id)}
                  onMouseLeave={onHoverGroupEnd}
                >
                  <span className="pt-group-block__label">{block.short()}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
