import { useState, useEffect } from 'react';
import type { ClassificationRule, NamingRule } from '../../types/classification';
import { loadClassificationRules, loadNamingRules } from '../../lib/data-loader';
import CollapsibleSection, { useTheoryPanelState } from '../../components/CollapsibleSection';
import * as m from '../../paraglide/messages.js';

const CLASS_LABELS: Record<string, () => string> = {
  oxide: m.class_oxides,
  acid: m.class_acids,
  base: m.class_bases,
  salt: m.class_salts,
};

const SUBCLASS_LABELS: Record<string, () => string> = {
  basic: m.subclass_basic,
  acidic: m.subclass_acidic,
  amphoteric: m.subclass_amphoteric,
  indifferent: m.subclass_indifferent,
  oxygen_containing: m.subclass_oxygen_containing,
  oxygen_free: m.subclass_oxygen_free,
  soluble: m.subclass_soluble,
  insoluble: m.subclass_insoluble,
  normal: m.subclass_normal,
  acidic_salt: m.subclass_acidic_salt,
  basic_salt: m.subclass_basic_salt,
};

const CLASS_ORDER = ['oxide', 'acid', 'base', 'salt'];

const FILTER_SECTIONS_MAP: Record<string, string[]> = {
  oxide: ['class_oxide', 'naming_oxide'],
  acid: ['class_acid', 'naming_acid'],
  base: ['class_base', 'naming_base'],
  salt: ['class_salt', 'naming_salt'],
};

function ClassificationRuleCard({ rule }: { rule: ClassificationRule }) {
  return (
    <div className="subst-theory__rule">
      <div className="subst-theory__rule-header">
        {SUBCLASS_LABELS[rule.subclass]?.() ?? rule.subclass}
      </div>
      <p className="subst-theory__rule-desc">{rule.description_ru}</p>
      <div className="subst-theory__rule-examples">
        {rule.examples.join(', ')}
      </div>
    </div>
  );
}

function NamingRuleCard({ rule }: { rule: NamingRule }) {
  return (
    <div className="subst-theory__rule">
      <div className="subst-theory__rule-header">
        {rule.template_ru}
      </div>
      <div className="subst-theory__naming-examples">
        {rule.examples.map((ex, i) => (
          <span key={i} className="subst-theory__naming-pair">
            {ex.formula} — {ex.name_ru}
            {i < rule.examples.length - 1 ? '; ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ClassificationTheoryPanel({ activeFilter = 'all' }: { activeFilter?: string }) {
  const [classRules, setClassRules] = useState<ClassificationRule[] | null>(null);
  const [namingRules, setNamingRules] = useState<NamingRule[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, toggleOpen] = useTheoryPanelState('substances');
  const [error, setError] = useState<string | null>(null);
  const forcedSections = activeFilter !== 'all' ? FILTER_SECTIONS_MAP[activeFilter] ?? [] : [];

  useEffect(() => {
    if (!open || classRules) return;
    setLoading(true);
    Promise.all([loadClassificationRules(), loadNamingRules()])
      .then(([cRules, nRules]) => {
        setClassRules(cRules);
        setNamingRules(nRules);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : m.error_loading_short());
        setLoading(false);
      });
  }, [open, classRules]);

  // Group rules by class
  const classGroups = classRules
    ? CLASS_ORDER.map(cls => ({
        cls,
        label: CLASS_LABELS[cls]?.() ?? cls,
        rules: classRules.filter(r => r.class === cls),
      }))
    : [];

  const namingGroups = namingRules
    ? CLASS_ORDER.map(cls => ({
        cls,
        label: CLASS_LABELS[cls]?.() ?? cls,
        rules: namingRules.filter(r => r.class === cls),
      }))
    : [];

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={toggleOpen}
      >
        <span>📖</span>
        <span>{m.theory_classification_title()}</span>
        <span className="theory-panel__trigger-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">{m.loading()}</div>}
          {error && <div className="theory-panel__error">{error}</div>}

          {classRules && namingRules && (
            <>
              <h3 className="theory-panel__heading">{m.theory_classification_heading()}</h3>
              {classGroups.map(group => (
                <CollapsibleSection key={group.cls} id={`class_${group.cls}`} pageKey="substances" title={group.label} forceOpen={forcedSections.includes(`class_${group.cls}`)}>
                  {group.rules.map(rule => (
                    <ClassificationRuleCard key={rule.id} rule={rule} />
                  ))}
                </CollapsibleSection>
              ))}

              <h3 className="theory-panel__heading">{m.theory_amphoterism_heading()}</h3>
              <CollapsibleSection id="amphoteric" pageKey="substances" title={m.subst_amphoteric_title()}>
                <div className="subst-theory__rule">
                  <p className="subst-theory__rule-desc">
                    {m.class_theory_amphoteric_desc()}
                  </p>
                  <p className="subst-theory__rule-desc">
                    {m.class_theory_amphoteric_metals()}
                  </p>
                </div>
              </CollapsibleSection>
              <CollapsibleSection id="amphoteric_oxides" pageKey="substances" title={m.subst_amphoteric_oxides()}>
                <div className="subst-theory__rule">
                  <p className="subst-theory__rule-desc">
                    {m.class_theory_oxide_examples()}
                  </p>
                  <p className="subst-theory__rule-desc">
                    {m.class_theory_acid_reaction({ equation: 'Al₂O₃ + 6HCl → 2AlCl₃ + 3H₂O' })}
                  </p>
                  <p className="subst-theory__rule-desc">
                    {m.class_theory_base_reaction({ equation: 'Al₂O₃ + 2NaOH → 2NaAlO₂ + H₂O' })}
                  </p>
                </div>
              </CollapsibleSection>
              <CollapsibleSection id="amphoteric_hydroxides" pageKey="substances" title={m.subst_amphoteric_hydroxides()}>
                <div className="subst-theory__rule">
                  <p className="subst-theory__rule-desc">
                    {m.class_theory_hydroxide_examples()}
                  </p>
                  <p className="subst-theory__rule-desc">
                    {m.class_theory_acid_reaction({ equation: 'Al(OH)₃ + 3HCl → AlCl₃ + 3H₂O' })}
                  </p>
                  <p className="subst-theory__rule-desc">
                    {m.class_theory_base_reaction({ equation: 'Al(OH)₃ + NaOH → NaAlO₂ + 2H₂O' })}
                  </p>
                </div>
              </CollapsibleSection>

              <h3 className="theory-panel__heading">{m.theory_nomenclature_heading()}</h3>
              {namingGroups.map(group => (
                <CollapsibleSection key={group.cls} id={`naming_${group.cls}`} pageKey="substances" title={group.label} forceOpen={forcedSections.includes(`naming_${group.cls}`)}>
                  {group.rules.map(rule => (
                    <NamingRuleCard key={rule.id} rule={rule} />
                  ))}
                </CollapsibleSection>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
