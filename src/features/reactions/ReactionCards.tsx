import { useState, useEffect } from 'react';
import type { Reaction } from '../../types/reaction';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { MetalType } from '../../types/element';
import type { SupportedLocale } from '../../types/i18n';
import { loadReactions, loadSubstancesIndex, loadElements } from '../../lib/data-loader';
import { parseFormula } from '../../lib/formula-parser';
import { calcOxidationStates } from '../../lib/oxidation-state';
import FormulaChip from '../../components/FormulaChip';
import * as m from '../../paraglide/messages.js';

type ElementInfo = { group: number; metal_type: MetalType };

/** Normalize Unicode subscript digits (₀-₉) to ASCII for formula key matching. */
function normalizeFormula(f: string): string {
  return f.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => String(ch.charCodeAt(0) - 0x2080));
}

const TAG_FILTER_VALUES = [
  'all', 'neutralization', 'precipitation', 'gas_evolution', 'substitution',
  'qualitative_test', 'amphoteric', 'acidic_oxide', 'decomposition',
] as const;

const TAG_FILTER_LABELS: Record<string, () => string> = {
  all: m.rxn_filter_all,
  neutralization: m.rxn_filter_neutralization,
  precipitation: m.rxn_filter_precipitation,
  gas_evolution: m.rxn_filter_gas_evolution,
  substitution: m.rxn_filter_substitution,
  qualitative_test: m.rxn_filter_qualitative,
  amphoteric: m.rxn_filter_amphoteric,
  acidic_oxide: m.rxn_filter_acidic_oxide,
  decomposition: m.rxn_filter_decomposition,
};

const TAG_LABELS: Record<string, () => string> = {
  exchange: m.rxn_tag_exchange,
  substitution: m.rxn_tag_substitution,
  redox: m.rxn_tag_redox,
  neutralization: m.rxn_tag_neutralization,
  precipitation: m.rxn_tag_precipitation,
  gas_evolution: m.rxn_tag_gas_evolution,
  gas_absorption: m.rxn_tag_gas_absorption,
  amphoteric: m.rxn_tag_amphoteric,
  complexation: m.rxn_tag_complexation,
  acidic_oxide: m.rxn_tag_acidic_oxide,
  decomposition: m.rxn_tag_decomposition,
  qualitative_test: m.rxn_tag_qualitative_test,
};

/** Pick the most descriptive (specific) tag for the card badge */
function getBadgeTag(tags: string[]): string {
  // Prefer specific tags over generic "exchange"
  const specific = tags.find(t => t !== 'exchange');
  return specific ?? tags[0] ?? 'exchange';
}

const DRIVING_FORCE_LABELS: Record<string, { icon: string; label: () => string }> = {
  precipitation: { icon: '↓', label: m.rxn_force_precipitation },
  gas_release: { icon: '↑', label: m.rxn_force_gas_release },
  water_formation: { icon: '💧', label: m.rxn_force_water_formation },
  weak_electrolyte: { icon: '~', label: m.rxn_force_weak_electrolyte },
  complex_formation: { icon: '⟨⟩', label: m.rxn_force_complex_formation },
};

const HEAT_LABELS: Record<string, { label: () => string; className: string }> = {
  exo: { label: m.rxn_heat_exo, className: 'rxn-heat-badge--exo' },
  endo: { label: m.rxn_heat_endo, className: 'rxn-heat-badge--endo' },
  negligible: { label: m.rxn_heat_negligible, className: 'rxn-heat-badge--negligible' },
  unknown: { label: m.rxn_heat_unknown, className: 'rxn-heat-badge--unknown' },
};

type TabId = 'molecular' | 'ionic' | 'why' | 'speed';

const TABS: { id: TabId; label: () => string }[] = [
  { id: 'molecular', label: m.rxn_view_molecular },
  { id: 'ionic', label: m.rxn_view_ionic },
  { id: 'why', label: m.rxn_view_why },
  { id: 'speed', label: m.rxn_view_speed },
];

