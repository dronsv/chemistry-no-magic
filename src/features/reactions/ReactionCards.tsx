import { useState, useEffect } from 'react';
import type { Reaction } from '../../types/reaction';
import { loadReactions } from '../../lib/data-loader';

const TAG_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'neutralization', label: 'Нейтрализация' },
  { value: 'precipitation', label: 'Осадок' },
  { value: 'gas_evolution', label: 'Газ' },
  { value: 'amphoteric', label: 'Амфотерность' },
  { value: 'acidic_oxide', label: 'Оксиды' },
  { value: 'decomposition', label: 'Разложение' },
];

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

function MolecularTab({ reaction }: { reaction: Reaction }) {
  return (
    <div className="rxn-tab-content">
      <div className="rxn-equation">{reaction.equation}</div>
      <div className="rxn-molecular-lists">
        <div className="rxn-molecular-group">
          <span className="rxn-molecular-label">Реагенты:</span>
          {reaction.molecular.reactants.map((r, i) => (
            <span key={i} className="rxn-molecular-item">
              {r.coeff > 1 ? `${r.coeff} ` : ''}{r.formula}
              {r.name && <span className="rxn-molecular-name"> — {r.name}</span>}
            </span>
          ))}
        </div>
        <div className="rxn-molecular-group">
          <span className="rxn-molecular-label">Продукты:</span>
          {reaction.molecular.products.map((p, i) => (
            <span key={i} className="rxn-molecular-item">
              {p.coeff > 1 ? `${p.coeff} ` : ''}{p.formula}
              {p.name && <span className="rxn-molecular-name"> — {p.name}</span>}
            </span>
          ))}
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

function ReactionCard({ reaction }: { reaction: Reaction }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('molecular');

  const primaryTag = reaction.type_tags[0] ?? 'exchange';

  return (
    <div className={`rxn-card ${expanded ? 'rxn-card--open' : ''}`}>
      <button
        type="button"
        className="rxn-card__header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`rxn-card__type-badge rxn-card__type-badge--${primaryTag}`}>
          {TAG_FILTERS.find(f => f.value === primaryTag)?.label ?? primaryTag}
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
          {activeTab === 'molecular' && <MolecularTab reaction={reaction} />}
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
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReactions().then(data => {
      setReactions(data);
      setLoading(false);
    });
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
          <ReactionCard key={r.reaction_id} reaction={r} />
        ))}
      </div>
    </section>
  );
}
