import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Element, ElementGroup } from '../../types/element';
import type { ElementGroupDict } from '../../types/element-group';
import { loadElements, loadElementGroups } from '../../lib/data-loader';
import { setConfigOverrides } from '../../lib/electron-config';
import * as m from '../../paraglide/messages.js';
import PeriodicTableLong from './PeriodicTableLong';
import PeriodicTableShort from './PeriodicTableShort';
import ElementDetailPanel from './ElementDetailPanel';
import Legend from './Legend';
import TrendsOverlay from './TrendsOverlay';
import PracticeSection from './practice/PracticeSection';
import TheoryPanel from './TheoryPanel';
import './periodic-table.css';

type FormType = 'long' | 'short';

export default function PeriodicTablePage() {
  const [elements, setElements] = useState<Element[]>([]);
  const [groups, setGroups] = useState<ElementGroupDict>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formType, setFormType] = useState<FormType>('long');
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [highlightedGroup, setHighlightedGroup] = useState<ElementGroup | null>(null);
  const [hoveredElementGroup, setHoveredElementGroup] = useState<ElementGroup | null>(null);
  const [showTrends, setShowTrends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [tableScale, setTableScale] = useState(1);

  const updateScale = useCallback(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const grid = wrapper.firstElementChild as HTMLElement | null;
    if (!grid) return;
    const gridWidth = grid.scrollWidth;
    const containerWidth = wrapper.clientWidth;
    // On narrow screens, don't scale — use horizontal scroll instead
    if (containerWidth <= 560) {
      setTableScale(1);
      return;
    }
    setTableScale(containerWidth < gridWidth ? containerWidth / gridWidth : 1);
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale, elements, formType]);

  useEffect(() => {
    Promise.all([loadElements(), loadElementGroups()])
      .then(([els, grps]) => {
        setConfigOverrides(els);
        setElements(els);
        setGroups(grps);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : m.error_loading());
        setLoading(false);
      });
  }, []);

  const exceptionZSet = useMemo(
    () => new Set(elements.filter(e => e.electron_exception).map(e => e.Z)),
    [elements],
  );

  const searchMatchedZ = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || elements.length === 0) return null;
    const matched = new Set<number>();
    for (const el of elements) {
      if (
        el.symbol.toLowerCase().includes(q) ||
        el.name_ru.toLowerCase().includes(q) ||
        el.name_en.toLowerCase().includes(q) ||
        el.name_latin.toLowerCase().includes(q) ||
        String(el.Z) === q
      ) {
        matched.add(el.Z);
      }
    }
    return matched.size > 0 ? matched : null;
  }, [searchQuery, elements]);

  if (loading) {
    return <div className="pt-page__loading">{m.loading()}</div>;
  }

  if (error) {
    return <div className="pt-page__error">{error}</div>;
  }

  const TableComponent = formType === 'long' ? PeriodicTableLong : PeriodicTableShort;

  return (
    <div className="pt-page">
      {/* Controls */}
      <div className="pt-page__controls">
        <input
          type="search"
          className="pt-page__search"
          placeholder={m.pt_search_placeholder()}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="pt-page__toggles">
          <button
            type="button"
            className={`pt-page__btn ${formType === 'long' ? 'pt-page__btn--active' : ''}`}
            onClick={() => setFormType('long')}
          >
            {m.pt_form_long()}
          </button>
          <button
            type="button"
            className={`pt-page__btn ${formType === 'short' ? 'pt-page__btn--active' : ''}`}
            onClick={() => setFormType('short')}
          >
            {m.pt_form_short()}
          </button>
          <button
            type="button"
            className={`pt-page__btn ${showTrends ? 'pt-page__btn--active' : ''}`}
            onClick={() => setShowTrends(!showTrends)}
          >
            {m.pt_trends()}
          </button>
        </div>
      </div>

      {/* Legend */}
      <Legend
        groups={groups}
        highlightedGroup={highlightedGroup ?? hoveredElementGroup}
        onHoverGroup={setHighlightedGroup}
        onHoverGroupEnd={() => setHighlightedGroup(null)}
      />

      {/* Periodic table */}
      <div
        ref={tableWrapperRef}
        className="pt-page__table"
        style={tableScale < 1 ? { height: `${(tableWrapperRef.current?.firstElementChild as HTMLElement)?.scrollHeight * tableScale}px` } : undefined}
      >
        <div
          className="pt-page__table-inner"
          style={tableScale < 1 ? { transform: `scale(${tableScale})`, transformOrigin: 'top left' } : undefined}
        >
          <TableComponent
            elements={elements}
            onSelect={setSelectedElement}
            highlightedGroup={highlightedGroup ?? hoveredElementGroup}
            searchMatchedZ={searchMatchedZ}
            exceptionZSet={exceptionZSet}
            onHoverElement={setHoveredElementGroup}
            onHoverElementEnd={() => setHoveredElementGroup(null)}
          />
          {showTrends && <TrendsOverlay gridWidth={18} gridHeight={10} />}
        </div>
      </div>

      {/* Element detail panel */}
      {selectedElement && (
        <ElementDetailPanel
          element={selectedElement}
          groups={groups}
          onClose={() => setSelectedElement(null)}
        />
      )}

      {/* Theory panel — lazy-loaded on expand */}
      <TheoryPanel />

      {/* Practice section */}
      {elements.length > 0 && <PracticeSection elements={elements} />}

    </div>
  );
}
