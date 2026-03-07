import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../types/i18n';
import type { KineticsRule } from '../types/kinetics';
import { loadKineticsRules } from '../lib/data-loader';
import { useTheoryPanelState } from './CollapsibleSection';
import * as m from '../paraglide/messages.js';
import './theory-module.css';
import './kinetics-panel.css';

/** Strip the namespace prefix from a prop/law/unit ref, e.g. "prop:reaction_rate" → "reaction rate". */
function renderRef(id: string): string {
  return id.replace(/^[a-z]+:/, '').replace(/_/g, '\u00a0');
}

function KineticsRuleCard({ rule }: { rule: KineticsRule }) {
  return (
    <div className="theory-module__rule-card kinetics-card">
      <div className="theory-module__rule-title">{rule.name ?? rule.id}</div>
      {rule.short_statement && (
        <p className="theory-module__rule-text">{rule.short_statement}</p>
      )}
      {rule.explanation && (
        <p className="theory-module__rule-desc">{rule.explanation}</p>
      )}
      <div className="kinetics-card__refs">
        {rule.law_ref && (
          <span className="kinetics-ref kinetics-ref--law">{renderRef(rule.law_ref)}</span>
        )}
        {rule.source_property && (
          <span className="kinetics-ref">{renderRef(rule.source_property)}</span>
        )}
        {rule.source_property && rule.target_property && (
          <span className="kinetics-ref-arrow" aria-hidden>→</span>
        )}
        {rule.target_property && (
          <span className="kinetics-ref">{renderRef(rule.target_property)}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Theory panel rendering kinetics rule entities (Stage 2 pilot renderer).
 *
 * Displays rules from the locale overlay: name, short_statement, explanation,
 * plus structural refs to law, source property, and target property.
 * Empirical law definitions (kind=empirical_rule) are shown as a header note.
 */
export default function KineticsRulesPanel({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [rules, setRules] = useState<KineticsRule[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, toggleOpen] = useTheoryPanelState('kinetics-rules');

  useEffect(() => {
    if (!open || rules) return;
    setLoading(true);
    loadKineticsRules(locale)
      .then(data => {
        setRules(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load kinetics rules');
        setLoading(false);
      });
  }, [open, rules]);

  const laws = rules?.filter(r => r.kind === 'empirical_rule') ?? [];
  const influenceRules = rules?.filter(r => r.kind !== 'empirical_rule') ?? [];

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
                <span key={law.id} className="kinetics-ref kinetics-ref--law">{law.name ?? renderRef(law.id)}</span>
              ))}
            </div>
          )}
          {influenceRules.map(rule => (
            <KineticsRuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}
    </div>
  );
}
