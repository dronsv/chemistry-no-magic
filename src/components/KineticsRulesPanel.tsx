import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../types/i18n';
import type { KineticsRule } from '../types/kinetics';
import { loadKineticsData, type KineticsData } from '../lib/data-loader';
import { renderKineticsFrame, type PropNames } from '../lib/kinetics-frame-renderer';
import { useTheoryPanelState } from './CollapsibleSection';
import * as m from '../paraglide/messages.js';
import './theory-module.css';
import './kinetics-panel.css';

/** Strip namespace prefix as display fallback, e.g. "law:vanthoff_rule" → "vanthoff rule". */
function renderRef(id: string): string {
  return id.replace(/^[a-z]+:/, '').replace(/_/g, '\u00a0');
}

function KineticsRuleCard({ rule, propNames }: { rule: KineticsRule; propNames: PropNames }) {
  const frame = renderKineticsFrame(rule, propNames);

  return (
    <div className="theory-module__rule-card kinetics-card">
      <div className="theory-module__rule-title">{rule.name ?? rule.id}</div>

      {/* Frame: generated compact statement from rule structure */}
      {frame && (
        <div className="kinetics-frame" aria-label={frame.compact}>
          <span className="kinetics-frame__prop">{frame.source}</span>
          <span className="kinetics-frame__symbol">{frame.sourceSymbol}</span>
          {frame.delta && <span className="kinetics-frame__delta">{frame.delta}</span>}
          <span className="kinetics-frame__arrow">→</span>
          <span className="kinetics-frame__prop">{frame.target}</span>
          <span className="kinetics-frame__symbol">{frame.targetSymbol}</span>
        </div>
      )}

      {/* Prose from overlay (short_statement as override / extra context) */}
      {rule.short_statement && (
        <p className="theory-module__rule-text">{rule.short_statement}</p>
      )}
      {rule.explanation && (
        <p className="theory-module__rule-desc">{rule.explanation}</p>
      )}

      {rule.law_ref && (
        <div className="kinetics-card__refs">
          <span className="kinetics-ref kinetics-ref--law">{renderRef(rule.law_ref)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Theory panel rendering kinetics rule entities (Stage 4 pilot renderer).
 *
 * Stage 4 upgrade over Stage 2:
 * - Frame renderer generates compact structural statements from rule data
 *   (e.g. "концентрация реагентов ↑ → скорость реакции ↑")
 * - short_statement from overlay serves as additional prose context
 * - Prop names come from overlay _prop_names section (locale-resolved)
 *
 * Empirical law definitions (kind=empirical_rule) shown as header badges.
 */
export default function KineticsRulesPanel({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [data, setData] = useState<KineticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, toggleOpen] = useTheoryPanelState('kinetics-rules');

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    loadKineticsData(locale)
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load kinetics rules');
        setLoading(false);
      });
  }, [open, data]);

  const laws = data?.rules.filter(r => r.kind === 'empirical_rule') ?? [];
  const influenceRules = data?.rules.filter(r => r.kind !== 'empirical_rule') ?? [];
  const propNames = data?.propNames ?? {};

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={toggleOpen}
      >
        <span>⚗</span>
        <span>{m.theory_kinetics_trigger()}</span>
        <span className="theory-panel__trigger-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">…</div>}
          {error && <div className="theory-panel__error">{error}</div>}
          {laws.length > 0 && (
            <div className="kinetics-laws">
              {laws.map(law => (
                <span key={law.id} className="kinetics-ref kinetics-ref--law">
                  {law.name ?? renderRef(law.id)}
                </span>
              ))}
            </div>
          )}
          {influenceRules.map(rule => (
            <KineticsRuleCard key={rule.id} rule={rule} propNames={propNames} />
          ))}
        </div>
      )}
    </div>
  );
}
