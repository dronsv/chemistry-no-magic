import type { CompetencyId } from '../../types/competency';
import type { CompetencyLevel } from '../../lib/bkt-engine';
import { getLevel } from '../../lib/bkt-engine';

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

const LEVEL_LABELS: Record<CompetencyLevel, string> = {
  none: 'Начальный',
  basic: 'Базовый',
  confident: 'Уверенный',
  automatic: 'Автоматизм',
};

const COMPETENCY_ORDER: CompetencyId[] = [
  'periodic_table',
  'electron_config',
  'oxidation_states',
  'classification',
  'naming',
  'reactions_exchange',
  'gas_precipitate_logic',
  'reactions_redox',
  'reaction_energy_profile',
  'catalyst_role_understanding',
  'calculations_basic',
  'calculations_solutions',
];

interface ResultsSummaryProps {
  results: Map<CompetencyId, number>;
}

export default function ResultsSummary({ results }: ResultsSummaryProps) {
  return (
    <div className="diag-results">
      <h2 className="diag-results__title">Результаты диагностики</h2>
      <p className="diag-results__subtitle">
        Ваш профиль компетенций по химии на основе стартового теста
      </p>

      <div className="diag-results__list">
        {COMPETENCY_ORDER.map((id) => {
          const pL = results.get(id) ?? 0.25;
          const level = getLevel(pL);
          const percent = Math.round(pL * 100);

          return (
            <div key={id} className="comp-bar">
              <span className="comp-bar__name">{COMPETENCY_NAMES[id]}</span>
              <div className="comp-bar__track">
                <div
                  className={`comp-bar__fill comp-bar__fill--${level}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="comp-bar__value">{percent}%</span>
              <span className={`comp-bar__level comp-bar__level--${level}`}>
                {LEVEL_LABELS[level]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="diag-results__actions">
        <a href="/profile/" className="btn btn-primary">
          Открыть профиль
        </a>
      </div>
    </div>
  );
}
