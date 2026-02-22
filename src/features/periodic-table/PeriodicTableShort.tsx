import type { Element, ElementGroup } from '../../types/element';
import * as m from '../../paraglide/messages.js';
import ElementCell from './ElementCell';

interface PeriodicTableShortProps {
  elements: Element[];
  highlightedGroup: ElementGroup | null;
  searchMatchedZ: Set<number> | null;
  exceptionZSet?: Set<number>;
  onSelect: (element: Element) => void;
  onHoverElement: (group: ElementGroup) => void;
  onHoverElementEnd: () => void;
  onHoverGroup?: (group: ElementGroup) => void;
  onHoverGroupEnd?: () => void;
}

/** Map IUPAC group + period to the short-form grid column (1-indexed). */
function getShortCol(group: number, period: number): number {
  if (period <= 3) {
    const map: Record<number, number> = {
      1: 3, 2: 4, 13: 5, 14: 6, 15: 7, 16: 8, 17: 9, 18: 13,
    };
    return map[group] ?? 3;
  }
  // Large periods (4-7)
  if (group <= 10) return group + 2; // 1->3 .. 10->12
  if (group <= 12) return group - 8; // 11->3, 12->4
  if (group <= 17) return group - 8; // 13->5 .. 17->9
  return 13; // 18 -> noble gas column
}

/**
 * Map element to (gridRow, gridCol) in the 11-row Mendeleev layout.
 * Returns null for lanthanides (Z 58-71) and actinides (Z 90-103),
 * which are rendered in separate rows below the main grid.
 */
