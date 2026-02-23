import { useState, useEffect, useMemo } from 'react';
import type { CompetencyNode, CompetencyBlock } from '../../types/competency';
import type { SupportedLocale } from '../../types/i18n';
import { loadCompetencies } from '../../lib/data-loader';
import { loadBktState } from '../../lib/storage';
import { getLevel, type CompetencyLevel } from '../../lib/bkt-engine';
import { localizeUrl } from '../../lib/i18n';
import * as m from '../../paraglide/messages.js';
import './competency-graph.css';

const BLOCK_LABELS: Record<CompetencyBlock, string> = {
  A: 'Строение атома',
  B: 'Химическая связь',
  C: 'Классификация',
  D: 'Реакции',
  E: 'Расчёты',
  F: 'Анализ',
  G: 'Энергетика',
};

/** BFS topological layering from root nodes. */
function computeLayers(nodes: CompetencyNode[]): CompetencyNode[][] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const inDeg = new Map(nodes.map(n => [n.id, 0]));
  for (const n of nodes) {
    for (const p of n.prerequisites) {
      inDeg.set(n.id, (inDeg.get(n.id) ?? 0) + 1);
    }
  }

  const layers: CompetencyNode[][] = [];
  let current = nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0);
  const placed = new Set<string>();

  while (current.length > 0) {
    layers.push(current);
    for (const n of current) placed.add(n.id);
    const next: CompetencyNode[] = [];
    for (const n of nodes) {
      if (placed.has(n.id)) continue;
      if (n.prerequisites.every(p => placed.has(p))) {
        next.push(n);
      }
    }
    current = next;
  }

  return layers;
}

// SVG layout constants
const NODE_W = 155;
const NODE_H = 52;
const H_GAP = 20;
const V_GAP = 60;
const PAD = 20;

interface NodePos { x: number; y: number; id: string; }

