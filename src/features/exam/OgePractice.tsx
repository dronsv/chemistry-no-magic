import { useState, useCallback, useMemo } from 'react';
import type { OgeTask } from '../../types/oge-task';
import type { OgeSolutionAlgorithm } from '../../types/oge-solution';
import * as m from '../../paraglide/messages.js';
import OgeAnswerRouter from './answers/OgeAnswerRouter';
import { gradeOgeTask } from './oge-scoring';

interface Props {
  tasks: OgeTask[];
  algorithms: OgeSolutionAlgorithm[];
  onBack: () => void;
}

type Phase = 'select' | 'solve' | 'review';

const DIFFICULTY_LABEL: Record<string, () => string> = {
  'Б': m.oge_diff_basic,
  'П': m.oge_diff_advanced,
  'В': m.oge_diff_high,
};

/** Group tasks by task_number. */
function groupByNumber(tasks: OgeTask[]): Map<number, OgeTask[]> {
  const map = new Map<number, OgeTask[]>();
  for (const t of tasks) {
    const arr = map.get(t.task_number) ?? [];
    arr.push(t);
    map.set(t.task_number, arr);
  }
  return map;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function OgePractice({ tasks, algorithms, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [currentTask, setCurrentTask] = useState<OgeTask | null>(null);
  const [answer, setAnswer] = useState('');
  const [gradeResult, setGradeResult] = useState<{ score: number; maxScore: number } | null>(null);
  const [showAlgorithm, setShowAlgorithm] = useState(false);

  const grouped = groupByNumber(tasks);
  const taskNumbers = Array.from(grouped.keys()).sort((a, b) => a - b);

  const algoMap = useMemo(() => {
    const m = new Map<number, OgeSolutionAlgorithm>();
    for (const a of algorithms) m.set(a.task_number, a);
    return m;
  }, [algorithms]);

  const pickTask = useCallback((num: number) => {
    const available = grouped.get(num);
    if (!available || available.length === 0) return;
    setCurrentTask(pick(available));
    setAnswer('');
    setGradeResult(null);
    setShowAlgorithm(false);
    setPhase('solve');
  }, [grouped]);

  const handleCheck = useCallback(() => {
    if (!currentTask || !answer) return;
    const result = gradeOgeTask(currentTask, answer);
    setGradeResult(result);
    setPhase('review');
  }, [currentTask, answer]);

  const handleNext = useCallback(() => {
    if (!currentTask) return;
    pickTask(currentTask.task_number);
  }, [currentTask, pickTask]);

  const handleBackToSelect = useCallback(() => {
    setCurrentTask(null);
    setAnswer('');
    setGradeResult(null);
    setShowAlgorithm(false);
    setPhase('select');
  }, []);

  if (phase === 'select') {
    return (
      <div className="oge-practice">
        <div className="oge-practice__header">
          <button type="button" className="btn" onClick={onBack}>
            {m.back()}
          </button>
          <h2 className="oge-practice__title">{m.oge_title()}</h2>
        </div>
        <p className="oge-practice__intro">
          {m.oge_intro()}
        </p>
        <div className="oge-practice__grid">
          {taskNumbers.map(num => {
            const group = grouped.get(num)!;
            const sample = group[0];
            return (
              <button
                key={num}
                type="button"
                className="oge-practice__card"
                onClick={() => pickTask(num)}
              >
                <span className="oge-practice__num">{num}</span>
                <span className={`oge-practice__diff oge-practice__diff--${sample.difficulty}`}>
                  {DIFFICULTY_LABEL[sample.difficulty]?.() ?? sample.difficulty}
                </span>
                <span className="oge-practice__count">
                  {group.length} {group.length === 1 ? m.oge_variant_one() : group.length < 5 ? m.oge_variant_few() : m.oge_variant_many()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!currentTask) return null;

  const algo = algoMap.get(currentTask.task_number);

  return (
    <div className="oge-practice">
      <div className="oge-practice__header">
        <button type="button" className="btn" onClick={handleBackToSelect}>
          {m.oge_to_list()}
        </button>
        <span className="oge-practice__task-info">
          {m.oge_task_info({ number: String(currentTask.task_number), year: String(currentTask.year), source: currentTask.source === 'demo' ? m.oge_source_demo() : m.oge_source_real() })}
        </span>
      </div>

      <div className="oge-task">
        {currentTask.context_ru && (
          <div className="oge-task__context">{currentTask.context_ru}</div>
        )}
        <div className="oge-task__question">
          <span className="oge-task__number">{m.exam_task_number({ number: String(currentTask.task_number) })}</span>
          <p className="oge-task__text">{currentTask.question_ru}</p>
        </div>

        <div className="oge-task__answer">
          <OgeAnswerRouter
            task={currentTask}
            value={answer}
            onChange={setAnswer}
            disabled={phase === 'review'}
            showCorrect={phase === 'review'}
          />
        </div>

        {phase === 'solve' && (
          <div className="oge-task__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCheck}
              disabled={!answer}
            >
              {m.oge_check()}
            </button>
            {algo && (
              <button
                type="button"
                className="btn"
                onClick={() => setShowAlgorithm(v => !v)}
              >
                {showAlgorithm ? m.oge_hide_hint() : m.oge_hint()}
              </button>
            )}
          </div>
        )}

        {phase === 'solve' && showAlgorithm && algo && (
          <div className="oge-task__algorithm">
            <h4 className="oge-task__algorithm-title">{m.oge_algorithm_title()}</h4>
            <ol className="oge-task__algorithm-steps">
              {algo.algorithm_ru.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {phase === 'review' && gradeResult && (
          <div className="oge-task__result">
            <div className={`oge-task__score oge-task__score--${gradeResult.score === gradeResult.maxScore ? 'full' : gradeResult.score > 0 ? 'partial' : 'zero'}`}>
              {gradeResult.score} / {gradeResult.maxScore} {gradeResult.maxScore === 1 ? m.oge_score_unit_1() : m.oge_score_unit_2()}
            </div>
            <div className="oge-task__explanation">
              {currentTask.explanation_ru}
            </div>

            {algo && (
              <details className="oge-task__algo-details">
                <summary>{m.oge_algorithm_summary({ number: String(currentTask.task_number) })}</summary>
                <div className="oge-task__algo-content">
                  <h4>{algo.title_ru}</h4>
                  <ol className="oge-task__algorithm-steps">
                    {algo.algorithm_ru.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>

                  <h4>{m.oge_key_facts()}</h4>
                  <ul>
                    {algo.key_facts_ru.map((fact, i) => (
                      <li key={i}>{fact}</li>
                    ))}
                  </ul>

                  <h4>{m.oge_common_traps()}</h4>
                  <ul className="oge-task__traps">
                    {algo.common_traps_ru.map((trap, i) => (
                      <li key={i}>{trap}</li>
                    ))}
                  </ul>
                </div>
              </details>
            )}

            <div className="oge-task__actions">
              <button type="button" className="btn btn-primary" onClick={handleNext}>
                {m.oge_next_variant()}
              </button>
              <button type="button" className="btn" onClick={handleBackToSelect}>
                {m.oge_other_task()}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
