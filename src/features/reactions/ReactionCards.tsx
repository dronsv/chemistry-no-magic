import { useState, useEffect } from 'react';
import type { Reaction } from '../../types/reaction';
import type { SubstanceIndexEntry } from '../../types/classification';
import type { MetalType } from '../../types/element';
import { loadReactions, loadSubstancesIndex, loadElements } from '../../lib/data-loader';
import { parseFormula } from '../../lib/formula-parser';
import { calcOxidationStates } from '../../lib/oxidation-state';
import FormulaChip from '../../components/FormulaChip';

type ElementInfo = { group: number; metal_type: MetalType };

/** Normalize Unicode subscript digits (₀-₉) to ASCII for formula key matching. */
function normalizeFormula(f: string): string {
  return f.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, ch => String(ch.charCodeAt(0) - 0x2080));
}

const TAG_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'neutralization', label: 'Нейтрализация' },
  { value: 'precipitation', label: 'Осадок' },
  { value: 'gas_evolution', label: 'Газ' },
  { value: 'substitution', label: 'Замещение' },
  { value: 'qualitative_test', label: 'Качественные' },
  { value: 'amphoteric', label: 'Амфотерность' },
  { value: 'acidic_oxide', label: 'Оксиды' },
  { value: 'decomposition', label: 'Разложение' },
];

const TAG_LABELS: Record<string, string> = {
  exchange: 'Обмена',
  substitution: 'Замещение',
  redox: 'ОВР',
  neutralization: 'Нейтрализация',
  precipitation: 'Осадок',
  gas_evolution: 'Газ',
  gas_absorption: 'Поглощение газа',
  amphoteric: 'Амфотерность',
  complexation: 'Комплекс',
  acidic_oxide: 'Оксиды',
  decomposition: 'Разложение',
  qualitative_test: 'Качественная',
};

/** Pick the most descriptive (specific) tag for the card badge */
function getBadgeTag(tags: string[]): string {
  // Prefer specific tags over generic "exchange"
  const specific = tags.find(t => t !== 'exchange');
  return specific ?? tags[0] ?? 'exchange';
}

const DRIVING_FORCE_LABELS: Record<string, { icon: string; label: string }> = {
  precipitation: { icon: '↓', label: 'Осадок' },
  gas_release: { icon: '↑', label: 'Газ' },
  water_formation: { icon: '💧', label: 'Вода' },
  weak_electrolyte: { icon: '~', label: 'Слабый электролит' },
  complex_formation: { icon: '⟨⟩', label: 'Комплекс' },
};

const HEAT_LABELS: Record<string, { label: string; className: string }> = {
  exo: { label: 'Экзотермическая', className: 'rxn-heat-badge--exo' },
  endo: { label: 'Эндотермическая', className: 'rxn-heat-badge--endo' },
  negligible: { label: 'Незначительный тепловой эффект', className: 'rxn-heat-badge--negligible' },
  unknown: { label: 'Тепловой эффект не определён', className: 'rxn-heat-badge--unknown' },
};

type TabId = 'molecular' | 'ionic' | 'why' | 'speed';

