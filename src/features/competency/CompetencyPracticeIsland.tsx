import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import type { CompetencyId } from '../../types/competency';
import type { BktParams } from '../../types/bkt';
import type { SupportedLocale } from '../../types/i18n';
import { bktUpdate, getLevel } from '../../lib/bkt-engine';
import { loadBktState, saveBktPL } from '../../lib/storage';
import { loadBktParams } from '../../lib/data-loader';
import { loadEngineAdapter, loadAdapter } from './exercise-adapters';
import type { Adapter, Exercise } from './exercise-adapters';
import CompMultipleChoice from './CompMultipleChoice';
import CompetencyBar from '../profile/CompetencyBar';
import * as m from '../../paraglide/messages.js';
import './competency.css';

const OrbitalFillingExercise = lazy(() =>
  import('../periodic-table/practice/OrbitalFillingExercise'),
);

const LEVEL_LABELS: Record<string, () => string> = {
  none: m.level_none,
  basic: m.level_basic,
  confident: m.level_confident,
  automatic: m.level_automatic,
};

const MAX_RETRIES = 30;

interface Props {
  competencyId: string;
  competencyName: string;
  locale?: SupportedLocale;
}

export default function CompetencyPracticeIsland({ competencyId, competencyName, locale }: Props) {
  const [adapter, setAdapter] = useState<Adapter | null>(null);
  const [bktParamsMap, setBktParamsMap] = useState<Map<string, BktParams>>(new Map());
  const [pL, setPL] = useState(0);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadEngineAdapter(competencyId, locale).then(a => a ?? loadAdapter(competencyId, locale)),
      loadBktParams(),
    ]).then(([adp, params]) => {
      setAdapter(adp);

      const map = new Map<string, BktParams>();
      for (const p of params) map.set(p.competency_id, p);
      setBktParamsMap(map);

      const state = loadBktState();
      const currentPL = state.get(competencyId as CompetencyId) ?? map.get(competencyId)?.P_L0 ?? 0.25;
      setPL(currentPL);
      setLoading(false);
    }).catch(() => {
      setError(m.error_loading_short());
      setLoading(false);
    });
  }, [competencyId, locale]);

  const generateFiltered = useCallback((adp: Adapter): Exercise | null => {
    // Try to find exercise where this competency is primary
    for (let i = 0; i < MAX_RETRIES; i++) {
      const ex = adp.generate();
      if (ex.competencyMap[competencyId] === 'P') return ex;
    }
    // Fall back to secondary
    for (let i = 0; i < MAX_RETRIES; i++) {
      const ex = adp.generate();
      if (ex.competencyMap[competencyId] === 'S') return ex;
    }
    // Last resort: return any exercise
    return adp.generate();
  }, [competencyId]);

  const nextExercise = useCallback(() => {
    if (!adapter) return;
    const ex = generateFiltered(adapter);
    setExercise(ex);
    setCount(c => c + 1);
  }, [adapter, generateFiltered]);

  useEffect(() => {
    if (!loading && !exercise && adapter) nextExercise();
  }, [loading, exercise, adapter, nextExercise]);

  function handleAnswer(correct: boolean) {
    if (!exercise) return;

    const state = loadBktState();

    for (const [compId, weight] of Object.entries(exercise.competencyMap)) {
      const params = bktParamsMap.get(compId);
      if (!params) continue;
      const currentPL = state.get(compId as CompetencyId) ?? params.P_L0;
      const isPrimary = weight === 'P';
      const updatedPL = isPrimary
        ? bktUpdate(currentPL, params, correct, false)
        : bktUpdate(currentPL, params, correct, true);
      saveBktPL(compId as CompetencyId, updatedPL);

      if (compId === competencyId) setPL(updatedPL);
    }

    nextExercise();
  }

  if (loading) return null;
  if (error) return <p className="comp-practice__error">{error}</p>;

  const level = getLevel(pL);

  return (
    <section className="comp-practice">
      <h2 className="comp-practice__title">{m.comp_practice()}</h2>

      <div className="comp-practice__mastery">
        <CompetencyBar name={competencyName} pL={pL} />
      </div>

      {exercise && (
        <div className="comp-practice__exercise">
          <div className="comp-practice__counter">
            {m.practice_task_counter({ count: String(count) })}
          </div>
          {exercise.format === 'interactive_orbital' && exercise.targetZ ? (
            <Suspense fallback={null}>
              <OrbitalFillingExercise
                key={count}
                exercise={exercise}
                onAnswer={handleAnswer}
              />
            </Suspense>
          ) : (
            <CompMultipleChoice
              key={count}
              exercise={exercise}
              onAnswer={handleAnswer}
            />
          )}
        </div>
      )}

      {pL >= 0.93 && (
        <div className="comp-practice__mastered">
          {m.level_automatic()} — {LEVEL_LABELS[level]?.() ?? level}
        </div>
      )}
    </section>
  );
}
