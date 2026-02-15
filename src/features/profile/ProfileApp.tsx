import { useState } from 'react';
import type { CompetencyId } from '../../types/competency';
import { loadBktState, clearBktState } from '../../lib/storage';
import CompetencyBar from './CompetencyBar';
import './profile.css';

const COMPETENCY_NAMES: Record<CompetencyId, string> = {
  periodic_table: 'Периодическая таблица',
  electron_config: 'Электронная конфигурация',
  oxidation_states: 'Степени окисления',
  classification: 'Классификация веществ',
  naming: 'Номенклатура',
  reactions_exchange: 'Реакции ионного обмена',
  gas_precipitate_logic: 'Признаки реакций',
  reactions_redox: 'Окислительно-восстановительные реакции',
  reaction_energy_profile: 'Скорость и равновесие',
  catalyst_role_understanding: 'Катализ и энергетика',
  calculations_basic: 'Базовые расчёты',
  calculations_solutions: 'Расчёты растворов',
};

interface CompetencyGroup {
  title: string;
  ids: CompetencyId[];
}

const GROUPS: CompetencyGroup[] = [
  {
    title: 'А — Строение атома и таблица',
    ids: ['periodic_table', 'electron_config', 'oxidation_states'],
  },
  {
    title: 'Б — Вещества',
    ids: ['classification', 'naming'],
  },
  {
    title: 'В — Реакции',
    ids: ['reactions_exchange', 'gas_precipitate_logic', 'reactions_redox'],
  },
  {
    title: 'Г — Энергетика и кинетика',
    ids: ['reaction_energy_profile', 'catalyst_role_understanding'],
  },
  {
    title: 'Д — Расчёты',
    ids: ['calculations_basic', 'calculations_solutions'],
  },
];

export default function ProfileApp() {
  const [state, setState] = useState(() => loadBktState());

  if (state.size === 0) {
    return (
      <div className="profile">
        <h1 className="profile__title">Профиль компетенций</h1>
        <div className="profile__empty">
          <p>Данных пока нет. Пройдите диагностику, чтобы увидеть свой профиль.</p>
          <a href="/diagnostics/" className="btn btn-primary profile__empty-link">
            Пройти диагностику
          </a>
        </div>
      </div>
    );
  }

  function handleClear() {
    clearBktState();
    setState(new Map());
  }

  return (
    <div className="profile">
      <h1 className="profile__title">Профиль компетенций</h1>

      {GROUPS.map((group) => (
        <div key={group.title} className="profile__group">
          <h2 className="profile__group-title">{group.title}</h2>
          <div className="profile__bars">
            {group.ids.map((id) => (
              <CompetencyBar
                key={id}
                name={COMPETENCY_NAMES[id]}
                pL={state.get(id) ?? 0.25}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="profile__actions">
        <a href="/diagnostics/" className="btn btn-primary">
          Пройти диагностику заново
        </a>
        <button type="button" className="profile__clear" onClick={handleClear}>
          Сбросить результаты
        </button>
      </div>
    </div>
  );
}
