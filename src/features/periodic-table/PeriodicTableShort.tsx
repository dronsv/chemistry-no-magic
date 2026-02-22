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

export default function PeriodicTableShort({
  elements, highlightedGroup, searchMatchedZ, exceptionZSet, onSelect, onHoverElement, onHoverElementEnd,
}: PeriodicTableShortProps) {
  const sorted = [...elements].sort((a, b) => a.Z - b.Z);

  const mainElements = sorted.filter(
    (el) => !((el.Z >= 57 && el.Z <= 71) || (el.Z >= 89 && el.Z <= 103)),
  );

  const headers: { label: string; colStart: number; colSpan: number }[] = [
    { label: 'I', colStart: 2, colSpan: 1 },
    { label: 'II', colStart: 3, colSpan: 1 },
    { label: 'III', colStart: 4, colSpan: 2 },
    { label: 'IV', colStart: 6, colSpan: 2 },
    { label: 'V', colStart: 8, colSpan: 2 },
    { label: 'VI', colStart: 10, colSpan: 2 },
    { label: 'VII', colStart: 12, colSpan: 2 },
    { label: 'VIII', colStart: 14, colSpan: 4 },
  ];

  function iupacToShortCol(g: number): number {
    const colMap: Record<number, number> = {
      1: 2, 2: 3,
      3: 4, 13: 5,
      4: 6, 14: 7,
      5: 8, 15: 9,
      6: 10, 16: 11,
      7: 12, 17: 13,
      8: 14, 9: 15, 10: 16, 18: 17,
      11: 2, 12: 3,
    };
    return colMap[g] ?? 2;
  }

  return (
    <div className="pt-grid-short">
      {headers.map((h) => (
        <div
          key={h.label}
          className="pt-short-header"
          style={{ gridRow: 1, gridColumn: `${h.colStart} / span ${h.colSpan}` }}
        >
          {h.label}
        </div>
      ))}

      <div className="pt-short-sub" style={{ gridRow: 2, gridColumn: '2 / span 2' }}>
        {m.pt_group_a()} &nbsp;&nbsp; {m.pt_group_a()}
      </div>
      {[4, 6, 8, 10, 12].map((col) => (
        <div key={`sub-${col}`} className="pt-short-sub"
          style={{ gridRow: 2, gridColumn: `${col} / span 2` }}>
          {m.pt_group_b()} &nbsp; {m.pt_group_a()}
        </div>
      ))}
      <div className="pt-short-sub" style={{ gridRow: 2, gridColumn: '14 / span 4' }}>
        {m.pt_group_b()} &nbsp; {m.pt_group_b()} &nbsp; {m.pt_group_b()} &nbsp; {m.pt_group_a()}
      </div>

      {[1, 2, 3, 4, 5, 6, 7].map((p) => (
        <div key={`period-${p}`} className="pt-grid-label pt-grid-label--period"
          style={{ gridRow: p + 2, gridColumn: 1 }}>
          {p}
        </div>
      ))}

      {mainElements.map((el) => {
        const col = iupacToShortCol(el.group);
        const row = el.period + 2;
        const dimmedByGroup = highlightedGroup !== null && el.element_group !== highlightedGroup;
        const dimmedBySearch = searchMatchedZ !== null && !searchMatchedZ.has(el.Z);
        const highlighted = searchMatchedZ !== null && searchMatchedZ.has(el.Z);

        return (
          <div key={el.Z} style={{ gridRow: row, gridColumn: col }}>
            <ElementCell
              element={el}
              dimmed={dimmedByGroup || dimmedBySearch}
              highlighted={highlighted}
              isException={exceptionZSet?.has(el.Z)}
              onSelect={onSelect}
              onHoverElement={onHoverElement}
              onHoverElementEnd={onHoverElementEnd}
            />
          </div>
        );
      })}
    </div>
  );
}
