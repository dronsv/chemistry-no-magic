import { useState, useEffect, useCallback } from 'react';
import type { CompetencyId } from '../../../types/competency';
import type { BktParams } from '../../../types/bkt';
import type { Element } from '../../../types/element';
import { bktUpdate, getLevel } from '../../../lib/bkt-engine';
import { loadBktState, saveBktPL } from '../../../lib/storage';
import { loadBktParams, loadCompetencies, loadElements } from '../../../lib/data-loader';
import { generateExercise } from './generate-exercises';
import type { Exercise } from './generate-exercises';
import MultipleChoiceExercise from '../../substances/practice/MultipleChoiceExercise';

const LEVEL_LABELS: Record<string, string> = {
  none: 'Начальный',
  basic: 'Базовый',
  confident: 'Уверенный',
  automatic: 'Автоматизм',
};

const COMPETENCY_IDS = ['bond_type', 'crystal_structure_type'] as const;

export default function PracticeSection() {
  const [elements, setElements] = useState<Element[]>([]);
  const [bktParamsMap, setBktParamsMap] = useState<Map<string, BktParams>>(new Map());
  const [compNames, setCompNames] = useState<Map<string, string>>(new Map());
  const [pLevels, setPLevels] = useState<Map<string, number>>(new Map());
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadElements(),
      loadBktParams(),
      loadCompetencies(),
    ]).then(([elems, params, comps]) => {
      setElements(elems);

      const map = new Map<string, BktParams>();
      for (const p of params) map.set(p.competency_id, p);
      setBktParamsMap(map);

      const names = new Map<string, string>();
      for (const c of comps) names.set(c.id, c.name_ru);
      setCompNames(names);

      setPLevels(loadBktState());
      setLoading(false);
    });
  }, []);

  const nextExercise = useCallback(() => {
    if (elements.length === 0) return;
    setExercise(generateExercise(elements));
    setCount(c => c + 1);
  }, [elements]);

  useEffect(() => {
    if (!loading && !exercise && elements.length > 0) nextExercise();
  }, [loading, exercise, elements, nextExercise]);

  function handleAnswer(correct: boolean) {
    if (!exercise) return;

    const newPL = new Map(pLevels);
    for (const [compId, weight] of Object.entries(exercise.competencyMap)) {
      const params = bktParamsMap.get(compId);
      if (!params) continue;
      const currentPL = newPL.get(compId) ?? params.P_L0;
      const isPrimary = weight === 'P';
      const updatedPL = isPrimary
        ? bktUpdate(currentPL, params, correct, false)
        : bktUpdate(currentPL, params, correct, true);
      newPL.set(compId, updatedPL);
      saveBktPL(compId as CompetencyId, updatedPL);
    }
    setPLevels(newPL);
    nextExercise();
  }

  if (loading) return null;

  const bondPL = pLevels.get('bond_type') ?? 0;
  const crystalPL = pLevels.get('crystal_structure_type') ?? 0;
  const mastered = bondPL >= 0.8 && crystalPL >= 0.8;

  return (
    <section className="practice-section">
      <h2 className="practice-section__title">Практика</h2>

      <div className="practice-section__levels">
        {COMPETENCY_IDS.map(compId => {
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

      {exercise && (
        <div className="practice-section__exercise">
          <div className="practice-section__counter">Задание #{count}</div>
          <MultipleChoiceExercise
            key={count}
            exercise={exercise}
            onAnswer={handleAnswer}
          />
        </div>
      )}
    </section>
  );
}
