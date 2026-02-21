import { useEffect, useCallback, useRef } from 'react';
import SolubilityTable from './SolubilityTable';
import { usePanelState } from '../../lib/use-panel-state';
import * as m from '../../paraglide/messages.js';
import './solubility-hint.css';

export default function SolubilityHint() {
  const { isOpen, pos, setPos, hasMoved, setHasMoved, toggle, close } = usePanelState('solubility');
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

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
        aria-label={m.sol_open_table()}
      >
        <span className="sol-trigger__icon" aria-hidden="true">
          <span /><span /><span />
          <span /><span /><span />
          <span /><span /><span />
        </span>
        <span className="hint-label-full">Растворимости</span>
        <span className="hint-label-short">ТР</span>
      </button>

      {isOpen && (
        <div className="sol-hint-panel" ref={panelRef} style={panelStyle}>
          <div className="sol-hint-panel__header" onMouseDown={onDragStart}>
            <h2 className="sol-hint-panel__title">Таблица растворимости</h2>
            <button className="sol-hint-panel__close" onClick={close} type="button" aria-label={m.close_label()}>&times;</button>
          </div>
          <div className="sol-hint-panel__content">
            <SolubilityTable />
          </div>
        </div>
      )}
    </>
  );
}
