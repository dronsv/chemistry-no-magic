import { useState, useEffect } from 'react';
import type { CompetencyNode } from '../../types/competency';
import { loadCompetencies } from '../../lib/data-loader';
import { loadBktState, clearBktState } from '../../lib/storage';
import CompetencyBar from './CompetencyBar';
import './profile.css';

export default function ProfileApp() {
  const [state, setState] = useState(() => loadBktState());
  const [competencies, setCompetencies] = useState<CompetencyNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompetencies()
      .then(setCompetencies)
      .catch(err => setError(err instanceof Error ? err.message : 'Ошибка загрузки'));
  }, []);

  if (error) {
    return <div className="profile"><p className="profile__error">{error}</p></div>;
  }

  if (!competencies) {
    return <div className="profile"><p className="profile__loading">Загрузка...</p></div>;
  }

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

  // Group competencies by block
  const blocks = new Map<string, { title: string; items: CompetencyNode[] }>();
  for (const c of competencies) {
    const key = c.block;
    if (!blocks.has(key)) {
      blocks.set(key, { title: `${key} — ${c.block_name_ru}`, items: [] });
    }
    blocks.get(key)!.items.push(c);
  }

  return (
    <div className="profile">
      <h1 className="profile__title">Профиль компетенций</h1>

      {[...blocks.entries()].map(([key, group]) => (
        <div key={key} className="profile__group">
          <h2 className="profile__group-title">{group.title}</h2>
          <div className="profile__bars">
            {group.items.map((c) => (
              <CompetencyBar
                key={c.id}
                name={c.name_ru}
                pL={state.get(c.id) ?? 0.25}
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
