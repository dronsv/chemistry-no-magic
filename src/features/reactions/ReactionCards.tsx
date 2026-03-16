import { useState, useEffect } from 'react';
import type { Reaction, FacetState } from '../../types/reaction';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { MetalType } from '../../types/element';
import type { SupportedLocale } from '../../types/i18n';
import { loadReactions, loadSubstancesIndex, loadElements, loadReactionVocab } from '../../lib/data-loader';
import type { ReactionVocab } from '../../lib/data-loader';
import { parseFormula } from '../../lib/formula-parser';
import { calcOxidationStates } from '../../lib/oxidation-state';
import { matchesFacets, isFacetEmpty } from './facet-filter';
import ReactionFacets from './ReactionFacets';
import FormulaChip from '../../components/FormulaChip';
import OntologyRef from '../../components/OntologyRef';
import { parseOntRef } from '../../lib/ontology-ref';
import * as m from '../../paraglide/messages.js';

type ElementInfo = { group: number; metal_type: MetalType };

/** Normalize Unicode subscript digits (₀-₉) to ASCII for formula key matching. */
function normalizeFormula(f: string): string {
  return f.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => String(ch.charCodeAt(0) - 0x2080));
}

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
  gas_evolution: { icon: '↑', label: m.rxn_force_gas_evolution },
  water_formation: { icon: '💧', label: m.rxn_force_water_formation },
  weak_electrolyte_formation: { icon: '~', label: m.rxn_force_weak_electrolyte_formation },
  complexation: { icon: '⟨⟩', label: m.rxn_force_complexation },
};

const HEAT_LABELS: Record<string, { label: () => string; className: string }> = {
  exo: { label: m.rxn_heat_exo, className: 'rxn-heat-badge--exo' },
  endo: { label: m.rxn_heat_endo, className: 'rxn-heat-badge--endo' },
  negligible: { label: m.rxn_heat_negligible, className: 'rxn-heat-badge--negligible' },
  unknown: { label: m.rxn_heat_unknown, className: 'rxn-heat-badge--unknown' },
};

/** Resolve a vocab key like "hazard:corrosive" → display text, falling back to raw key. */
function v(vocab: ReactionVocab, key: string): string {
  return vocab[key] ?? key;
}

type TabId = 'molecular' | 'ionic' | 'why' | 'speed';

const TABS: { id: TabId; label: () => string }[] = [
  { id: 'molecular', label: m.rxn_view_molecular },
  { id: 'ionic', label: m.rxn_view_ionic },
  { id: 'why', label: m.rxn_view_why },
  { id: 'speed', label: m.rxn_view_speed },
];