function getShortPosition(
  el: Element,
): { row: number; col: number } | null {
  const { Z, group, period } = el;

  // Lanthanides (Ce-Lu) and actinides (Th-Lr) go to separate rows
  if (Z >= 58 && Z <= 71) return null;
  if (Z >= 90 && Z <= 103) return null;

  let rowNum: number;
  if (period <= 3) {
    rowNum = period; // periods 1-3 -> rows 1,2,3
  } else {
    // period 4 -> rows 4,5; period 5 -> rows 6,7;
    // period 6 -> rows 8,9; period 7 -> rows 10,11
    const firstRow = 4 + (period - 4) * 2;
    if (group <= 10) {
      rowNum = firstRow; // first row: s-block + d-block
    } else {
      rowNum = firstRow + 1; // second row: late d-block + p-block
    }
  }

  const col = getShortCol(group, period);
  // +1 because grid row 1 is headers
  return { row: rowNum + 1, col };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const;

export default function PeriodicTableShort({
  elements,
  highlightedGroup,
  searchMatchedZ,
  exceptionZSet,
  onSelect,
  onHoverElement,
  onHoverElementEnd,
}: PeriodicTableShortProps) {
  const byZ = new Map<number, Element>();
  for (const el of elements) {
    byZ.set(el.Z, el);
  }

  // Separate elements into main grid vs f-block rows
  const mainElements: Element[] = [];
  const lanthanides: Element[] = [];
  const actinides: Element[] = [];

  for (const el of elements) {
    if (el.Z >= 58 && el.Z <= 71) {
      lanthanides.push(el);
    } else if (el.Z >= 90 && el.Z <= 103) {
      actinides.push(el);
    } else {
      mainElements.push(el);
    }
  }
  lanthanides.sort((a, b) => a.Z - b.Z);
  actinides.sort((a, b) => a.Z - b.Z);

  function renderCell(el: Element) {
    const dimmedByGroup =
      highlightedGroup !== null && el.element_group !== highlightedGroup;
    const dimmedBySearch =
      searchMatchedZ !== null && !searchMatchedZ.has(el.Z);
    const highlighted =
      searchMatchedZ !== null && searchMatchedZ.has(el.Z);

    return (
      <ElementCell
        element={el}
        dimmed={dimmedByGroup || dimmedBySearch}
        highlighted={highlighted}
        isException={exceptionZSet?.has(el.Z)}
        onSelect={onSelect}
        onHoverElement={onHoverElement}
        onHoverElementEnd={onHoverElementEnd}
      />
    );
  }

  // Header row (grid row 1): group roman numerals
  const groupHeaders = ROMAN.map((label, i) => {
    if (i < 7) {
      return (
        <div
          key={label}
          className="pt-short-header"
          style={{ gridRow: 1, gridColumn: i + 3 }}
        >
          {label}
        </div>
      );
    }
    // Group VIII spans cols 10-13
    return (
      <div
        key={label}
        className="pt-short-header"
        style={{ gridRow: 1, gridColumn: '10 / span 4' }}
      >
        {label}
      </div>
    );
  });

  // Period labels (col 1)
  const periodLabels: React.ReactNode[] = [];
  for (let p = 1; p <= 7; p++) {
    if (p <= 3) {
      periodLabels.push(
        <div
          key={`period-${p}`}
          className="pt-grid-label pt-grid-label--period"
          style={{ gridRow: p + 1, gridColumn: 1 }}
        >
          {p}
        </div>,
      );
    } else {
      // period 4 -> gridRow 5 (span 2), period 5 -> gridRow 7 (span 2), etc.
      const startRow = 4 + (p - 4) * 2 + 1;
      periodLabels.push(
        <div
          key={`period-${p}`}
          className="pt-grid-label pt-grid-label--period"
          style={{
            gridRow: `${startRow} / span 2`,
            gridColumn: 1,
          }}
        >
          {p}
        </div>,
      );
    }
  }

  // Row labels (col 2): rows 1-11
  const rowLabels: React.ReactNode[] = [];
  for (let r = 1; r <= 11; r++) {
    rowLabels.push(
      <div
        key={`row-${r}`}
        className="pt-grid-label pt-grid-label--period"
        style={{ gridRow: r + 1, gridColumn: 2 }}
      >
        {r}
      </div>,
    );
  }

  // Hydrogen appears twice: group I (parenthesized) and group VII
  const hydrogen = byZ.get(1);
  const hydrogenCells: React.ReactNode[] = [];
  if (hydrogen) {
    // H in group VII (row 1 -> gridRow 2, col 9)
    hydrogenCells.push(
      <div key="H-VII" style={{ gridRow: 2, gridColumn: 9 }}>
        {renderCell(hydrogen)}
      </div>,
    );
    // H in group I (row 1 -> gridRow 2, col 3), parenthesized
    hydrogenCells.push(
      <div key="H-I" style={{ gridRow: 2, gridColumn: 3 }} className="pt-cell-paren">
        {renderCell(hydrogen)}
      </div>,
    );
  }

  // Main elements (excluding H)
  const mainCells: React.ReactNode[] = [];
  for (const el of mainElements) {
    if (el.Z === 1) continue;
    const pos = getShortPosition(el);
    if (!pos) continue;

    const isLa = el.Z === 57;
    const isAc = el.Z === 89;

    mainCells.push(
      <div
        key={el.Z}
        style={{ gridRow: pos.row, gridColumn: pos.col }}
        className={isLa || isAc ? 'pt-short-fblock-marker' : undefined}
      >
        {renderCell(el)}
        {isLa && <span className="pt-short-marker">*</span>}
        {isAc && <span className="pt-short-marker">**</span>}
      </div>,
    );
  }

  return (
    <div className="pt-short-wrapper">
      {/* Main 11-row grid */}
      <div className="pt-grid-short">
        {/* Header labels */}
        <div
          className="pt-grid-label pt-grid-label--period"
          style={{ gridRow: 1, gridColumn: 1 }}
        >
          {m.elem_period()}
        </div>
        <div
          className="pt-grid-label pt-grid-label--period"
          style={{ gridRow: 1, gridColumn: 2 }}
        >
          {m.pt_short_row()}
        </div>

        {groupHeaders}
        {periodLabels}
        {rowLabels}
        {hydrogenCells}
        {mainCells}
      </div>

      {/* Lanthanide series */}
      <div className="pt-short-fblock-row">
        <span className="pt-short-fblock-label">* {m.pt_short_lanthanides()}</span>
        <div className="pt-short-fblock-cells">
          {lanthanides.map((el) => (
            <div key={el.Z} className="pt-short-fblock-cell">
              {renderCell(el)}
            </div>
          ))}
        </div>
      </div>

      {/* Actinide series */}
      <div className="pt-short-fblock-row">
        <span className="pt-short-fblock-label">** {m.pt_short_actinides()}</span>
        <div className="pt-short-fblock-cells">
          {actinides.map((el) => (
            <div key={el.Z} className="pt-short-fblock-cell">
              {renderCell(el)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
