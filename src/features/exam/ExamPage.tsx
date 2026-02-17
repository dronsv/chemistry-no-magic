import { useState, useEffect, useCallback } from 'react';
import type { CompetencyId } from '../../types/competency';
import type { BktParams } from '../../types/bkt';
import type { ExamVariant, ExamAnswer, ExamResults, ExamExerciseResult, CompetencyResult } from '../../types/exam';
import { bktUpdate } from '../../lib/bkt-engine';
import { loadBktState, saveBktPL } from '../../lib/storage';
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
} from '../../lib/data-loader';
import { generateVariant } from './generate-variant';
import type { ExamData } from './generate-variant';
import ExamSession from './ExamSession';
import ExamResultsView from './ExamResultsView';
import './exam.css';

type Phase = 'start' | 'loading' | 'session' | 'results';

export default function ExamPage() {
  const [phase, setPhase] = useState<Phase>('start');
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [variant, setVariant] = useState<ExamVariant | null>(null);
  const [results, setResults] = useState<ExamResults | null>(null);
  const [bktParamsMap, setBktParamsMap] = useState<Map<string, BktParams>>(new Map());
  const [compNames, setCompNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

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
      setError(e instanceof Error ? e.message : 'Ошибка загрузки данных');
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
        <h1 className="exam-page__title">Экзамен</h1>
        <p className="exam-page__intro">
          Пробный вариант ОГЭ по химии. 20 заданий по всем компетенциям, без подсказок и немедленной проверки — как на настоящем экзамене.
        </p>
        <div className="exam-start">
          <div className="exam-start__info">
            <div className="exam-start__row">
              <span>Количество заданий</span>
              <strong>20</strong>
            </div>
            <div className="exam-start__row">
              <span>Время</span>
              <strong>2 часа</strong>
            </div>
            <div className="exam-start__row">
              <span>Формат</span>
              <strong>Тест с выбором ответа</strong>
            </div>
            <div className="exam-start__row">
              <span>Обратная связь</span>
              <strong>После завершения</strong>
            </div>
          </div>
          {error && (
            <div style={{ color: '#dc2626', marginBottom: 'var(--space-md)' }}>
              {error}
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={startExam}>
            Начать экзамен
          </button>
          <p className="exam-start__note">
            Результаты обновят ваш профиль компетенций. Вы можете свободно перемещаться между заданиями и менять ответы до завершения.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="exam-page">
        <h1 className="exam-page__title">Экзамен</h1>
        <div className="exam-start">
          <p>Загрузка данных и генерация варианта...</p>
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

  if (phase === 'results' && results) {
    return (
      <div className="exam-page">
        <h1 className="exam-page__title">Результаты экзамена</h1>
        <ExamResultsView results={results} onRestart={handleRestart} />
      </div>
    );
  }

  return null;
}
