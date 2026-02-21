import * as m from '../../paraglide/messages.js';

interface TrendsOverlayProps {
  /** Grid dimensions for positioning arrows relative to the table */
  gridWidth: number;
  gridHeight: number;
}

interface Trend {
  id: string;
  label: () => string;
  color: string;
  /** Direction: 'right' = left→right, 'up' = bottom→top, 'diagonal' = bottom-left→top-right */
  direction: 'right' | 'up' | 'diagonal';
}

const TRENDS: Trend[] = [
  { id: 'en', label: m.pt_trend_en, color: '#e03131', direction: 'diagonal' },
  { id: 'metal', label: m.pt_trend_metal, color: '#2f9e44', direction: 'diagonal' },
  { id: 'radius', label: m.pt_trend_radius, color: '#1971c2', direction: 'diagonal' },
  { id: 'ionization', label: m.pt_trend_ionization, color: '#e8590c', direction: 'diagonal' },
];

export default function TrendsOverlay({}: TrendsOverlayProps) {
  return (
    <div className="pt-trends">
      <div className="pt-trends__arrows">
        {/* Horizontal arrow: Electronegativity increases → */}
        <svg className="pt-trends__svg" viewBox="0 0 400 220" aria-hidden="true">
          {/* Top arrow: EN increases left→right */}
          <defs>
            <marker id="arr-red" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto" fill="#e03131">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <marker id="arr-green" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto" fill="#2f9e44">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <marker id="arr-blue" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto" fill="#1971c2">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <marker id="arr-orange" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto" fill="#e8590c">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>

          {/* Electronegativity: ↗ (bottom-left to top-right) */}
          <line x1="30" y1="190" x2="370" y2="190" stroke="#e03131" strokeWidth="2" markerEnd="url(#arr-red)" />
          <text x="200" y="210" textAnchor="middle" fill="#e03131" fontSize="11" fontWeight="600">
            {m.trend_electronegativity_right()}
          </text>

          <line x1="30" y1="190" x2="30" y2="20" stroke="#e03131" strokeWidth="2" markerEnd="url(#arr-red)" />
          <text x="18" y="105" textAnchor="middle" fill="#e03131" fontSize="11" fontWeight="600"
            transform="rotate(-90, 18, 105)">
            {m.trend_electronegativity_right()}
          </text>

          {/* Metallic character: ↙ (opposite) */}
          <line x1="370" y1="10" x2="90" y2="10" stroke="#2f9e44" strokeWidth="2" markerEnd="url(#arr-green)" />
          <text x="230" y="8" textAnchor="middle" fill="#2f9e44" fontSize="11" fontWeight="600">
            {m.trend_metallicity_left()}
          </text>

          <line x1="370" y1="10" x2="370" y2="180" stroke="#2f9e44" strokeWidth="2" markerEnd="url(#arr-green)" />
          <text x="382" y="105" textAnchor="middle" fill="#2f9e44" fontSize="11" fontWeight="600"
            transform="rotate(90, 382, 105)">
            {m.trend_metallicity_right()}
          </text>

          {/* Atomic radius: increases ← and ↓ */}
          <line x1="200" y1="80" x2="200" y2="170" stroke="#1971c2" strokeWidth="1.5" strokeDasharray="6 3" markerEnd="url(#arr-blue)" />
          <line x1="200" y1="80" x2="100" y2="80" stroke="#1971c2" strokeWidth="1.5" strokeDasharray="6 3" markerEnd="url(#arr-blue)" />
          <text x="200" y="75" textAnchor="middle" fill="#1971c2" fontSize="10">
            {m.trend_atomic_radius()}
          </text>

          {/* Ionization energy: ↗ */}
          <line x1="100" y1="140" x2="310" y2="40" stroke="#e8590c" strokeWidth="1.5" strokeDasharray="6 3" markerEnd="url(#arr-orange)" />
          <text x="220" y="100" textAnchor="start" fill="#e8590c" fontSize="10"
            transform="rotate(-20, 220, 100)">
            {m.trend_ionization_energy()}
          </text>
        </svg>
      </div>
      <div className="pt-trends__legend">
        {TRENDS.map((t) => (
          <span key={t.id} className="pt-trends__item" style={{ color: t.color }}>
            <span className="pt-trends__dot" style={{ backgroundColor: t.color }} />
            {t.label()}
          </span>
        ))}
      </div>
    </div>
  );
}
