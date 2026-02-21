import { useState, useEffect, useCallback } from 'react';
import type { CompetencyId } from '../../types/competency';
import type { BktParams } from '../../types/bkt';
import type { OgeTask } from '../../types/oge-task';
import type { OgeSolutionAlgorithm } from '../../types/oge-solution';
import type { ExamVariant, ExamAnswer, ExamResults, ExamExerciseResult, CompetencyResult } from '../../types/exam';
import { bktUpdate } from '../../lib/bkt-engine';
import { loadBktState, saveBktPL } from '../../lib/storage';
import * as m from '../../paraglide/messages.js';
import {
  loadElements,
  loadSubstancesIndex,
  loadClassificationRules,
  loadNamingRules,
  loadReactionTemplates,
  loadSolubilityRules,
  loadActivitySeries,
  loadApplicabilityRules,
  loadReactions,
  loadQualitativeTests,
  loadGeneticChains,
  loadEnergyCatalystTheory,
  loadCalculationsData,
  loadBktParams,
  loadCompetencies,
  loadOgeTasks,
  loadOgeSolutionAlgorithms,
} from '../../lib/data-loader';
import { generateVariant } from './generate-variant';
import type { ExamData } from './generate-variant';
import ExamSession from './ExamSession';
import ExamResultsView from './ExamResultsView';
import OgePractice from './OgePractice';
import './exam.css';

type Phase = 'start' | 'loading' | 'session' | 'results' | 'oge-practice';

