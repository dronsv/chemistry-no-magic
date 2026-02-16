import type { Element, ElementGroup } from '../../types/element';
import ElementCell from './ElementCell';

interface PeriodicTableLongProps {
  elements: Element[];
  highlightedGroup: ElementGroup | null;
  searchMatchedZ: Set<number> | null;
  exceptionZSet?: Set<number>;
  onSelect: (element: Element) => void;
  onHoverElement: (group: ElementGroup) => void;
  onHoverElementEnd: () => void;
}

function getGridPosition(el: Element): { row: number; col: number } | null {
  const { Z, group, period } = el;

  if (Z >= 57 && Z <= 71) {
    return { row: 9, col: 3 + (Z - 57) };
  }

  if (Z >= 89 && Z <= 103) {
    return { row: 10, col: 3 + (Z - 89) };
  }

  if (group >= 1 && group <= 18 && period >= 1 && period <= 7) {
    return { row: period, col: group };
  }

  return null;
}

export default function PeriodicTableLong({
  elements, highlightedGroup, searchMatchedZ, exceptionZSet, onSelect, onHoverElement, onHoverElementEnd,
}: PeriodicTableLongProps) {
  const sorted = [...elements].sort((a, b) => a.Z - b.Z);

  return (
    <div className="pt-grid-long">
      {Array.from({ length: 18 }, (_, i) => i + 1).map((g) => (
        <div
          key={`group-${g}`}
          className="pt-grid-label pt-grid-label--group"
          style={{ gridRow: 1, gridColumn: g + 1 }}
        >
          {g}
        </div>
      ))}

      {[1, 2, 3, 4, 5, 6, 7].map((p) => (
        <div
          key={`period-${p}`}
          className="pt-grid-label pt-grid-label--period"
          style={{ gridRow: p + 1, gridColumn: 1 }}
        >
          {p}
        </div>
      ))}

      <div className="pt-grid-marker" style={{ gridRow: 7, gridColumn: 4 }}>57-71</div>
      <div className="pt-grid-marker" style={{ gridRow: 8, gridColumn: 4 }}>89-103</div>

      <div className="pt-grid-label pt-grid-label--period" style={{ gridRow: 10, gridColumn: 1 }}>6*</div>
      <div className="pt-grid-label pt-grid-label--period" style={{ gridRow: 11, gridColumn: 1 }}>7*</div>

      {sorted.map((el) => {
        const pos = getGridPosition(el);
        if (!pos) return null;

        const dimmedByGroup = highlightedGroup !== null && el.element_group !== highlightedGroup;
        const dimmedBySearch = searchMatchedZ !== null && !searchMatchedZ.has(el.Z);
        const highlighted = searchMatchedZ !== null && searchMatchedZ.has(el.Z);

        return (
          <div key={el.Z} style={{ gridRow: pos.row + 1, gridColumn: pos.col + 1 }}>
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
