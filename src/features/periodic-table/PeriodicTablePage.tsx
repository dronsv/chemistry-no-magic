import { useState, useEffect, useMemo } from 'react';
import type { Element, ElementGroup } from '../../types/element';
import type { ElectronConfigException } from '../../types/electron-config';
import { loadElements, loadElectronConfigExceptions } from '../../lib/data-loader';
import PeriodicTableLong from './PeriodicTableLong';
import PeriodicTableShort from './PeriodicTableShort';
import ElementDetailPanel from './ElementDetailPanel';
import Legend from './Legend';
import TrendsOverlay from './TrendsOverlay';
import PracticeSection from './practice/PracticeSection';
import './periodic-table.css';

type FormType = 'long' | 'short';

export default function PeriodicTablePage() {
  const [elements, setElements] = useState<Element[]>([]);
  const [exceptions, setExceptions] = useState<ElectronConfigException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formType, setFormType] = useState<FormType>('long');
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [highlightedGroup, setHighlightedGroup] = useState<ElementGroup | null>(null);
  const [hoveredElementGroup, setHoveredElementGroup] = useState<ElementGroup | null>(null);
  const [showTrends, setShowTrends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Promise.all([loadElements(), loadElectronConfigExceptions()])
      .then(([els, exc]) => {
        setElements(els);
        setExceptions(exc);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
        setLoading(false);
      });
  }, []);

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
    return <div className="pt-page__loading">Загрузка...</div>;
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
          placeholder="Поиск элемента..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="pt-page__toggles">
          <button
            type="button"
            className={`pt-page__btn ${formType === 'long' ? 'pt-page__btn--active' : ''}`}
            onClick={() => setFormType('long')}
          >
            Длинная
          </button>
          <button
            type="button"
            className={`pt-page__btn ${formType === 'short' ? 'pt-page__btn--active' : ''}`}
            onClick={() => setFormType('short')}
          >
            Короткая
          </button>
          <button
            type="button"
            className={`pt-page__btn ${showTrends ? 'pt-page__btn--active' : ''}`}
            onClick={() => setShowTrends(!showTrends)}
          >
            Тренды
          </button>
        </div>
      </div>

      {/* Legend */}
      <Legend
        highlightedGroup={highlightedGroup ?? hoveredElementGroup}
        onHoverGroup={setHighlightedGroup}
        onHoverGroupEnd={() => setHighlightedGroup(null)}
      />

      {/* Periodic table */}
      <div className="pt-page__table">
        <TableComponent
          elements={elements}
          onSelect={setSelectedElement}
          highlightedGroup={highlightedGroup ?? hoveredElementGroup}
          searchMatchedZ={searchMatchedZ}
          onHoverElement={setHoveredElementGroup}
          onHoverElementEnd={() => setHoveredElementGroup(null)}
        />
        {showTrends && <TrendsOverlay gridWidth={18} gridHeight={10} />}
      </div>

      {/* Element detail panel */}
      {selectedElement && (
        <ElementDetailPanel
          element={selectedElement}
          exceptions={exceptions}
          onClose={() => setSelectedElement(null)}
        />
      )}

      {/* Practice section */}
      {elements.length > 0 && <PracticeSection elements={elements} />}
    </div>
  );
}