export default function CompetencyGraphIsland({
  locale = 'ru' as SupportedLocale,
}: {
  locale?: SupportedLocale;
}) {
  const [competencies, setCompetencies] = useState<CompetencyNode[]>([]);
  const [bktState, setBktState] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompetencies(locale).then(data => {
      setCompetencies(data);
      setBktState(loadBktState());
      setLoading(false);
    });
  }, [locale]);

  const layers = useMemo(() => computeLayers(competencies), [competencies]);

  // Compute SVG positions
  const positions = useMemo(() => {
    const pos = new Map<string, NodePos>();
    let y = PAD;
    for (const layer of layers) {
      const totalW = layer.length * NODE_W + (layer.length - 1) * H_GAP;
      let x = PAD;
      // We'll compute final centering after we know max width
      for (const node of layer) {
        pos.set(node.id, { x, y, id: node.id });
        x += NODE_W + H_GAP;
      }
      y += NODE_H + V_GAP;
    }
    return pos;
  }, [layers]);

  // SVG dimensions
  const svgWidth = useMemo(() => {
    const maxLayerWidth = Math.max(
      ...layers.map(l => l.length * NODE_W + (l.length - 1) * H_GAP),
      0,
    );
    return maxLayerWidth + PAD * 2;
  }, [layers]);

  const svgHeight = useMemo(() => {
    return layers.length * NODE_H + (layers.length - 1) * V_GAP + PAD * 2;
  }, [layers]);

  // Center each layer
  const centeredPositions = useMemo(() => {
    const centered = new Map<string, NodePos>();
    let y = PAD;
    for (const layer of layers) {
      const totalW = layer.length * NODE_W + (layer.length - 1) * H_GAP;
      const offsetX = (svgWidth - totalW) / 2;
      let x = offsetX;
      for (const node of layer) {
        centered.set(node.id, { x, y, id: node.id });
        x += NODE_W + H_GAP;
      }
      y += NODE_H + V_GAP;
    }
    return centered;
  }, [layers, svgWidth]);

  // Group by block for mobile view
  const blockGroups = useMemo(() => {
    const groups = new Map<CompetencyBlock, CompetencyNode[]>();
    for (const c of competencies) {
      const list = groups.get(c.block) || [];
      list.push(c);
      groups.set(c.block, list);
    }
    return Array.from(groups.entries());
  }, [competencies]);

  if (loading) {
    return <div className="comp-graph"><p>{m.loading()}</p></div>;
  }

  function getNodeLevel(id: string): CompetencyLevel {
    return getLevel(bktState.get(id) ?? 0);
  }

  function getNodePercent(id: string): number {
    return Math.round((bktState.get(id) ?? 0) * 100);
  }

  function navigateTo(id: string) {
    window.location.href = localizeUrl(`/competency/${id}/`, locale);
  }

  // Build arrows
  const arrows: { from: NodePos; to: NodePos }[] = [];
  for (const node of competencies) {
    const toPos = centeredPositions.get(node.id);
    if (!toPos) continue;
    for (const prereq of node.prerequisites) {
      const fromPos = centeredPositions.get(prereq);
      if (!fromPos) continue;
      arrows.push({ from: fromPos, to: toPos });
    }
  }

  return (
    <div className="comp-graph">
      <h1 className="comp-graph__title">{m.comp_graph_title()}</h1>
      <p className="comp-graph__subtitle">{m.comp_graph_desc()}</p>

      {/* Legend */}
      <div className="comp-graph__legend">
        {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as CompetencyBlock[]).map(block => {
          const hasBlock = competencies.some(c => c.block === block);
          if (!hasBlock) return null;
          const label = competencies.find(c => c.block === block)?.block_name_ru ?? BLOCK_LABELS[block];
          return (
            <span key={block} className="comp-graph__legend-item">
              <span className={`comp-graph__legend-dot comp-graph__block--${block}`} />
              {label}
            </span>
          );
        })}
      </div>

      {/* Desktop SVG DAG */}
      <div className="comp-graph__svg-wrap">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={m.comp_graph_title()}
        >
          {/* Arrows */}
          {arrows.map((a, i) => {
            const x1 = a.from.x + NODE_W / 2;
            const y1 = a.from.y + NODE_H;
            const x2 = a.to.x + NODE_W / 2;
            const y2 = a.to.y;
            const midY = (y1 + y2) / 2;
            return (
              <path
                key={i}
                d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="1.5"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                fill="var(--color-text-muted)"
              />
            </marker>
          </defs>
          {/* Nodes */}
          {competencies.map(c => {
            const pos = centeredPositions.get(c.id);
            if (!pos) return null;
            const level = getNodeLevel(c.id);
            const pct = getNodePercent(c.id);
            return (
              <foreignObject
                key={c.id}
                x={pos.x}
                y={pos.y}
                width={NODE_W}
                height={NODE_H}
              >
                <div
                  className={`comp-graph__node comp-graph__node--${c.block}`}
                  onClick={() => navigateTo(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigateTo(c.id)}
                >
                  <div className="comp-graph__node-header">
                    <span className={`comp-graph__block-badge comp-graph__block--${c.block}`}>
                      {c.block}
                    </span>
                    <span className="comp-graph__node-name">{c.name_ru}</span>
                  </div>
                  <div className="comp-graph__node-bar">
                    <div
                      className={`comp-graph__node-fill comp-graph__node-fill--${level}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>

      {/* Mobile list */}
      <div className="comp-graph__list">
        {blockGroups.map(([block, nodes]) => (
          <div key={block} className="comp-graph__group">
            <h2 className="comp-graph__group-title">
              <span className={`comp-graph__block-badge comp-graph__block--${block}`}>
                {block}
              </span>
              {nodes[0]?.block_name_ru ?? BLOCK_LABELS[block]}
            </h2>
            <div className="comp-graph__group-items">
              {nodes.map(c => {
                const level = getNodeLevel(c.id);
                const pct = getNodePercent(c.id);
                const nameMap = new Map(competencies.map(n => [n.id, n.name_ru]));
                return (
                  <a
                    key={c.id}
                    href={localizeUrl(`/competency/${c.id}/`, locale)}
                    className={`comp-graph__node comp-graph__node--${c.block}`}
                  >
                    <div className="comp-graph__node-header">
                      <span className={`comp-graph__block-badge comp-graph__block--${c.block}`}>
                        {c.block}
                      </span>
                      <span className="comp-graph__node-name">{c.name_ru}</span>
                    </div>
                    <div className="comp-graph__node-bar">
                      <div
                        className={`comp-graph__node-fill comp-graph__node-fill--${level}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {c.prerequisites.length > 0 && (
                      <div className="comp-graph__prereqs">
                        <span className="comp-graph__prereq-tag">
                          {m.comp_graph_prereqs()}: {c.prerequisites.map(p => nameMap.get(p) ?? p).join(', ')}
                        </span>
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