function MolecularTab({ reaction, substanceMap, elementMap, vocab }: {
  reaction: Reaction;
  substanceMap: Map<string, SubstanceIndexEntry>;
  elementMap: Map<string, ElementInfo>;
  vocab: ReactionVocab;
}) {
  const gasFormulas = new Set((reaction.observations.gas ?? []).map(g => g.formula));
  const precipFormulas = new Set((reaction.observations.precipitate ?? []).map(p => p.formula));

  const renderItem = (item: { formula: string; name?: string; coeff: number }, i: number, isProduct: boolean) => {
    const sub = substanceMap.get(item.formula);
    const parsed = parseFormula(item.formula);
    const ox = calcOxidationStates(parsed, elementMap, item.formula);
    const marker = isProduct
      ? gasFormulas.has(item.formula) ? '↑' : precipFormulas.has(item.formula) ? '↓' : null
      : null;

    return (
      <span key={i} className="rxn-molecular-item">
        {item.coeff > 1 ? `${item.coeff} ` : ''}
        <FormulaChip
          formula={item.formula}
          name={sub?.name ?? item.name}
          substanceClass={sub?.class}
          substanceId={sub?.id}
          oxidationStates={!ox.error ? ox.assignments : undefined}
        />
        {marker && <span className="rxn-phase-marker">{marker}</span>}
      </span>
    );
  };

  return (
    <div className="rxn-tab-content">
      <div className="rxn-equation">{reaction.equation}</div>
      <div className="rxn-molecular-lists">
        <div className="rxn-molecular-group">
          <span className="rxn-molecular-label">{m.rxn_reactants()}</span>
          {reaction.molecular.reactants.map((item, i) => renderItem(item, i, false))}
        </div>
        <div className="rxn-molecular-group">
          <span className="rxn-molecular-label">{m.rxn_products()}</span>
          {reaction.molecular.products.map((item, i) => renderItem(item, i, true))}
        </div>
      </div>
      <div className="rxn-meta">
        <span className="rxn-phase-badge">
          {m.rxn_medium({ medium: reaction.phase.medium })}
          {reaction.phase.note_key && ` (${v(vocab, `phase_note:${reaction.phase.note_key}`)})`}
        </span>
        {reaction.conditions && (
          <span className="rxn-conditions">
            {reaction.conditions.temperature && reaction.conditions.temperature !== 'room' && m.rxn_temperature({ temp: reaction.conditions.temperature })}
            {reaction.conditions.catalyst && ` | ${m.rxn_catalyst({ name: reaction.conditions.catalyst })}`}
            {reaction.conditions.pressure && ` | ${m.rxn_pressure({ value: reaction.conditions.pressure })}`}
            {reaction.conditions.excess_note_key && ` | ${v(vocab, `excess_note:${reaction.conditions.excess_note_key}`)}`}
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
      {ionic.spectators && ionic.spectators.length > 0 && (
        <div className="rxn-ionic-notes">
          <span>{m.rxn_spectator_ions()}: </span>
          {ionic.spectators.map((ref, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <OntologyRef ontRef={parseOntRef(ref)} variant="chip" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function WhyTab({ reaction, vocab }: { reaction: Reaction; vocab: ReactionVocab }) {
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
          {obs.precipitate?.map((p, i) => (
            <li key={`p${i}`} className="rxn-observation">
              ↓ <OntologyRef ontRef={parseOntRef(p.ref)} variant="chip" />
              {p.color && ` (${v(vocab, `precip_color:${p.color}`)})`}
              {p.texture && `, ${v(vocab, `precip_texture:${p.texture}`)}`}
            </li>
          ))}
          {obs.gas?.map((g, i) => (
            <li key={`g${i}`} className="rxn-observation">
              {g.produced ? '↑' : '⟶'} <OntologyRef ontRef={parseOntRef(g.ref)} variant="chip" />
              {g.appearance && ` (${v(vocab, `gas_appearance:${g.appearance}`)})`}
            </li>
          ))}
          {obs.color_change?.map((c, i) => (
            <li key={`c${i}`} className="rxn-observation">
              {m.rxn_obs_color({ text: v(vocab, `color_type:${c.type}`) })}
              {c.ion_ref && <> — <OntologyRef ontRef={parseOntRef(c.ion_ref)} variant="chip" /></>}
            </li>
          ))}
          {obs.smell && (
            <li className="rxn-observation">
              {m.rxn_obs_smell({ text: v(vocab, `smell:${obs.smell.kind}`) })}
              {obs.smell.ref && <> — <OntologyRef ontRef={parseOntRef(obs.smell.ref)} variant="chip" /></>}
            </li>
          )}
          {obs.heat_intensity && (
            <li className="rxn-observation">
              {m.rxn_obs_heat({ text: v(vocab, `heat_intensity:${obs.heat_intensity.intensity}`) })}
            </li>
          )}
          {obs.other?.map((o, i) => (
            <li key={`o${i}`} className="rxn-observation">{v(vocab, `other:${o.facet}`)}</li>
          ))}
        </ul>
      </div>
      {heat && (
        <span className={`rxn-heat-badge ${heat.className}`}>{heat.label()}</span>
      )}
    </div>
  );
}

function SpeedTab({ reaction, vocab }: { reaction: Reaction; vocab: ReactionVocab }) {
  const { rate_tips, safety_notes } = reaction;
  return (
    <div className="rxn-tab-content">
      <div className="rxn-rate-section">
        <span className="rxn-section-label">{m.rxn_speed_up()}</span>
        <ul className="rxn-rate-list">
          {rate_tips.how_to_speed_up.map((tip, i) => (
            <li key={i}>
              {v(vocab, `speed:${tip.action}`)}
              {tip.note ? ` (${v(vocab, `speed_note:${tip.note}`)})` : ''}
            </li>
          ))}
        </ul>
      </div>
      {rate_tips.what_slows_down && rate_tips.what_slows_down.length > 0 && (
        <div className="rxn-rate-section">
          <span className="rxn-section-label">{m.rxn_slow_down()}</span>
          <ul className="rxn-rate-list">
            {rate_tips.what_slows_down.map((tip, i) => (
              <li key={i}>{v(vocab, `slow:${tip.factor}`)}</li>
            ))}
          </ul>
        </div>
      )}
      {safety_notes.length > 0 && (
        <div className="rxn-safety">
          <span className="rxn-safety__label">{m.rxn_safety()}</span>
          <ul className="rxn-safety__list">
            {safety_notes.map((note, i) => (
              <li key={i}>
                {v(vocab, `hazard:${note.hazard}`)}
                {note.ppe ? ` — ${note.ppe.map(p => v(vocab, `ppe:${p}`)).join(', ')}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReactionCard({ reaction, substanceMap, elementMap, vocab }: {
  reaction: Reaction;
  substanceMap: Map<string, SubstanceIndexEntry>;
  elementMap: Map<string, ElementInfo>;
  vocab: ReactionVocab;
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
        <span className="rxn-card__title">{reaction.equation}</span>
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
          {activeTab === 'molecular' && <MolecularTab reaction={reaction} substanceMap={substanceMap} elementMap={elementMap} vocab={vocab} />}
          {activeTab === 'ionic' && <IonicTab reaction={reaction} />}
          {activeTab === 'why' && <WhyTab reaction={reaction} vocab={vocab} />}
          {activeTab === 'speed' && <SpeedTab reaction={reaction} vocab={vocab} />}
        </div>
      )}
    </div>
  );
}

export default function ReactionCards({ locale = 'ru' as SupportedLocale, facets, onFacetsChange }: {
  locale?: SupportedLocale;
  facets?: FacetState;
  onFacetsChange?: (state: FacetState) => void;
}) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [substanceMap, setSubstanceMap] = useState<Map<string, SubstanceIndexEntry>>(new Map());
  const [elementMap, setElementMap] = useState<Map<string, ElementInfo>>(new Map());
  const [vocab, setVocab] = useState<ReactionVocab>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadReactions(locale),
      loadSubstancesIndex(locale),
      loadElements(locale),
      loadReactionVocab(locale),
    ]).then(
      ([rxns, subs, elems, voc]) => {
        setReactions(rxns);
        const sMap = new Map<string, SubstanceIndexEntry>();
        for (const s of subs) sMap.set(normalizeFormula(s.formula), s);
        setSubstanceMap(sMap);
        const eMap = new Map<string, ElementInfo>();
        for (const e of elems) eMap.set(e.symbol, { group: e.group, metal_type: e.metal_type });
        setElementMap(eMap);
        setVocab(voc);
        setLoading(false);
      },
    );
  }, [locale]);

  if (loading) {
    return <div className="rxn-catalog__loading">{m.loading()}</div>;
  }

  const filtered = facets && !isFacetEmpty(facets)
    ? reactions.filter(r => matchesFacets(r, facets, substanceMap))
    : reactions;

  return (
    <section>
      <h2 className="rxn-catalog__title">{m.rxn_catalog_title()}</h2>

      {facets && onFacetsChange && (
        <ReactionFacets
          facets={facets}
          onFacetsChange={onFacetsChange}
          reactions={reactions}
          substanceMap={substanceMap}
          locale={locale}
        />
      )}

      <div className="rxn-catalog__count">
        {m.rxn_shown_count({ filtered: String(filtered.length), total: String(reactions.length) })}
      </div>

      <div className="rxn-catalog__list">
        {filtered.map(r => (
          <ReactionCard key={r.reaction_id} reaction={r} substanceMap={substanceMap} elementMap={elementMap} vocab={vocab} />
        ))}
      </div>
    </section>
  );
}