function MolecularTab({ reaction, substanceMap, elementMap }: {
  reaction: Reaction;
  substanceMap: Map<string, SubstanceIndexEntry>;
  elementMap: Map<string, ElementInfo>;
}) {
  const renderItem = (item: { formula: string; name?: string; coeff: number }, i: number) => {
    const sub = substanceMap.get(item.formula);
    const parsed = parseFormula(item.formula);
    const ox = calcOxidationStates(parsed, elementMap, item.formula);

    return (
      <span key={i} className="rxn-molecular-item">
        {item.coeff > 1 ? `${item.coeff} ` : ''}
        <FormulaChip
          formula={item.formula}
          name={sub?.name_ru ?? item.name}
          substanceClass={sub?.class}
          substanceId={sub?.id}
          oxidationStates={!ox.error ? ox.assignments : undefined}
        />
      </span>
    );
  };

  return (
    <div className="rxn-tab-content">
      <div className="rxn-equation">{reaction.equation}</div>
      <div className="rxn-molecular-lists">
        <div className="rxn-molecular-group">
          <span className="rxn-molecular-label">{m.rxn_reactants()}</span>
          {reaction.molecular.reactants.map(renderItem)}
        </div>
        <div className="rxn-molecular-group">
          <span className="rxn-molecular-label">{m.rxn_products()}</span>
          {reaction.molecular.products.map(renderItem)}
        </div>
      </div>
      <div className="rxn-meta">
        <span className="rxn-phase-badge">{m.rxn_medium({ medium: reaction.phase.medium + (reaction.phase.notes ? ` (${reaction.phase.notes})` : '') })}</span>
        {reaction.conditions && (
          <span className="rxn-conditions">
            {reaction.conditions.temperature && reaction.conditions.temperature !== 'room' && m.rxn_temperature({ temp: reaction.conditions.temperature })}
            {reaction.conditions.catalyst && ` | ${m.rxn_catalyst({ name: reaction.conditions.catalyst })}`}
            {reaction.conditions.pressure && ` | ${m.rxn_pressure({ value: reaction.conditions.pressure })}`}
            {reaction.conditions.excess && ` | ${reaction.conditions.excess}`}
          </span>
        )}
      </div>
    </div>
  );
}

function IonicTab({ reaction }: { reaction: Reaction }) {
  const { ionic } = reaction;
  if (!ionic.full && !ionic.net) {
    return <div className="rxn-tab-content"><p className="rxn-no-data">{m.rxn_ionic_na()}</p></div>;
  }
  return (
    <div className="rxn-tab-content">
      {ionic.full && (
        <div className="rxn-ionic-block">
          <span className="rxn-ionic-label">{m.rxn_ionic_full()}</span>
          <div className="rxn-ionic-full">{ionic.full}</div>
        </div>
      )}
      {ionic.net && (
        <div className="rxn-ionic-block">
          <span className="rxn-ionic-label">{m.rxn_ionic_net()}</span>
          <div className="rxn-ionic-net">{ionic.net}</div>
        </div>
      )}
      {ionic.notes && <p className="rxn-ionic-notes">{ionic.notes}</p>}
    </div>
  );
}

function WhyTab({ reaction }: { reaction: Reaction }) {
  const heat = HEAT_LABELS[reaction.heat_effect];
  const obs = reaction.observations;
  return (
    <div className="rxn-tab-content">
      <div className="rxn-driving-forces">
        <span className="rxn-section-label">{m.rxn_driving_label()}</span>
        <div className="rxn-badge-row">
          {reaction.driving_forces.map(f => {
            const info = DRIVING_FORCE_LABELS[f];
            return (
              <span key={f} className="rxn-driving-badge">
                <span className="rxn-driving-badge__icon">{info?.icon ?? '?'}</span>
                {info?.label() ?? f}
              </span>
            );
          })}
        </div>
      </div>
      <div className="rxn-observations">
        <span className="rxn-section-label">{m.rxn_observations_label()}</span>
        <ul className="rxn-observation-list">
          {obs.precipitate?.map((p, i) => <li key={`p${i}`} className="rxn-observation">{m.rxn_obs_precipitate({ text: p })}</li>)}
          {obs.gas?.map((g, i) => <li key={`g${i}`} className="rxn-observation">{m.rxn_obs_gas({ text: g })}</li>)}
          {obs.color_change && <li className="rxn-observation">{m.rxn_obs_color({ text: obs.color_change })}</li>}
          {obs.smell && <li className="rxn-observation">{m.rxn_obs_smell({ text: obs.smell })}</li>}
          {obs.heat && <li className="rxn-observation">{m.rxn_obs_heat({ text: obs.heat })}</li>}
          {obs.other?.map((o, i) => <li key={`o${i}`} className="rxn-observation">{o}</li>)}
        </ul>
      </div>
      {heat && (
        <span className={`rxn-heat-badge ${heat.className}`}>{heat.label()}</span>
      )}
    </div>
  );
}