export default function ExamPage() {
  const [phase, setPhase] = useState<Phase>('start');
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [variant, setVariant] = useState<ExamVariant | null>(null);
  const [results, setResults] = useState<ExamResults | null>(null);
  const [bktParamsMap, setBktParamsMap] = useState<Map<string, BktParams>>(new Map());
  const [compNames, setCompNames] = useState<Map<string, string>>(new Map());
  const [ogeTasks, setOgeTasks] = useState<OgeTask[]>([]);
  const [algorithms, setAlgorithms] = useState<OgeSolutionAlgorithm[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startOgePractice = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      if (ogeTasks.length === 0) {
        const [tasks, algos] = await Promise.all([
          loadOgeTasks(),
          loadOgeSolutionAlgorithms(),
        ]);
        setOgeTasks(tasks);
        setAlgorithms(algos);
      }
      setPhase('oge-practice');
    } catch (e) {
      setError(e instanceof Error ? e.message : m.error_loading());
      setPhase('start');
    }
  }, [ogeTasks]);

  const startExam = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      let data = examData;

      if (!data) {
        const [
          elements, substances, classRules, nameRules,
          reactionTemplates, solubility, activitySeries, appRules,
          reactions, qualTests, chains, energyTheory,
          calcData, params, comps,
        ] = await Promise.all([
          loadElements(),
          loadSubstancesIndex(),
          loadClassificationRules(),
          loadNamingRules(),
          loadReactionTemplates(),
          loadSolubilityRules(),
          loadActivitySeries(),
          loadApplicabilityRules(),
          loadReactions(),
          loadQualitativeTests(),
          loadGeneticChains(),
          loadEnergyCatalystTheory(),
          loadCalculationsData(),
          loadBktParams(),
          loadCompetencies(),
        ]);

        data = {
          elements,
          substances,
          classificationRules: classRules,
          namingRules: nameRules,
          reactionTemplates,
          solubility,
          activitySeries,
          applicabilityRules: appRules,
          reactions,
          qualitativeTests: qualTests,
          geneticChains: chains,
          energyCatalystTheory: energyTheory,
          calculationsData: calcData,
        };
        setExamData(data);

        const pm = new Map<string, BktParams>();
        for (const p of params) pm.set(p.competency_id, p);
        setBktParamsMap(pm);

        const nm = new Map<string, string>();
        for (const c of comps) nm.set(c.id, c.name_ru);
        setCompNames(nm);
      }

      const v = generateVariant(data);
      setVariant(v);
      setPhase('session');
    } catch (e) {
      setError(e instanceof Error ? e.message : m.error_loading());
      setPhase('start');
    }
  }, [examData]);

  // Preload data on mount
  useEffect(() => {
    // Don't preload if already loaded
    if (examData) return;
  }, [examData]);

  function handleSubmit(answers: ExamAnswer[], timeSpentSec: number) {
    if (!variant) return;

    // Grade exercises
    const exerciseResults: ExamExerciseResult[] = variant.exercises.map(ex => {
      const answer = answers.find(a => a.index === ex.index);
      const selectedId = answer?.selectedId ?? null;
      return {
        index: ex.index,
        question: ex.question,
        selectedId,
        correctId: ex.correctId,
        correct: selectedId === ex.correctId,
        explanation: ex.explanation,
        competencyMap: ex.competencyMap,
      };
    });

    // Aggregate per competency
    const compMap = new Map<string, { total: number; correct: number }>();
    for (const er of exerciseResults) {
      for (const compId of Object.keys(er.competencyMap)) {
        const entry = compMap.get(compId) ?? { total: 0, correct: 0 };
        entry.total++;
        if (er.correct) entry.correct++;
        compMap.set(compId, entry);
      }
    }

    // Update BKT
    const pLevels = loadBktState();
    for (const er of exerciseResults) {
      for (const [compId, weight] of Object.entries(er.competencyMap)) {
        const params = bktParamsMap.get(compId);
        if (!params) continue;
        const currentPL = pLevels.get(compId) ?? params.P_L0;
        const isPrimary = weight === 'P';
        const updatedPL = isPrimary
          ? bktUpdate(currentPL, params, er.correct, false)
          : bktUpdate(currentPL, params, er.correct, true);
        pLevels.set(compId, updatedPL);
        saveBktPL(compId as CompetencyId, updatedPL);
      }
    }

    // Build competency results sorted by score
    const competencyResults: CompetencyResult[] = [];
    for (const [compId, stats] of compMap) {
      competencyResults.push({
        competencyId: compId,
        name_ru: compNames.get(compId) ?? compId,
        total: stats.total,
        correct: stats.correct,
        pL: pLevels.get(compId) ?? 0,
      });
    }
    competencyResults.sort((a, b) => (a.correct / a.total) - (b.correct / b.total));

    const examResults: ExamResults = {
      totalQuestions: variant.exercises.length,
      totalCorrect: exerciseResults.filter(e => e.correct).length,
      timeSpentSec,
      exercises: exerciseResults,
      competencies: competencyResults,
    };

    setResults(examResults);
    setPhase('results');
  }

  function handleRestart() {
    setVariant(null);
    setResults(null);
    setPhase('start');
  }

  if (phase === 'start') {
    return (
      <div className="exam-page">
        <h1 className="exam-page__title">{m.exam_title()}</h1>
        <p className="exam-page__intro">
          {m.exam_intro()}
        </p>

        {error && (
          <div style={{ color: '#dc2626', marginBottom: 'var(--space-md)' }}>
            {error}
          </div>
        )}

        <div className="exam-modes">
          <div className="exam-mode-card">
            <h2 className="exam-mode-card__title">{m.exam_oge_title()}</h2>
            <p className="exam-mode-card__desc">
              {m.exam_oge_desc()}
            </p>
            <div className="exam-mode-card__info">
              <span>{m.exam_oge_info_1()}</span>
              <span>{m.exam_oge_info_2()}</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={startOgePractice}>
              {m.exam_practice()}
            </button>
          </div>

          <div className="exam-mode-card">
            <h2 className="exam-mode-card__title">{m.exam_mock_title()}</h2>
            <p className="exam-mode-card__desc">
              {m.exam_mock_desc()}
            </p>
            <div className="exam-mode-card__info">
              <span>{m.exam_mock_info_1()}</span>
              <span>{m.exam_mock_info_2()}</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={startExam}>
              {m.exam_start()}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="exam-page">
        <h1 className="exam-page__title">{m.exam_title()}</h1>
        <div className="exam-start">
          <p>{m.exam_loading()}</p>
        </div>
      </div>
    );
  }

  if (phase === 'session' && variant) {
    return (
      <div className="exam-page">
        <ExamSession variant={variant} onSubmit={handleSubmit} />
      </div>
    );
  }

  if (phase === 'oge-practice') {
    return (
      <div className="exam-page">
        <OgePractice tasks={ogeTasks} algorithms={algorithms} onBack={() => setPhase('start')} />
      </div>
    );
  }

  if (phase === 'results' && results) {
    return (
      <div className="exam-page">
        <h1 className="exam-page__title">{m.exam_results_title()}</h1>
        <ExamResultsView results={results} onRestart={handleRestart} />
      </div>
    );
  }

  return null;
}
