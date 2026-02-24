import { useState, useEffect, useCallback } from 'react';
import type { CompetencyId } from '../../../types/competency';
import type { BktParams } from '../../../types/bkt';
import type { Element } from '../../../types/element';
import type { BondExamplesData } from '../../../types/bond';
import type { SupportedLocale } from '../../../types/i18n';
import { bktUpdate, getLevel } from '../../../lib/bkt-engine';
import { loadBktState, saveBktPL } from '../../../lib/storage';
import { loadBktParams, loadCompetencies, loadElements, loadBondExamples } from '../../../lib/data-loader';
import { generateExercise } from './generate-exercises';
import type { Exercise } from './generate-exercises';
import MultipleChoiceExercise from '../../substances/practice/MultipleChoiceExercise';
import * as m from '../../../paraglide/messages.js';

const LEVEL_LABELS: Record<string, () => string> = {
  none: m.level_none,
  basic: m.level_basic,
  confident: m.level_confident,
  automatic: m.level_automatic,
};

const COMPETENCY_IDS = ['bond_type', 'crystal_structure_type'] as const;

interface Props {
  locale?: SupportedLocale;
}

export default function PracticeSection({ locale }: Props) {
  const [elements, setElements] = useState<Element[]>([]);
  const [bondExamples, setBondExamples] = useState<BondExamplesData | null>(null);
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
      loadCompetencies(locale),
      loadBondExamples(),
    ]).then(([elems, params, comps, examples]) => {
      setElements(elems);
      setBondExamples(examples);

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
    if (elements.length === 0 || !bondExamples) return;
    setExercise(generateExercise(elements, bondExamples));
    setCount(c => c + 1);
  }, [elements, bondExamples]);

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
      <h2 className="practice-section__title">{m.practice_title()}</h2>

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
              <span className="practice-level__label">{LEVEL_LABELS[level]?.() ?? level}</span>
            </div>
          );
        })}
      </div>

      {mastered && (
        <div className="practice-section__mastered">
          {m.practice_mastered_both()}
        </div>
      )}

      {exercise && (
        <div className="practice-section__exercise">
          <div className="practice-section__counter">{m.practice_task_counter({ count: String(count) })}</div>
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
