import { useState, useEffect, useCallback } from 'react';
import type { CompetencyId } from '../../types/competency';
import type { BktParams } from '../../types/bkt';
import type { OgeTask } from '../../types/oge-task';
import type { OgeSolutionAlgorithm } from '../../types/oge-solution';
import type { ExamSystem } from '../../types/exam-system';
import { getExamSystemName } from '../../types/exam-system';
import type { UnifiedTopic } from '../../types/topic-mapping';
import type { ExamVariant, ExamAnswer, ExamResults, ExamExerciseResult, CompetencyResult } from '../../types/exam';
import type { SupportedLocale } from '../../types/i18n';
import { bktUpdate } from '../../lib/bkt-engine';
import { loadBktState, saveBktPL } from '../../lib/storage';
import { localizeUrl } from '../../lib/i18n';
import * as m from '../../paraglide/messages.js';
import type { FormulaLookup } from '../../types/formula-lookup';
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
  loadExamSystems,
  loadExamSystemMeta,
  loadExamTasks,
  loadExamAlgorithms,
  loadTopicMapping,
  loadFormulaLookup,
} from '../../lib/data-loader';
import { FormulaLookupProvider } from '../../components/ChemText';
import { IonDetailsProvider } from '../../components/IonDetailsProvider';
import { generateVariant } from './generate-variant';
import type { ExamData } from './generate-variant';
import ExamSession from './ExamSession';
import ExamResultsView from './ExamResultsView';
import OgePractice from './OgePractice';
import TopicPractice from './TopicPractice';
import './exam.css';

type Phase = 'start' | 'loading' | 'session' | 'results' | 'oge-practice' | 'topic-practice';

/** Map locale to default exam system. */
const LOCALE_EXAM_MAP: Record<string, string> = {
  ru: 'oge',
  en: 'gcse',
  pl: 'egzamin',
  es: 'ebau',
};

interface ExamPageProps {
  locale?: SupportedLocale;
}

