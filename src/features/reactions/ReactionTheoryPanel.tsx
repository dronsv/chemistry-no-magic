import { useState, useEffect } from 'react';
import type { ReactionTemplate } from '../../types/templates';
import type { ApplicabilityRule } from '../../types/rules';
import type { QualitativeTest } from '../../types/qualitative';
import type { GeneticChain } from '../../types/genetic-chain';
import type { EnergyCatalystTheory } from '../../types/energy-catalyst';
import type { FacetState } from '../../types/reaction';
import type { SupportedLocale } from '../../types/i18n';
import '../../components/theory-module.css';
import {
  loadReactionTemplates,
  loadApplicabilityRules,
  loadQualitativeTests,
  loadGeneticChains,
  loadEnergyCatalystTheory,
  loadRuleTexts,
} from '../../lib/data-loader';
import { buildRuleSummaryProjection, type RuleSummaryProjection } from '../../lib/rule-text-projection';
import SolubilityTable from './SolubilityTable';
import ActivitySeriesBar from './ActivitySeriesBar';
import CollapsibleSection, { useTheoryPanelState } from '../../components/CollapsibleSection';
import * as m from '../../paraglide/messages.js';

const TYPE_LABELS: Record<string, () => string> = {
  exchange: m.rxn_type_exchange,
  substitution: m.rxn_type_substitution,
  combination: m.rxn_type_combination,
  decomposition: m.rxn_type_decomposition,
};

const RULE_TYPE_LABELS: Record<string, () => string> = {
  exchange_reaction_condition: m.rxn_rule_exchange,
  activity_series_condition: m.rxn_rule_activity,
  gas_forming_condition: m.rxn_rule_gas,
  oxide_reaction_condition: m.rxn_rule_oxide,
  thermal_condition: m.rxn_rule_thermal,
  special_acid_condition: m.rxn_rule_special_acid,
  passivation_condition: m.rxn_rule_passivation,
  amphoteric_condition: m.rxn_rule_amphoteric,
};

/** Derive which theory section to force-open from facet state */
function getTargetSection(facets?: FacetState): string | null {
  if (!facets) return null;
  if (facets.redox === 'redox') return 'redox';
  if (facets.mechanism === 'exchange') return 'types';
  if (facets.mechanism === 'substitution') return 'activity';
  if (facets.mechanism === 'decomposition') return 'types';
  if (facets.drivingForces.has('precipitation')) return 'solubility';
  if (facets.drivingForces.has('gas_evolution')) return 'forces';
  if (facets.drivingForces.has('water_formation')) return 'forces';
  if (facets.educationalGoals.has('qualitative_analysis_logic')) return 'qualitative';
  if (facets.educationalGoals.has('reaction_energy_profile')) return 'speed';
  return null;
}

