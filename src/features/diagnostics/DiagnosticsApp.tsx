import { useState, useEffect } from 'react';
import type { DiagnosticQuestion } from '../../types/diagnostic';
import type { BktParams } from '../../types/bkt';
import type { CompetencyId } from '../../types/competency';
import { loadDiagnosticQuestions, loadBktParams } from '../../lib/data-loader';
import { bktUpdate } from '../../lib/bkt-engine';
import { hasDiagnosticsResult, saveBktState, clearBktState } from '../../lib/storage';
import ProgressBar from './ProgressBar';
import QuestionCard from './QuestionCard';
import ResultsSummary from './ResultsSummary';
import './diagnostics.css';

type Phase = 'loading' | 'error' | 'intro' | 'quiz' | 'results';

interface Answer {
  competencyId: CompetencyId;
  correct: boolean;
}

export default function DiagnosticsApp() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [paramsMap, setParamsMap] = useState<Map<CompetencyId, BktParams>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [results, setResults] = useState<Map<CompetencyId, number>>(new Map());
  const [hasExisting, setHasExisting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [qs, params] = await Promise.all([
          loadDiagnosticQuestions(),
          loadBktParams(),
        ]);

        if (cancelled) return;

        const map = new Map<CompetencyId, BktParams>();
        for (const p of params) {
          map.set(p.competency_id, p);
        }

        setQuestions(qs);
        setParamsMap(map);
        setHasExisting(hasDiagnosticsResult());
        setPhase('intro');
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Ошибка загрузки данных');
        setPhase('error');
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  function startQuiz() {
    clearBktState();
    setCurrentIndex(0);
    setAnswers([]);
    setPhase('quiz');
  }

  function handleAnswer(correct: boolean) {
    const question = questions[currentIndex];
    const newAnswers = [...answers, { competencyId: question.competency_id, correct }];
    setAnswers(newAnswers);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishQuiz(newAnswers);
    }
  }

  function finishQuiz(allAnswers: Answer[]) {
    const state = new Map<CompetencyId, number>();

    // Initialize with P_L0
    for (const [id, params] of paramsMap) {
      state.set(id, params.P_L0);
    }

    // Apply BKT update for each answer
    for (const answer of allAnswers) {
      const params = paramsMap.get(answer.competencyId);
      if (!params) continue;
      const currentPL = state.get(answer.competencyId) ?? params.P_L0;
      const newPL = bktUpdate(currentPL, params, answer.correct, false);
      state.set(answer.competencyId, newPL);
    }

    saveBktState(state);
    setResults(state);
    setPhase('results');
  }

  if (phase === 'loading') {
    return <div className="diag"><p className="diag-loading">Загрузка...</p></div>;
  }

  if (phase === 'error') {
    return <div className="diag"><p className="diag-error">{errorMsg}</p></div>;
  }

  if (phase === 'intro') {
    return (
      <div className="diag">
        <div className="diag-intro">
          <h1 className="diag-intro__title">Диагностика</h1>
          <p className="diag-intro__desc">
            12 вопросов по ключевым темам химии ОГЭ. Тест займёт около 15 минут
            и определит ваш уровень по каждой компетенции.
          </p>
          <div className="diag-intro__actions">
            <button type="button" className="btn btn-primary" onClick={startQuiz}>
              {hasExisting ? 'Пройти заново' : 'Начать'}
            </button>
            {hasExisting && (
              <a href="/profile/" className="diag-intro__retake">
                Посмотреть текущий профиль
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'quiz') {
    return (
      <div className="diag">
        <ProgressBar current={currentIndex + 1} total={questions.length} />
        <QuestionCard
          key={questions[currentIndex].id}
          question={questions[currentIndex]}
          onAnswer={handleAnswer}
        />
      </div>
    );
  }

  return (
    <div className="diag">
      <ResultsSummary results={results} />
    </div>
  );
}
