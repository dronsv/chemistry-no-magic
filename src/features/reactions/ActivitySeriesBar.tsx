import { useState, useEffect } from 'react';
import type { ActivitySeriesEntry } from '../../types/rules';
import { loadActivitySeries } from '../../lib/data-loader';

export default function ActivitySeriesBar() {
  const [metals, setMetals] = useState<ActivitySeriesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    loadActivitySeries().then(data => {
      setMetals(data.sort((a, b) => a.position - b.position));
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  const hPosition = metals.findIndex(m => m.symbol === 'H');

  return (
    <div className="activity-series">
      <div className="activity-series__bar">
        {metals.map((metal, i) => (
          <div
            key={metal.symbol}
            className={`activity-series__item ${
              metal.symbol === 'H' ? 'activity-series__item--hydrogen' :
              metal.reduces_H ? 'activity-series__item--active' :
              'activity-series__item--noble'
            }`}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => setHoveredIdx(hoveredIdx === i ? null : i)}
          >
            <span className="activity-series__symbol">{metal.symbol}</span>
            {hoveredIdx === i && (
              <span className="activity-series__tooltip">{metal.name_ru}</span>
            )}
          </div>
        ))}
      </div>
      <div className="activity-series__labels">
        <span className="activity-series__label activity-series__label--active">
          Вытесняют H₂ из кислот
        </span>
        <span className="activity-series__label activity-series__label--noble">
          Не вытесняют H₂
        </span>
      </div>
    </div>
  );
}
