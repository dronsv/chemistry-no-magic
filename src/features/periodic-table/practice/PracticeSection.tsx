import { useState, useEffect, useCallback } from 'react';
import type { Element } from '../../../types/element';
import type { CompetencyId, CompetencyNode } from '../../../types/competency';
import type { BktParams } from '../../../types/bkt';
import { bktUpdate, getLevel } from '../../../lib/bkt-engine';
import { loadBktState, saveBktPL } from '../../../lib/storage';
import { loadBktParams, loadCompetencies } from '../../../lib/data-loader';
import { generateExercise } from './generate-exercises';
import type { Exercise } from './generate-exercises';
import MultipleChoiceExercise from './MultipleChoiceExercise';
import OrbitalFillingExercise from './OrbitalFillingExercise';

const LEVEL_LABELS: Record<string, string> = {
  none: 'Начальный',
  basic: 'Базовый',
  confident: 'Уверенный',
  automatic: 'Автоматизм',
};

interface Props {
  elements: Element[];
}

export default function PracticeSection({ elements }: Props) {
  const [bktParamsMap, setBktParamsMap] = useState<Map<string, BktParams>>(new Map());
  const [compNames, setCompNames] = useState<Map<string, string>>(new Map());
  const [pLevels, setPLevels] = useState<Map<string, number>>(new Map());
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    loadBktParams().then(params => {
      const map = new Map<string, BktParams>();
      for (const p of params) map.set(p.competency_id, p);
      setBktParamsMap(map);
    });
    loadCompetencies().then(comps => {
      const names = new Map<string, string>();
      for (const c of comps) names.set(c.id, c.name_ru);
      setCompNames(names);
    });
    setPLevels(loadBktState());
  }, []);

  const nextExercise = useCallback(() => {
    setExercise(generateExercise(elements));
    setCount(c => c + 1);
  }, [elements]);

  useEffect(() => {
    if (elements.length > 0 && !exercise) nextExercise();
  }, [elements, exercise, nextExercise]);

  function handleAnswer(correct: boolean) {
    if (!exercise) return;

    const newPL = new Map(pLevels);
    for (const [compId, weight] of Object.entries(exercise.competencyMap)) {
      const params = bktParamsMap.get(compId);
      if (!params) continue;
      const currentPL = newPL.get(compId) ?? params.P_L0;
      const isPrimary = weight === 'P';
      // Secondary competencies get reduced impact
      const updatedPL = isPrimary
        ? bktUpdate(currentPL, params, correct, false)
        : bktUpdate(currentPL, params, correct, true); // hint=true reduces update weight
      newPL.set(compId, updatedPL);
      saveBktPL(compId as CompetencyId, updatedPL);
    }
    setPLevels(newPL);
    nextExercise();
  }

  // Check mastery
  const ptPL = pLevels.get('periodic_table') ?? 0;
  const ecPL = pLevels.get('electron_config') ?? 0;
  const mastered = ptPL >= 0.8 && ecPL >= 0.8;

  return (
    <section className="practice-section">
      <h2 className="practice-section__title">Практика</h2>

      {/* Competency levels */}
      <div className="practice-section__levels">
        {['periodic_table', 'electron_config'].map(compId => {
          const pL = pLevels.get(compId) ?? 0;
          const level = getLevel(pL);
          return (
            <div key={compId} className="practice-level">
              <span className="practice-level__name">{compNames.get(compId) ?? compId}</span>
              <div className="practice-level__bar">
                <div
                  className={`practice-level__fill practice-level__fill--${level}`}
                  style={{ width: `${Math.round(pL * 100)}%` }}
                />
              </div>
              <span className="practice-level__label">{LEVEL_LABELS[level]}</span>
            </div>
          );
        })}
      </div>

      {mastered && (
        <div className="practice-section__mastered">
          Отлично! Обе компетенции на уровне «Уверенный» или выше.
          Можете переходить к следующему модулю.
        </div>
      )}

      {/* Exercise */}
      {exercise && (
        <div className="practice-section__exercise">
          <div className="practice-section__counter">Задание #{count}</div>
          {exercise.format === 'multiple_choice' ? (
            <MultipleChoiceExercise
              key={count}
              exercise={exercise}
              onAnswer={handleAnswer}
            />
          ) : (
            <OrbitalFillingExercise
              key={count}
              exercise={exercise}
              onAnswer={handleAnswer}
            />
          )}
        </div>
      )}
    </section>
  );
}
