import { useState, useEffect } from 'react';
import type { ReactionTemplate } from '../../types/templates';
import type { ApplicabilityRule } from '../../types/rules';
import type { QualitativeTest } from '../../types/qualitative';
import type { GeneticChain } from '../../types/genetic-chain';
import type { EnergyCatalystTheory } from '../../types/energy-catalyst';
import {
  loadReactionTemplates,
  loadApplicabilityRules,
  loadQualitativeTests,
  loadGeneticChains,
  loadEnergyCatalystTheory,
} from '../../lib/data-loader';
import SolubilityTable from './SolubilityTable';
import ActivitySeriesBar from './ActivitySeriesBar';
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
        <span className="theory-section__arrow">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="theory-section__body">{children}</div>}
    </div>
  );
}

export default function ReactionTheoryPanel() {
  const [templates, setTemplates] = useState<ReactionTemplate[] | null>(null);
  const [rules, setRules] = useState<ApplicabilityRule[] | null>(null);
  const [qualTests, setQualTests] = useState<QualitativeTest[] | null>(null);
  const [chains, setChains] = useState<GeneticChain[] | null>(null);
  const [energyTheory, setEnergyTheory] = useState<EnergyCatalystTheory | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || templates) return;
    setLoading(true);
    Promise.all([
      loadReactionTemplates(),
      loadApplicabilityRules(),
      loadQualitativeTests(),
      loadGeneticChains(),
      loadEnergyCatalystTheory(),
    ])
      .then(([t, r, qt, gc, et]) => {
        setTemplates(t);
        setRules(r);
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
        onClick={() => setOpen(!open)}
      >
        <span>📖</span>
        <span>{m.theory_rxn_trigger()}</span>
        <span className="theory-panel__trigger-arrow">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">{m.loading()}</div>}
          {error && <div className="theory-panel__error">{error}</div>}

          {templates && rules && (
            <>
              <CollapsibleSection title={m.rxn_theory_types()} defaultOpen>
                {templateGroups.map(group => (
                  <div key={group.type} className="rxn-theory__type-group">
                    <h4 className="rxn-theory__type-title">{group.label}</h4>
                    {group.items.map(t => (
                      <div key={t.id} className="rxn-theory__template">
                        <div className="rxn-theory__desc">{t.description_ru}</div>
                        <div className="rxn-theory__pattern">{t.pattern}</div>
                        {t.conditions && (
                          <div className="rxn-theory__conditions">Условия: {t.conditions}</div>
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

              <CollapsibleSection title={m.rxn_theory_forces()}>
                {ruleGroups.map(group => (
                  <div key={group.type} className="rxn-theory__rule-group">
                    <h4 className="rxn-theory__type-title">{group.label}</h4>
                    {group.items.map(rule => (
                      <div key={rule.id} className="rxn-theory__rule">
                        <div className="rxn-theory__rule-condition">{rule.condition_ru}</div>
                        <div className="rxn-theory__rule-desc">{rule.description_ru}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </CollapsibleSection>

              <CollapsibleSection title={m.rxn_theory_solubility()}>
                <SolubilityTable />
              </CollapsibleSection>

              <CollapsibleSection title={m.rxn_theory_activity()}>
                <ActivitySeriesBar />
              </CollapsibleSection>

              <CollapsibleSection title={m.rxn_theory_redox()}>
                <div className="rxn-theory__redox">
                  <p><strong>Окислительно-восстановительные реакции (ОВР)</strong> — реакции, в которых изменяются степени окисления элементов.</p>
                  <div className="rxn-theory__definitions">
                    <div className="rxn-theory__def-item">
                      <strong>Окислитель</strong> — принимает электроны (степень окисления понижается).
                    </div>
                    <div className="rxn-theory__def-item">
                      <strong>Восстановитель</strong> — отдаёт электроны (степень окисления повышается).
                    </div>
                  </div>
                  <p className="rxn-theory__mnemonic"><em>Мнемоника: «ОВ: Отдал — Восстановитель»</em></p>
                  <h4 className="rxn-theory__type-title">Метод электронного баланса</h4>
                  <ol className="rxn-theory__steps">
                    <li>Определить степени окисления всех элементов до и после реакции.</li>
                    <li>Найти элементы, у которых степень окисления изменилась.</li>
                    <li>Составить электронные полуреакции (окисление и восстановление).</li>
                    <li>Уравнять число отданных и принятых электронов.</li>
                    <li>Расставить коэффициенты в молекулярном уравнении.</li>
                  </ol>
                  <h4 className="rxn-theory__type-title">Примеры</h4>
                  <div className="rxn-theory__equation">Zn + 2HCl → ZnCl₂ + H₂↑</div>
                  <div className="rxn-theory__rule-desc">Zn⁰ − 2e⁻ → Zn²⁺ (восстановитель); 2H⁺ + 2e⁻ → H₂⁰ (окислитель)</div>
                  <div className="rxn-theory__equation">Fe + CuSO₄ → FeSO₄ + Cu↓</div>
                  <div className="rxn-theory__rule-desc">Fe⁰ − 2e⁻ → Fe²⁺ (восстановитель); Cu²⁺ + 2e⁻ → Cu⁰ (окислитель)</div>
                </div>
              </CollapsibleSection>

              {qualTests && qualTests.length > 0 && (
                <CollapsibleSection title={m.rxn_theory_qualitative()}>
                  <div className="rxn-theory__qualitative">
                    <p>Качественные реакции позволяют определить присутствие конкретного иона или газа по характерному признаку.</p>
                    <table className="rxn-theory__qual-table">
                      <thead>
                        <tr>
                          <th>Ион / газ</th>
                          <th>Реагент</th>
                          <th>Признак</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qualTests.map(t => (
                          <tr key={t.target_id}>
                            <td>{t.target_name_ru}</td>
                            <td>{t.reagent_name_ru}</td>
                            <td>{t.observation_ru}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}

              {chains && chains.length > 0 && (
                <CollapsibleSection title={m.rxn_theory_chains()}>
                  <div className="rxn-theory__chains">
                    <p>Генетическая связь — цепочка превращений веществ разных классов, связанных между собой.</p>
                    <div className="rxn-theory__chain-diagrams">
                      <div className="rxn-theory__chain-diagram">
                        <strong>Металлы:</strong> Металл → Основный оксид → Основание → Соль
                      </div>
                      <div className="rxn-theory__chain-diagram">
                        <strong>Неметаллы:</strong> Неметалл → Кислотный оксид → Кислота → Соль
                      </div>
                    </div>
                    <h4 className="rxn-theory__type-title">Примеры цепочек</h4>
                    {chains.map(chain => {
                      const allSubstances = [chain.steps[0].substance, ...chain.steps.map(s => s.next)];
                      return (
                        <div key={chain.chain_id} className="rxn-theory__chain-example">
                          <strong>{chain.title_ru}:</strong>{' '}
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
                <CollapsibleSection title={m.rxn_theory_speed()}>
                  <div className="rxn-theory__energy">
                    <h4 className="rxn-theory__type-title">Факторы, влияющие на скорость</h4>
                    <div className="rxn-theory__definitions">
                      {energyTheory.rate_factors.map(f => (
                        <div key={f.factor_id} className="rxn-theory__def-item">
                          <strong>{f.name_ru}</strong> — {f.effect_ru}.
                          <div className="rxn-theory__rule-desc">{f.detail_ru}</div>
                        </div>
                      ))}
                    </div>

                    <h4 className="rxn-theory__type-title">Экзо- и эндотермические реакции</h4>
                    <div className="rxn-theory__definitions">
                      <div className="rxn-theory__def-item">
                        <strong>Экзотермическая</strong> — {energyTheory.heat_classification.exothermic_ru.replace('Экзотермическая реакция — ', '')}
                      </div>
                      <div className="rxn-theory__def-item">
                        <strong>Эндотермическая</strong> — {energyTheory.heat_classification.endothermic_ru.replace('Эндотермическая реакция — ', '')}
                      </div>
                    </div>
                    <div className="rxn-theory__rule-desc">
                      <em>Примеры экзо:</em> {energyTheory.heat_classification.examples_exo_ru.join(', ')}.<br />
                      <em>Примеры эндо:</em> {energyTheory.heat_classification.examples_endo_ru.join(', ')}.
                    </div>

                    <h4 className="rxn-theory__type-title">Химическое равновесие (принцип Ле Шателье)</h4>
                    <p>Если на систему в равновесии оказать внешнее воздействие, равновесие сместится в сторону, ослабляющую это воздействие.</p>
                    <table className="rxn-theory__qual-table">
                      <thead>
                        <tr>
                          <th>Воздействие</th>
                          <th>Смещение равновесия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {energyTheory.equilibrium_shifts.map(s => (
                          <tr key={s.factor}>
                            <td>{s.explanation_ru}</td>
                            <td>{s.shift_ru}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}

              {energyTheory && (
                <CollapsibleSection title={m.rxn_theory_catalysis()}>
                  <div className="rxn-theory__catalyst">
                    <p><strong>Катализатор</strong> — вещество, которое ускоряет реакцию, но само не расходуется. Снижает энергию активации, предлагая альтернативный путь реакции.</p>

                    <h4 className="rxn-theory__type-title">Что изменяет катализатор</h4>
                    <ul className="rxn-theory__steps">
                      {energyTheory.catalyst_properties.changes_ru.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>

                    <h4 className="rxn-theory__type-title">Что НЕ изменяет катализатор</h4>
                    <ul className="rxn-theory__steps">
                      {energyTheory.catalyst_properties.does_not_change_ru.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>

                    <h4 className="rxn-theory__type-title">Распространённые катализаторы</h4>
                    <table className="rxn-theory__qual-table">
                      <thead>
                        <tr>
                          <th>Катализатор</th>
                          <th>Реакция</th>
                        </tr>
                      </thead>
                      <tbody>
                        {energyTheory.common_catalysts.map(c => (
                          <tr key={c.catalyst}>
                            <td><strong>{c.catalyst}</strong> ({c.name_ru})</td>
                            <td>{c.reaction_ru}</td>
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