export default function ReactionTheoryPanel({ facets, locale = 'ru' as SupportedLocale }: { facets?: FacetState; locale?: SupportedLocale }) {
  const [templates, setTemplates] = useState<ReactionTemplate[] | null>(null);
  const [rules, setRules] = useState<ApplicabilityRule[] | null>(null);
  const [ruleProjection, setRuleProjection] = useState<Record<string, RuleSummaryProjection> | null>(null);
  const [qualTests, setQualTests] = useState<QualitativeTest[] | null>(null);
  const [chains, setChains] = useState<GeneticChain[] | null>(null);
  const [energyTheory, setEnergyTheory] = useState<EnergyCatalystTheory | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, toggleOpen] = useTheoryPanelState('reactions');
  const [error, setError] = useState<string | null>(null);
  const targetSection = getTargetSection(facets);

  useEffect(() => {
    if (!open || templates) return;
    setLoading(true);
    Promise.all([
      loadReactionTemplates(locale),
      loadApplicabilityRules(locale),
      loadRuleTexts(),
      loadQualitativeTests(locale),
      loadGeneticChains(locale),
      loadEnergyCatalystTheory(locale),
    ])
      .then(([t, r, rt, qt, gc, et]) => {
        setTemplates(t);
        setRules(r);
        setRuleProjection(buildRuleSummaryProjection(rt, r, locale));
        setQualTests(qt);
        setChains(gc);
        setEnergyTheory(et);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : m.error_loading_short());
        setLoading(false);
      });
  }, [open, templates]);

  // Group templates by type
  const typeOrder = ['exchange', 'substitution', 'combination', 'decomposition'];
  const templateGroups = templates
    ? typeOrder
        .map(type => ({
          type,
          label: TYPE_LABELS[type]?.() ?? type,
          items: templates.filter(t => t.type === type),
        }))
        .filter(g => g.items.length > 0)
    : [];

  // Group rules by type
  const ruleGroups = rules
    ? Object.entries(
        rules.reduce<Record<string, ApplicabilityRule[]>>((acc, rule) => {
          (acc[rule.type] ??= []).push(rule);
          return acc;
        }, {}),
      ).map(([type, items]) => ({
        type,
        label: RULE_TYPE_LABELS[type]?.() ?? type,
        items,
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
        <span>{m.theory_rxn_trigger()}</span>
        <span className="theory-panel__trigger-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">{m.loading()}</div>}
          {error && <div className="theory-panel__error">{error}</div>}

          {templates && rules && ruleProjection && (
            <>
              <CollapsibleSection id="types" pageKey="reactions" title={m.rxn_theory_types()} forceOpen={targetSection === 'types'}>
                {templateGroups.map(group => (
                  <div key={group.type} className="rxn-theory__type-group">
                    <h4 className="rxn-theory__type-title">{group.label}</h4>
                    {group.items.map(t => (
                      <div key={t.id} className="rxn-theory__template">
                        <div className="rxn-theory__desc">{t.description}</div>
                        <div className="rxn-theory__pattern">{t.pattern}</div>
                        {t.conditions && (
                          <div className="rxn-theory__conditions">{m.rxn_theory_conditions_label({ conditions: t.conditions })}</div>
                        )}
                        <div className="rxn-theory__examples">
                          {t.examples.slice(0, 2).map((ex, i) => (
                            <div key={i} className="rxn-theory__equation">
                              {ex.reactants.join(' + ')} → {ex.products.join(' + ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CollapsibleSection>

              <CollapsibleSection id="forces" pageKey="reactions" title={m.rxn_theory_forces()} forceOpen={targetSection === 'forces'}>
                {ruleGroups.map(group => (
                  <div key={group.type} className="rxn-theory__rule-group">
                    <h4 className="rxn-theory__type-title">{group.label}</h4>
                    {group.items.map(rule => {
                      const proj = ruleProjection[rule.id];
                      return (
                        <div key={rule.id} className="rxn-theory__rule">
                          <div className="rxn-theory__rule-condition">{proj?.summary ?? rule.id}</div>
                          {proj?.detail && <div className="rxn-theory__rule-desc">{proj.detail}</div>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </CollapsibleSection>

              <CollapsibleSection id="solubility" pageKey="reactions" title={m.rxn_theory_solubility()} forceOpen={targetSection === 'solubility'}>
                <SolubilityTable />
              </CollapsibleSection>

              <CollapsibleSection id="activity" pageKey="reactions" title={m.rxn_theory_activity()} forceOpen={targetSection === 'activity'}>
                <ActivitySeriesBar locale={locale} />
              </CollapsibleSection>

              <CollapsibleSection id="redox" pageKey="reactions" title={m.rxn_theory_redox()} forceOpen={targetSection === 'redox'}>
                <div className="rxn-theory__redox">
                  <p>{m.rxn_theory_redox_desc()}</p>
                  <div className="rxn-theory__definitions">
                    <div className="rxn-theory__def-item">
                      <strong>{m.rxn_theory_oxidizer()}</strong> — {m.rxn_theory_oxidizer_desc()}
                    </div>
                    <div className="rxn-theory__def-item">
                      <strong>{m.rxn_theory_reducer()}</strong> — {m.rxn_theory_reducer_desc()}
                    </div>
                  </div>
                  <p className="rxn-theory__mnemonic"><em>{m.rxn_theory_mnemonic()}</em></p>
                  <h4 className="rxn-theory__type-title">{m.rxn_theory_electron_balance()}</h4>
                  <ol className="rxn-theory__steps">
                    <li>{m.rxn_theory_eb_step1()}</li>
                    <li>{m.rxn_theory_eb_step2()}</li>
                    <li>{m.rxn_theory_eb_step3()}</li>
                    <li>{m.rxn_theory_eb_step4()}</li>
                    <li>{m.rxn_theory_eb_step5()}</li>
                  </ol>
                  <h4 className="rxn-theory__type-title">{m.rxn_theory_examples()}</h4>
                  <div className="rxn-theory__equation">Zn + 2HCl → ZnCl₂ + H₂↑</div>
                  <div className="rxn-theory__rule-desc">{m.rxn_theory_redox_ex1_half()}</div>
                  <div className="rxn-theory__equation">Fe + CuSO₄ → FeSO₄ + Cu↓</div>
                  <div className="rxn-theory__rule-desc">{m.rxn_theory_redox_ex2_half()}</div>
                </div>
              </CollapsibleSection>

              {qualTests && qualTests.length > 0 && (
                <CollapsibleSection id="qualitative" pageKey="reactions" title={m.rxn_theory_qualitative()} forceOpen={targetSection === 'qualitative'}>
                  <div className="rxn-theory__qualitative">
                    <p>{m.rxn_theory_qual_desc()}</p>
                    <table className="rxn-theory__qual-table">
                      <thead>
                        <tr>
                          <th>{m.rxn_theory_qual_ion()}</th>
                          <th>{m.rxn_theory_qual_reagent()}</th>
                          <th>{m.rxn_theory_qual_sign()}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qualTests.map(t => (
                          <tr key={t.target_id}>
                            <td>{t.target_name}</td>
                            <td>{t.reagent_name}</td>
                            <td>{t.observation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}

              {chains && chains.length > 0 && (
                <CollapsibleSection id="chains" pageKey="reactions" title={m.rxn_theory_chains()} forceOpen={targetSection === 'chains'}>
                  <div className="rxn-theory__chains">
                    <p>{m.rxn_theory_genetic_desc()}</p>
                    <div className="rxn-theory__chain-diagrams">
                      <div className="rxn-theory__chain-diagram">
                        <strong>{m.rxn_theory_metals_label()}</strong> {m.rxn_theory_metals_chain()}
                      </div>
                      <div className="rxn-theory__chain-diagram">
                        <strong>{m.rxn_theory_nonmetals_label()}</strong> {m.rxn_theory_nonmetals_chain()}
                      </div>
                    </div>
                    <h4 className="rxn-theory__type-title">{m.rxn_theory_chain_examples()}</h4>
                    {chains.map(chain => {
                      const allSubstances = [chain.steps[0].substance, ...chain.steps.map(s => s.next)];
                      return (
                        <div key={chain.chain_id} className="rxn-theory__chain-example">
                          <strong>{chain.title}:</strong>{' '}
                          <span className="rxn-theory__chain-sequence">
                            {allSubstances.join(' → ')}
                          </span>
                          <div className="rxn-theory__chain-classes">
                            ({chain.class_sequence.join(' → ')})
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              )}

              {energyTheory && (
                <CollapsibleSection id="speed" pageKey="reactions" title={m.rxn_theory_speed()} forceOpen={targetSection === 'speed'}>
                  <div className="rxn-theory__energy">
                    <h4 className="rxn-theory__type-title">{m.rxn_theory_rate_factors()}</h4>
                    <div className="rxn-theory__definitions">
                      {energyTheory.rate_factors.map(f => (
                        <div key={f.factor_id} className="rxn-theory__def-item">
                          <strong>{f.name}</strong> — {f.effect}.
                          <div className="rxn-theory__rule-desc">{f.detail}</div>
                        </div>
                      ))}
                    </div>

                    <h4 className="rxn-theory__type-title">{m.rxn_theory_exo_endo()}</h4>
                    <div className="rxn-theory__definitions">
                      <div className="rxn-theory__def-item">
                        <strong>{m.rxn_theory_exothermic()}</strong> — {energyTheory.heat_classification.exothermic.replace('Экзотермическая реакция — ', '')}
                      </div>
                      <div className="rxn-theory__def-item">
                        <strong>{m.rxn_theory_endothermic()}</strong> — {energyTheory.heat_classification.endothermic.replace('Эндотермическая реакция — ', '')}
                      </div>
                    </div>
                    <div className="rxn-theory__rule-desc">
                      <em>{m.rxn_theory_exo_examples()}</em> {energyTheory.heat_classification.examples_exo.join(', ')}.<br />
                      <em>{m.rxn_theory_endo_examples()}</em> {energyTheory.heat_classification.examples_endo.join(', ')}.
                    </div>

                    <h4 className="rxn-theory__type-title">{m.rxn_theory_equilibrium()}</h4>
                    <p>{m.rxn_theory_equilibrium_desc()}</p>
                    <table className="rxn-theory__qual-table">
                      <thead>
                        <tr>
                          <th>{m.rxn_theory_eq_factor()}</th>
                          <th>{m.rxn_theory_eq_shift()}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {energyTheory.equilibrium_shifts.map(s => (
                          <tr key={s.factor}>
                            <td>{s.explanation}</td>
                            <td>{s.shift}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}

              {energyTheory && (
                <CollapsibleSection id="catalysis" pageKey="reactions" title={m.rxn_theory_catalysis()} forceOpen={targetSection === 'catalysis'}>
                  <div className="rxn-theory__catalyst">
                    <p>{m.rxn_theory_catalyst_desc()}</p>

                    <h4 className="rxn-theory__type-title">{m.rxn_theory_catalyst_changes()}</h4>
                    <ul className="rxn-theory__steps">
                      {energyTheory.catalyst_properties.changes.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>

                    <h4 className="rxn-theory__type-title">{m.rxn_theory_catalyst_not_changes()}</h4>
                    <ul className="rxn-theory__steps">
                      {energyTheory.catalyst_properties.does_not_change.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>

                    <h4 className="rxn-theory__type-title">{m.rxn_theory_common_catalysts()}</h4>
                    <table className="rxn-theory__qual-table">
                      <thead>
                        <tr>
                          <th>{m.rxn_theory_catalyst_col()}</th>
                          <th>{m.rxn_theory_reaction_col()}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {energyTheory.common_catalysts.map(c => (
                          <tr key={c.catalyst}>
                            <td><strong>{c.catalyst}</strong> ({c.name})</td>
                            <td>{c.reaction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