const TABS: { id: TabId; label: string }[] = [
  { id: 'molecular', label: 'Молекулярное' },
  { id: 'ionic', label: 'Ионное' },
  { id: 'why', label: 'Почему идёт' },
  { id: 'speed', label: 'Как ускорить' },
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
          <span className="rxn-molecular-label">Реагенты:</span>
          {reaction.molecular.reactants.map(renderItem)}
        </div>
        <div className="rxn-molecular-group">
          <span className="rxn-molecular-label">Продукты:</span>
          {reaction.molecular.products.map(renderItem)}
        </div>
      </div>
      <div className="rxn-meta">
        <span className="rxn-phase-badge">Среда: {reaction.phase.medium}{reaction.phase.notes ? ` (${reaction.phase.notes})` : ''}</span>
        {reaction.conditions && (
          <span className="rxn-conditions">
            {reaction.conditions.temperature && reaction.conditions.temperature !== 'room' && `Температура: ${reaction.conditions.temperature}`}
            {reaction.conditions.catalyst && ` | Катализатор: ${reaction.conditions.catalyst}`}
            {reaction.conditions.pressure && ` | Давление: ${reaction.conditions.pressure}`}
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
    return <div className="rxn-tab-content"><p className="rxn-no-data">Ионное уравнение неприменимо для данной реакции.</p></div>;
  }
  return (
    <div className="rxn-tab-content">
      {ionic.full && (
        <div className="rxn-ionic-block">
          <span className="rxn-ionic-label">Полное ионное:</span>
          <div className="rxn-ionic-full">{ionic.full}</div>
        </div>
      )}
      {ionic.net && (
        <div className="rxn-ionic-block">
          <span className="rxn-ionic-label">Сокращённое ионное:</span>
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
        <span className="rxn-section-label">Движущие силы:</span>
        <div className="rxn-badge-row">
          {reaction.driving_forces.map(f => {
            const info = DRIVING_FORCE_LABELS[f];
            return (
              <span key={f} className="rxn-driving-badge">
                <span className="rxn-driving-badge__icon">{info?.icon ?? '?'}</span>
                {info?.label ?? f}
              </span>
            );
          })}
        </div>
      </div>
      <div className="rxn-observations">
        <span className="rxn-section-label">Наблюдения:</span>
        <ul className="rxn-observation-list">
          {obs.precipitate?.map((p, i) => <li key={`p${i}`} className="rxn-observation">↓ Осадок: {p}</li>)}
          {obs.gas?.map((g, i) => <li key={`g${i}`} className="rxn-observation">↑ Газ: {g}</li>)}
          {obs.color_change && <li className="rxn-observation">Изменение цвета: {obs.color_change}</li>}
          {obs.smell && <li className="rxn-observation">Запах: {obs.smell}</li>}
          {obs.heat && <li className="rxn-observation">Тепло: {obs.heat}</li>}
          {obs.other?.map((o, i) => <li key={`o${i}`} className="rxn-observation">{o}</li>)}
        </ul>
      </div>
      {heat && (
        <span className={`rxn-heat-badge ${heat.className}`}>{heat.label}</span>
      )}
    </div>
  );
}

function SpeedTab({ reaction }: { reaction: Reaction }) {
  const { rate_tips, safety_notes } = reaction;
  return (
    <div className="rxn-tab-content">
      <div className="rxn-rate-section">
        <span className="rxn-section-label">Как ускорить:</span>
        <ul className="rxn-rate-list">
          {rate_tips.how_to_speed_up.map((tip, i) => <li key={i}>{tip}</li>)}
        </ul>
      </div>
      {rate_tips.what_slows_down && rate_tips.what_slows_down.length > 0 && (
        <div className="rxn-rate-section">
          <span className="rxn-section-label">Что замедляет:</span>
          <ul className="rxn-rate-list">
            {rate_tips.what_slows_down.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </div>
      )}
      {safety_notes.length > 0 && (
        <div className="rxn-safety">
          <span className="rxn-safety__label">Безопасность:</span>
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
          {TAG_LABELS[badgeTag] ?? badgeTag}
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
                {tab.label}
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

export default function ReactionCards() {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [substanceMap, setSubstanceMap] = useState<Map<string, SubstanceIndexEntry>>(new Map());
  const [elementMap, setElementMap] = useState<Map<string, ElementInfo>>(new Map());
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadReactions(), loadSubstancesIndex(), loadElements()]).then(
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
  }, []);

  if (loading) {
    return <div className="rxn-catalog__loading">Загрузка...</div>;
  }

  const filtered = filter === 'all'
    ? reactions
    : reactions.filter(r => r.type_tags.includes(filter));

  return (
    <section>
      <h2 className="rxn-catalog__title">Каталог реакций</h2>

      <div className="rxn-catalog__filters">
        {TAG_FILTERS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`rxn-catalog__filter-btn ${filter === opt.value ? 'rxn-catalog__filter-btn--active' : ''}`}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="rxn-catalog__count">
        Показано: {filtered.length} из {reactions.length}
      </div>

      <div className="rxn-catalog__list">
        {filtered.map(r => (
          <ReactionCard key={r.reaction_id} reaction={r} substanceMap={substanceMap} elementMap={elementMap} />
        ))}
      </div>
    </section>
  );
}
