import { useState, useEffect } from 'react';
import type { ClassificationRule, NamingRule, SubstanceIndexEntry } from '../../types/classification';
import type { SupportedLocale } from '../../types/i18n';
import { loadClassificationRules, loadNamingRules, loadSubstancesIndex } from '../../lib/data-loader';
import CollapsibleSection, { useTheoryPanelState } from '../../components/CollapsibleSection';
import FormulaChip from '../../components/FormulaChip';
import * as m from '../../paraglide/messages.js';
import '../../components/theory-module.css';

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

function ClassificationRuleCard({ rule, substanceMap, locale }: {
  rule: ClassificationRule;
  substanceMap: Map<string, SubstanceIndexEntry>;
  locale?: SupportedLocale;
}) {
  return (
    <div className="subst-theory__rule">
      <div className="subst-theory__rule-header">
        {SUBCLASS_LABELS[rule.subclass]?.() ?? rule.subclass}
      </div>
      <p className="subst-theory__rule-desc">{rule.description}</p>
      <div className="subst-theory__rule-examples subst-theory__formula-chips">
        {rule.examples.map((formula, i) => {
          const sub = substanceMap.get(formula);
          return (
            <FormulaChip
              key={i}
              formula={formula}
              name={sub?.name}
              substanceClass={rule.class}
              subclass={rule.subclass}
              substanceId={sub?.id}
              locale={locale}
            />
          );
        })}
      </div>
    </div>
  );
}

function humanizeNamingTemplate(tpl: string): string {
  return tpl
    .replace('{metal_genitive}', `[${m.subst_detail_placeholder_metal()}]`)
    .replace('{nonmetal_genitive}', `[${m.subst_detail_placeholder_nonmetal()}]`)
    .replace('{roman_numeral}', `[${m.subst_detail_placeholder_ox_state()}]`);
}

function NamingRuleCard({ rule, substanceMap, locale }: {
  rule: NamingRule;
  substanceMap: Map<string, SubstanceIndexEntry>;
  locale?: SupportedLocale;
}) {
  return (
    <div className="subst-theory__rule">
      <div className="subst-theory__rule-header">
        {rule.template ? humanizeNamingTemplate(rule.template) : null}
      </div>
      <div className="subst-theory__naming-examples">
        {rule.examples.map((ex, i) => {
          const sub = substanceMap.get(ex.formula);
          return (
            <span key={i} className="subst-theory__naming-pair">
              <FormulaChip
                formula={ex.formula}
                name={ex.name}
                substanceClass={rule.class}
                subclass={sub?.subclass}
                substanceId={sub?.id}
                locale={locale}
              />
              {i < rule.examples.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function ClassificationTheoryPanel({ activeFilter = 'all', locale = 'ru' as SupportedLocale }: { activeFilter?: string; locale?: SupportedLocale }) {
  const [classRules, setClassRules] = useState<ClassificationRule[] | null>(null);
  const [namingRules, setNamingRules] = useState<NamingRule[] | null>(null);
  const [substanceMap, setSubstanceMap] = useState<Map<string, SubstanceIndexEntry>>(new Map());
  const [loading, setLoading] = useState(false);
  const [open, toggleOpen] = useTheoryPanelState('substances');
  const [error, setError] = useState<string | null>(null);
  const forcedSections = activeFilter !== 'all' ? FILTER_SECTIONS_MAP[activeFilter] ?? [] : [];

  useEffect(() => {
    if (!open || classRules) return;
    setLoading(true);
    Promise.all([loadClassificationRules(locale), loadNamingRules(locale), loadSubstancesIndex(locale)])
      .then(([cRules, nRules, substances]) => {
        setClassRules(cRules);
        setNamingRules(nRules);
        const map = new Map<string, SubstanceIndexEntry>();
        for (const s of substances) map.set(s.formula, s);
        setSubstanceMap(map);
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
                    <ClassificationRuleCard key={rule.id} rule={rule} substanceMap={substanceMap} locale={locale} />
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
                    <NamingRuleCard key={rule.id} rule={rule} substanceMap={substanceMap} locale={locale} />
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