export default function ExamPage({ locale = 'ru' }: ExamPageProps) {
  const [phase, setPhase] = useState<Phase>('start');
  const [examSystems, setExamSystems] = useState<ExamSystem[] | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<string>(LOCALE_EXAM_MAP[locale] ?? 'oge');
  const [systemMeta, setSystemMeta] = useState<Record<string, unknown> | null>(null);
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [variant, setVariant] = useState<ExamVariant | null>(null);
  const [results, setResults] = useState<ExamResults | null>(null);
  const [bktParamsMap, setBktParamsMap] = useState<Map<string, BktParams>>(new Map());
  const [compNames, setCompNames] = useState<Map<string, string>>(new Map());
  const [ogeTasks, setOgeTasks] = useState<OgeTask[]>([]);
  const [algorithms, setAlgorithms] = useState<OgeSolutionAlgorithm[]>([]);
  const [practiceSystemId, setPracticeSystemId] = useState<string>('');
  const [topicMapping, setTopicMapping] = useState<UnifiedTopic[] | null>(null);
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load exam systems and formula lookup on mount
  useEffect(() => {
    loadExamSystems()
      .then(setExamSystems)
      .catch(() => { /* systems optional */ });
    loadFormulaLookup()
      .then(setFormulaLookup)
      .catch(() => { /* formula lookup optional */ });
  }, []);

  // Load meta when system changes
  useEffect(() => {
    if (selectedSystem === 'oge') {
      setSystemMeta(null);
      return;
    }
    loadExamSystemMeta(selectedSystem)
      .then(meta => setSystemMeta(meta as Record<string, unknown>))
      .catch(() => setSystemMeta(null));
  }, [selectedSystem]);

  const startPractice = useCallback(async (systemId: string) => {
    setPhase('loading');
    setError(null);
    try {
      if (ogeTasks.length === 0 || practiceSystemId !== systemId) {
        const [tasks, algos] = await Promise.all([
          systemId === 'oge'
            ? loadOgeTasks()
            : loadExamTasks(systemId),
          systemId === 'oge'
            ? loadOgeSolutionAlgorithms()
            : loadExamAlgorithms(systemId).catch(() => [] as OgeSolutionAlgorithm[]),
        ]);
        setOgeTasks(tasks);
        setAlgorithms(algos);
        setPracticeSystemId(systemId);
      }
      setPhase('oge-practice');
    } catch (e) {
      setError(e instanceof Error ? e.message : m.error_loading());
      setPhase('start');
    }
  }, [ogeTasks, practiceSystemId]);

  const startTopicPractice = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      if (!topicMapping) {
        const [topics, systems] = await Promise.all([
          loadTopicMapping(),
          examSystems ? Promise.resolve(examSystems) : loadExamSystems(),
        ]);
        setTopicMapping(topics);
        if (!examSystems) setExamSystems(systems);
      }
      setPhase('topic-practice');
    } catch (e) {
      setError(e instanceof Error ? e.message : m.error_loading());
      setPhase('start');
    }
  }, [topicMapping, examSystems]);

  /** On-demand loader for TopicPractice — fetches tasks+algorithms for a system. */
  const loadSystemTasksForTopic = useCallback(async (systemId: string) => {
    const [tasks, algos] = await Promise.all([
      systemId === 'oge'
        ? loadOgeTasks()
        : loadExamTasks(systemId),
      systemId === 'oge'
        ? loadOgeSolutionAlgorithms()
        : loadExamAlgorithms(systemId).catch(() => [] as OgeSolutionAlgorithm[]),
    ]);
    return { tasks, algorithms: algos };
  }, []);

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

  function handleSubmit(answers: ExamAnswer[], timeSpentSec: number) {
    if (!variant) return;

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

    const compMap = new Map<string, { total: number; correct: number }>();
    for (const er of exerciseResults) {
      for (const compId of Object.keys(er.competencyMap)) {
        const entry = compMap.get(compId) ?? { total: 0, correct: 0 };
        entry.total++;
        if (er.correct) entry.correct++;
        compMap.set(compId, entry);
      }
    }

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

    setResults({
      totalQuestions: variant.exercises.length,
      totalCorrect: exerciseResults.filter(e => e.correct).length,
      timeSpentSec,
      exercises: exerciseResults,
      competencies: competencyResults,
    });
    setPhase('results');
  }

  function handleRestart() {
    setVariant(null);
    setResults(null);
    setPhase('start');
  }

  const currentSystem = examSystems?.find(s => s.id === selectedSystem);

  if (phase === 'start') {
    return (
      <div className="exam-page">
        <h1 className="exam-page__title">{m.exam_title()}</h1>

        {/* Exam system selector */}
        {examSystems && examSystems.length > 1 && (
          <div className="exam-systems">
            <div className="exam-systems__tabs">
              {examSystems.map(sys => (
                <button
                  key={sys.id}
                  type="button"
                  className={`exam-systems__tab ${selectedSystem === sys.id ? 'exam-systems__tab--active' : ''}`}
                  onClick={() => setSelectedSystem(sys.id)}
                >
                  <span className="exam-systems__flag">{sys.flag}</span>
                  <span>{getExamSystemName(sys, locale)}</span>
                </button>
              ))}
            </div>
            <a
              href={localizeUrl('/exam/compare/', locale)}
              className="exam-systems__compare"
            >
              {m.exam_compare_formats()}
            </a>
          </div>
        )}

        <p className="exam-page__intro">
          {m.exam_intro()}
        </p>

        {error && (
          <div style={{ color: '#dc2626', marginBottom: 'var(--space-md)' }}>
            {error}
          </div>
        )}

        {/* Practice mode — available for all exam systems with tasks */}
        <div className="exam-modes">
          <div className="exam-mode-card">
            <h2 className="exam-mode-card__title">{m.exam_oge_title()}</h2>
            <p className="exam-mode-card__desc">
              {m.exam_oge_desc()}
            </p>
            {currentSystem && (
              <div className="exam-mode-card__info">
                <span>{m.exam_compare_minutes({ min: String(currentSystem.duration_min) })}</span>
                <span>{m.exam_compare_max_score()}: {currentSystem.max_score}</span>
              </div>
            )}
            <button type="button" className="btn btn-primary" onClick={() => startPractice(selectedSystem)}>
              {m.exam_practice()}
            </button>
          </div>

          {/* Mock exam only for OGE (generator-based) */}
          {selectedSystem === 'oge' && (
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
          )}

          {/* Topic practice — cross-exam practice grouped by chemistry topic */}
          <div className="exam-mode-card">
            <h2 className="exam-mode-card__title">{m.exam_topic_title()}</h2>
            <p className="exam-mode-card__desc">
              {m.exam_topic_desc()}
            </p>
            <button type="button" className="btn btn-primary" onClick={startTopicPractice}>
              {m.exam_practice()}
            </button>
          </div>
        </div>

        {/* Exam system info for non-OGE */}
        {selectedSystem !== 'oge' && currentSystem && systemMeta && (
          <div className="exam-system-info">
            {(systemMeta as Record<string, unknown>).topics && (
              <div className="exam-system-info__topics">
                <h3>{m.exam_compare_topics()}</h3>
                <ul>
                  {((systemMeta as Record<string, unknown>).topics as string[]).map((topic, i) => (
                    <li key={i}>{topic}</li>
                  ))}
                </ul>
              </div>
            )}
            {(systemMeta as Record<string, unknown>).official_links && (
              <div className="exam-system-info__links">
                <h3>{m.exam_official_links()}</h3>
                <ul>
                  {((systemMeta as Record<string, unknown>).official_links as Array<Record<string, string>>).map((link, i) => (
                    <li key={i}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {link[`label_${locale}`] ?? link.label_en ?? link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
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
      <FormulaLookupProvider value={formulaLookup}>
        <IonDetailsProvider locale={locale}>
          <div className="exam-page">
            <ExamSession variant={variant} onSubmit={handleSubmit} />
          </div>
        </IonDetailsProvider>
      </FormulaLookupProvider>
    );
  }

  if (phase === 'oge-practice') {
    return (
      <FormulaLookupProvider value={formulaLookup}>
        <IonDetailsProvider locale={locale}>
          <div className="exam-page">
            <OgePractice tasks={ogeTasks} algorithms={algorithms} onBack={() => setPhase('start')} />
          </div>
        </IonDetailsProvider>
      </FormulaLookupProvider>
    );
  }

  if (phase === 'topic-practice' && topicMapping && examSystems) {
    return (
      <FormulaLookupProvider value={formulaLookup}>
        <IonDetailsProvider locale={locale}>
          <div className="exam-page">
            <TopicPractice
              topics={topicMapping}
              examSystems={examSystems}
              loadSystemTasks={loadSystemTasksForTopic}
              locale={locale}
              onBack={() => setPhase('start')}
            />
          </div>
        </IonDetailsProvider>
      </FormulaLookupProvider>
    );
  }

  if (phase === 'results' && results) {
    return (
      <FormulaLookupProvider value={formulaLookup}>
        <IonDetailsProvider locale={locale}>
          <div className="exam-page">
            <h1 className="exam-page__title">{m.exam_results_title()}</h1>
            <ExamResultsView results={results} onRestart={handleRestart} />
          </div>
        </IonDetailsProvider>
      </FormulaLookupProvider>
    );
  }

  return null;
}
