import { useState, useEffect } from 'react';
import type { OxidationTheory, OxidationRule } from '../../types/oxidation';
import { loadOxidationTheory } from '../../lib/data-loader';
import * as m from '../../paraglide/messages.js';

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`theory-section ${open ? 'theory-section--open' : ''}`}>
      <button
        type="button"
        className="theory-section__toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="theory-section__title">{title}</span>
        <span className="theory-section__arrow">{open ? '\u25BE' : '\u25B8'}</span>
      </button>
      {open && <div className="theory-section__body">{children}</div>}
    </div>
  );
}

function RuleCard({ rule }: { rule: OxidationRule }) {
  return (
    <div className="ox-theory__rule">
      <p className="ox-theory__rule-text">{rule.rule_ru}</p>
      <div className="ox-theory__rule-examples">
        {m.theory_examples_label()} {rule.examples.join(', ')}
      </div>
    </div>
  );
}

export default function OxidationTheoryPanel() {
  const [theory, setTheory] = useState<OxidationTheory | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || theory) return;
    setLoading(true);
    loadOxidationTheory()
      .then(data => {
        setTheory(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : m.error_loading_short());
        setLoading(false);
      });
  }, [open, theory]);

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>{m.theory_label()}</span>
        <span className="theory-panel__trigger-arrow">{open ? '\u25BE' : '\u25B8'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">{m.loading()}</div>}
          {error && <div className="theory-panel__error">{error}</div>}

          {theory && (
            <>
              <h3 className="theory-panel__heading">{m.theory_ox_rules_heading()}</h3>
              {theory.rules.map(rule => (
                <CollapsibleSection key={rule.id} title={rule.name_ru}>
                  <RuleCard rule={rule} />
                </CollapsibleSection>
              ))}

              <h3 className="theory-panel__heading">{m.theory_redox_heading()}</h3>
              <div className="ox-theory__redox">
                <p className="ox-theory__redox-item">
                  <strong>{m.rxn_theory_oxidizer()}:</strong> {theory.redox_concepts.oxidizer_ru}
                </p>
                <p className="ox-theory__redox-item">
                  <strong>{m.rxn_theory_reducer()}:</strong> {theory.redox_concepts.reducer_ru}
                </p>
                <p className="ox-theory__redox-mnemonic">
                  {theory.redox_concepts.mnemonic_ru}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
