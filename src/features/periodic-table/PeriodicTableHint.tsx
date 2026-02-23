import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Element, ElementGroup } from '../../types/element';
import type { ElementGroupDict } from '../../types/element-group';
import type { SupportedLocale } from '../../types/i18n';
import { loadElements, loadElementGroups } from '../../lib/data-loader';
import { setConfigOverrides } from '../../lib/electron-config';
import * as m from '../../paraglide/messages.js';
import PeriodicTableLong from './PeriodicTableLong';
import PeriodicTableShort from './PeriodicTableShort';
import ElementDetails from './ElementDetails';
import TrendsOverlay from './TrendsOverlay';
import { usePanelState } from '../../lib/use-panel-state';
import './periodic-table.css';

type FormType = 'long' | 'short';

export default function PeriodicTableHint({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const { isOpen, setIsOpen, pos, setPos, hasMoved, setHasMoved, toggle: panelToggle, close: panelClose } = usePanelState('periodic-table');
  const [formType, setFormType] = useState<FormType>('long');
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [groups, setGroups] = useState<ElementGroupDict>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedGroup, setHighlightedGroup] = useState<ElementGroup | null>(null);
  const [hoveredElementGroup, setHoveredElementGroup] = useState<ElementGroup | null>(null);
  const [showTrends, setShowTrends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Search — match elements by symbol, name_ru, name_en, name_latin
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

  // Drag state
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const toggle = useCallback(() => {
    if (isOpen) setSelectedElement(null);
    panelToggle();
  }, [isOpen, panelToggle]);

  const close = useCallback(() => {
    setSelectedElement(null);
    panelClose();
  }, [panelClose]);

  // Load elements on first open
  useEffect(() => {
    if (!isOpen || elements.length > 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([loadElements(locale), loadElementGroups(locale)])
      .then(([els, grps]) => {
        if (!cancelled) {
          setConfigOverrides(els);
          setElements(els);
          setGroups(grps);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : m.error_loading());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, elements.length]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Read current panel position (handles first drag when positioned via CSS right/top)
  function getCurrentPos(): { x: number; y: number } {
    if (hasMoved) return pos;
    const el = panelRef.current;
    if (!el) return pos;
    const rect = el.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const current = getCurrentPos();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: current.x,
      origY: current.y,
    };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
      setHasMoved(true);
    }

    function onUp() {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos, hasMoved]);

  // Touch drag handlers
  const onTouchDragStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const current = getCurrentPos();
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      origX: current.x,
      origY: current.y,
    };

    function onMove(ev: TouchEvent) {
      if (!dragRef.current) return;
      const t = ev.touches[0];
      const dx = t.clientX - dragRef.current.startX;
      const dy = t.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
      setHasMoved(true);
    }

    function onEnd() {
      dragRef.current = null;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    }

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, [pos, hasMoved]);

  const handleSelect = useCallback((element: Element) => {
    setSelectedElement(element);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedElement(null);
  }, []);

  // Legend hover — full effect: dims elements + shows tooltip
  const handleLegendHover = useCallback((group: ElementGroup) => {
    setHighlightedGroup(group);
  }, []);

  const handleLegendHoverEnd = useCallback(() => {
    setHighlightedGroup(null);
  }, []);

  // Element hover — only highlights legend item
  const handleElementHover = useCallback((group: ElementGroup) => {
    setHoveredElementGroup(group);
  }, []);

  const handleElementHoverEnd = useCallback(() => {
    setHoveredElementGroup(null);
  }, []);

  const exceptionZSet = useMemo(
    () => new Set(elements.filter(e => e.electron_exception).map(e => e.Z)),
    [elements],
  );

  const TableComponent = formType === 'long' ? PeriodicTableLong : PeriodicTableShort;

  const panelStyle: React.CSSProperties = hasMoved
    ? { top: pos.y, left: pos.x, right: 'auto', transform: 'none' }
    : {};

  const groupInfo = highlightedGroup ? groups[highlightedGroup] : null;

  return (
    <>
      {/* Trigger button — sits in the navbar */}
      <button
        className={`pt-trigger ${isOpen ? 'pt-trigger--active' : ''}`}
        onClick={toggle}
        type="button"
        aria-label={m.pt_open_table()}
      >
        <span className="pt-trigger__icon" aria-hidden="true">
          <span /><span /><span />
          <span /><span /><span />
          <span /><span /><span />
        </span>
        <span className="hint-label-full">{m.pt_hint_label_full()}</span>
        <span className="hint-label-short">{m.pt_hint_label_short()}</span>
      </button>

      {/* Floating panel (non-modal, draggable) */}
      {isOpen && (
        <div className="pt-panel" ref={panelRef} style={panelStyle}>
          {/* Draggable header */}
          <div
            className="pt-panel__header"
            onMouseDown={onDragStart}
            onTouchStart={onTouchDragStart}
          >
            <h2 className="pt-panel__title">
              {m.pt_hint_title()}
            </h2>
            <button
              className="pt-panel__close"
              onClick={close}
              type="button"
              aria-label={m.close_label()}
            >
              &times;
            </button>
          </div>

          {/* Toolbar: form toggle + search + trends button */}
          <div className="pt-toolbar">
            <div className="pt-toggle">
              <button
                className={`pt-toggle__btn ${formType === 'long' ? 'pt-toggle__btn--active' : ''}`}
                onClick={() => { setFormType('long'); setShowTrends(false); }}
                type="button"
              >
                {m.pt_form_long()}
              </button>
              <button
                className={`pt-toggle__btn ${formType === 'short' ? 'pt-toggle__btn--active' : ''}`}
                onClick={() => { setFormType('short'); setShowTrends(false); }}
                type="button"
              >
                {m.pt_form_short()}
              </button>
            </div>
            <input
              className="pt-search"
              type="text"
              placeholder={m.pt_search_generic()}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className={`pt-trends-btn ${showTrends ? 'pt-trends-btn--active' : ''}`}
              onClick={() => setShowTrends((prev) => !prev)}
              type="button"
            >
              {m.pt_trends()}
            </button>
          </div>

          {/* Content */}
          <div className="pt-panel__content">
            {loading && (
              <div className="pt-panel__loading">{m.loading()}</div>
            )}

            {error && (
              <div className="pt-panel__error">{error}</div>
            )}

            {!loading && !error && elements.length > 0 && !showTrends && (
              <TableComponent
                elements={elements}
                highlightedGroup={highlightedGroup}
                searchMatchedZ={searchMatchedZ}
                exceptionZSet={exceptionZSet}
                onSelect={handleSelect}
                onHoverElement={handleElementHover}
                onHoverElementEnd={handleElementHoverEnd}
                onHoverGroup={handleLegendHover}
                onHoverGroupEnd={handleLegendHoverEnd}
              />
            )}

            {!loading && !error && elements.length > 0 && showTrends && (
              <TrendsOverlay gridWidth={960} gridHeight={600} />
            )}

            {/* Info bar — always present, shows group details or default hint */}
            <div className="pt-info-bar">
              {groupInfo ? (
                <>
                  <strong>{groupInfo.name_ru}</strong>
                  <span>{groupInfo.description_ru}</span>
                </>
              ) : (
                <span>{m.pt_info_default()}</span>
              )}
            </div>
          </div>

          {/* Selected element details */}
          {selectedElement && !showTrends && (
            <ElementDetails
              element={selectedElement}
              groups={groups}
              onClose={handleCloseDetails}
            />
          )}

        </div>
      )}
    </>
  );
}