function SpeedTab({ reaction }: { reaction: Reaction }) {
  const { rate_tips, safety_notes } = reaction;
  return (
    <div className="rxn-tab-content">
      <div className="rxn-rate-section">
        <span className="rxn-section-label">{m.rxn_speed_up()}</span>
        <ul className="rxn-rate-list">
          {rate_tips.how_to_speed_up.map((tip, i) => <li key={i}>{tip}</li>)}
        </ul>
      </div>
      {rate_tips.what_slows_down && rate_tips.what_slows_down.length > 0 && (
        <div className="rxn-rate-section">
          <span className="rxn-section-label">{m.rxn_slow_down()}</span>
          <ul className="rxn-rate-list">
            {rate_tips.what_slows_down.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </div>
      )}
      {safety_notes.length > 0 && (
        <div className="rxn-safety">
          <span className="rxn-safety__label">{m.rxn_safety()}</span>
          <ul className="rxn-safety__list">
            {safety_notes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReactionCard({ reaction, substanceMap, elementMap }: {
  reaction: Reaction;
  substanceMap: Map<string, SubstanceIndexEntry>;
  elementMap: Map<string, ElementInfo>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('molecular');

  const badgeTag = getBadgeTag(reaction.type_tags);

  return (
    <div className={`rxn-card ${expanded ? 'rxn-card--open' : ''}`}>
      <button
        type="button"
        className="rxn-card__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`rxn-card__type-badge rxn-card__type-badge--${badgeTag}`}>
          {TAG_LABELS[badgeTag]?.() ?? badgeTag}
        </span>
        <span className="rxn-card__title">{reaction.title}</span>
        <span className="rxn-card__arrow">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="rxn-card__body">
          <div className="rxn-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`rxn-tab-btn ${activeTab === tab.id ? 'rxn-tab-btn--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label()}
              </button>
            ))}
          </div>
          {activeTab === 'molecular' && <MolecularTab reaction={reaction} substanceMap={substanceMap} elementMap={elementMap} />}
          {activeTab === 'ionic' && <IonicTab reaction={reaction} />}
          {activeTab === 'why' && <WhyTab reaction={reaction} />}
          {activeTab === 'speed' && <SpeedTab reaction={reaction} />}
        </div>
      )}
    </div>
  );
}

export default function ReactionCards({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [substanceMap, setSubstanceMap] = useState<Map<string, SubstanceIndexEntry>>(new Map());
  const [elementMap, setElementMap] = useState<Map<string, ElementInfo>>(new Map());
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadReactions(locale), loadSubstancesIndex(locale), loadElements(locale)]).then(
      ([rxns, subs, elems]) => {
        setReactions(rxns);
        const sMap = new Map<string, SubstanceIndexEntry>();
        for (const s of subs) sMap.set(normalizeFormula(s.formula), s);
        setSubstanceMap(sMap);
        const eMap = new Map<string, ElementInfo>();
        for (const e of elems) eMap.set(e.symbol, { group: e.group, metal_type: e.metal_type });
        setElementMap(eMap);
        setLoading(false);
      },
    );
  }, [locale]);

  if (loading) {
    return <div className="rxn-catalog__loading">{m.loading()}</div>;
  }

  const filtered = filter === 'all'
    ? reactions
    : reactions.filter(r => r.type_tags.includes(filter));

  return (
    <section>
      <h2 className="rxn-catalog__title">{m.rxn_catalog_title()}</h2>

      <div className="rxn-catalog__filters">
        {TAG_FILTER_VALUES.map(value => (
          <button
            key={value}
            type="button"
            className={`rxn-catalog__filter-btn ${filter === value ? 'rxn-catalog__filter-btn--active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {TAG_FILTER_LABELS[value]?.() ?? value}
          </button>
        ))}
      </div>

      <div className="rxn-catalog__count">
        {m.rxn_shown_count({ filtered: String(filtered.length), total: String(reactions.length) })}
      </div>

      <div className="rxn-catalog__list">
        {filtered.map(r => (
          <ReactionCard key={r.reaction_id} reaction={r} substanceMap={substanceMap} elementMap={elementMap} />
        ))}
      </div>
    </section>
  );
}
