import { useState, useEffect, useCallback, useRef } from 'react';
import SolubilityTable from './SolubilityTable';
import './solubility-hint.css';

export default function SolubilityHint() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  function getCurrentPos() {
    if (hasMoved) return pos;
    const el = panelRef.current;
    if (!el) return pos;
    const rect = el.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const current = getCurrentPos();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: current.x, origY: current.y };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      setPos({ x: dragRef.current.origX + (ev.clientX - dragRef.current.startX), y: dragRef.current.origY + (ev.clientY - dragRef.current.startY) });
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

  const panelStyle: React.CSSProperties = hasMoved
    ? { top: pos.y, left: pos.x, right: 'auto', transform: 'none' }
    : {};

  return (
    <>
      <button
        className={`sol-trigger ${isOpen ? 'sol-trigger--active' : ''}`}
        onClick={toggle}
        type="button"
        aria-label="Открыть таблицу растворимости"
      >
        <span className="sol-trigger__icon" aria-hidden="true">
          <span /><span /><span />
          <span /><span /><span />
          <span /><span /><span />
        </span>
        Растворимости
      </button>

      {isOpen && (
        <div className="sol-hint-panel" ref={panelRef} style={panelStyle}>
          <div className="sol-hint-panel__header" onMouseDown={onDragStart}>
            <h2 className="sol-hint-panel__title">Таблица растворимости</h2>
            <button className="sol-hint-panel__close" onClick={close} type="button" aria-label="Закрыть">&times;</button>
          </div>
          <div className="sol-hint-panel__content">
            <SolubilityTable />
          </div>
        </div>
      )}
    </>
  );
}
