import type { ElementGroup } from '../../types/element';
import * as m from '../../paraglide/messages.js';

interface GroupBlocksProps {
  highlightedGroup: ElementGroup | null;
  onHoverGroup: (group: ElementGroup) => void;
  onHoverGroupEnd: () => void;
}

/** CSS variable from group id: alkali_metal → var(--color-alkali-metal) */
function groupCssVar(id: string): string {
  return `var(--color-${id.replace(/_/g, '-')})`;
}

interface BlockDef {
  id: ElementGroup;
  short: () => string;
  desc: () => string;
  gridRow: number;
  gridColumn: number;
}

/**
 * 5x2 grid of group category blocks laid out inside the empty d-block space
 * (periods 1-2, groups 3-12 in the 18-column IUPAC layout).
 *
 * Each block spans 2 grid columns of the parent `.pt-grid-long`.
 *
 * Row 1 (gridRow 2 = period 1): Alkali | Alk.earth | Transition | Post-trans | Metalloids
 * Row 2 (gridRow 3 = period 2): Nonmet | Halogens  | Noble gas  | Lanthan    | Actinides
 *
 * Grid columns 4-13 map to groups 3-12. Each block occupies 2 columns:
 *   Block 0: cols 4-5,  Block 1: cols 6-7,  Block 2: cols 8-9,
 *   Block 3: cols 10-11, Block 4: cols 12-13
 */
const BLOCKS: BlockDef[] = [
  // Row 1 (gridRow 2)
  { id: 'alkali_metal',        short: () => m.group_alkali_metal_short(),        desc: () => m.group_alkali_metal_desc(),        gridRow: 2, gridColumn: 4 },
  { id: 'alkaline_earth',      short: () => m.group_alkaline_earth_short(),      desc: () => m.group_alkaline_earth_desc(),      gridRow: 2, gridColumn: 6 },
  { id: 'transition_metal',    short: () => m.group_transition_metal_short(),    desc: () => m.group_transition_metal_desc(),    gridRow: 2, gridColumn: 8 },
  { id: 'post_transition_metal', short: () => m.group_post_transition_metal_short(), desc: () => m.group_post_transition_metal_desc(), gridRow: 2, gridColumn: 10 },
  { id: 'metalloid',           short: () => m.group_metalloid_short(),           desc: () => m.group_metalloid_desc(),           gridRow: 2, gridColumn: 12 },
  // Row 2 (gridRow 3)
  { id: 'nonmetal',            short: () => m.group_nonmetal_short(),            desc: () => m.group_nonmetal_desc(),            gridRow: 3, gridColumn: 4 },
  { id: 'halogen',             short: () => m.group_halogen_short(),             desc: () => m.group_halogen_desc(),             gridRow: 3, gridColumn: 6 },
  { id: 'noble_gas',           short: () => m.group_noble_gas_short(),           desc: () => m.group_noble_gas_desc(),           gridRow: 3, gridColumn: 8 },
  { id: 'lanthanide',          short: () => m.group_lanthanide_short(),          desc: () => m.group_lanthanide_desc(),          gridRow: 3, gridColumn: 10 },
  { id: 'actinide',            short: () => m.group_actinide_short(),            desc: () => m.group_actinide_desc(),            gridRow: 3, gridColumn: 12 },
];

/**
 * Renders 10 colored group category blocks as direct grid children of `.pt-grid-long`.
 * Uses React Fragment so each block is a direct grid item (no wrapper div).
 */
export default function GroupBlocks({ highlightedGroup, onHoverGroup, onHoverGroupEnd }: GroupBlocksProps) {
  return (
    <>
      {BLOCKS.map((block) => {
        const isActive = highlightedGroup === block.id;
        const cls = [
          'pt-group-block',
          isActive ? 'pt-group-block--active' : '',
        ].filter(Boolean).join(' ');

        return (
          <div
            key={block.id}
            className={cls}
            style={{
              gridRow: block.gridRow,
              gridColumn: `${block.gridColumn} / span 2`,
              backgroundColor: groupCssVar(block.id),
            }}
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
    </>
  );
}
