import { useState, useEffect, useCallback } from 'react';
import type { CompetencyId } from '../../../types/competency';
import type { BktParams } from '../../../types/bkt';
import type { ReactionTemplate } from '../../../types/templates';
import type { SolubilityEntry, ActivitySeriesEntry, ApplicabilityRule } from '../../../types/rules';
import type { Reaction } from '../../../types/reaction';
import { bktUpdate, getLevel } from '../../../lib/bkt-engine';
import { loadBktState, saveBktPL } from '../../../lib/storage';
import {
  loadBktParams,
  loadCompetencies,
  loadReactionTemplates,
  loadSolubilityRules,
  loadActivitySeries,
  loadApplicabilityRules,
  loadReactions,
} from '../../../lib/data-loader';
import { generateExercise } from './generate-exercises';
import type { Exercise } from './generate-exercises';
import MultipleChoiceExercise from './MultipleChoiceExercise';

const LEVEL_LABELS: Record<string, string> = {
  none: 'Начальный',
  basic: 'Базовый',
  confident: 'Уверенный',
  automatic: 'Автоматизм',
};

const COMPETENCY_IDS = [
  'reactions_exchange',
  'gas_precipitate_logic',
  'reaction_energy_profile',
  'qualitative_analysis_logic',
  'electrolyte_logic',
] as const;

export default function PracticeSection() {
  const [templates, setTemplates] = useState<ReactionTemplate[]>([]);
  const [solubility, setSolubility] = useState<SolubilityEntry[]>([]);
  const [activitySeries, setActivitySeries] = useState<ActivitySeriesEntry[]>([]);
  const [applicabilityRules, setApplicabilityRules] = useState<ApplicabilityRule[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [bktParamsMap, setBktParamsMap] = useState<Map<string, BktParams>>(new Map());
  const [compNames, setCompNames] = useState<Map<string, string>>(new Map());
  const [pLevels, setPLevels] = useState<Map<string, number>>(new Map());
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadReactionTemplates(),
      loadSolubilityRules(),
      loadActivitySeries(),
      loadApplicabilityRules(),
      loadBktParams(),
      loadCompetencies(),
      loadReactions(),
    ]).then(([tmpl, sol, act, appl, params, comps, rxns]) => {
      setTemplates(tmpl);
      setSolubility(sol);
      setActivitySeries(act);
      setApplicabilityRules(appl);
      setReactions(rxns);

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
    if (templates.length === 0 || solubility.length === 0 || activitySeries.length === 0) return;
    setExercise(generateExercise(templates, solubility, activitySeries, applicabilityRules, reactions));
    setCount(c => c + 1);
  }, [templates, solubility, activitySeries, applicabilityRules, reactions]);

  useEffect(() => {
    if (!loading && !exercise && templates.length > 0) nextExercise();
  }, [loading, exercise, templates, nextExercise]);

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

  const mastered = COMPETENCY_IDS.every(id => (pLevels.get(id) ?? 0) >= 0.8);

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
          Отлично! Все компетенции на уровне «Уверенный» или выше.
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
