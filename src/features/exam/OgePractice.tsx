import { useState, useCallback, useMemo } from 'react';
import type { OgeTask } from '../../types/oge-task';
import type { OgeSolutionAlgorithm } from '../../types/oge-solution';
import OgeAnswerRouter from './answers/OgeAnswerRouter';
import { gradeOgeTask } from './oge-scoring';

interface Props {
  tasks: OgeTask[];
  algorithms: OgeSolutionAlgorithm[];
  onBack: () => void;
}

type Phase = 'select' | 'solve' | 'review';

const DIFFICULTY_LABEL: Record<string, string> = {
  'Б': 'базовый',
  'П': 'повышенный',
  'В': 'высокий',
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
            Назад
          </button>
          <h2 className="oge-practice__title">Задания ОГЭ по номерам</h2>
        </div>
        <p className="oge-practice__intro">
          Выберите номер задания для тренировки. Формат ввода ответа совпадает с реальным экзаменом.
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
                  {DIFFICULTY_LABEL[sample.difficulty] ?? sample.difficulty}
                </span>
                <span className="oge-practice__count">
                  {group.length} {group.length === 1 ? 'вариант' : group.length < 5 ? 'варианта' : 'вариантов'}
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
          К списку заданий
        </button>
        <span className="oge-practice__task-info">
          Задание {currentTask.task_number} ({currentTask.year}, {currentTask.source === 'demo' ? 'демо' : 'реальный'})
        </span>
      </div>

      <div className="oge-task">
        {currentTask.context_ru && (
          <div className="oge-task__context">{currentTask.context_ru}</div>
        )}
        <div className="oge-task__question">
          <span className="oge-task__number">Задание {currentTask.task_number}</span>
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
              Проверить
            </button>
            {algo && (
              <button
                type="button"
                className="btn"
                onClick={() => setShowAlgorithm(v => !v)}
              >
                {showAlgorithm ? 'Скрыть подсказку' : 'Подсказка'}
              </button>
            )}
          </div>
        )}

        {phase === 'solve' && showAlgorithm && algo && (
          <div className="oge-task__algorithm">
            <h4 className="oge-task__algorithm-title">Алгоритм решения</h4>
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
              {gradeResult.score} / {gradeResult.maxScore} {gradeResult.maxScore === 1 ? 'балл' : 'балла'}
            </div>
            <div className="oge-task__explanation">
              {currentTask.explanation_ru}
            </div>

            {algo && (
              <details className="oge-task__algo-details">
                <summary>Алгоритм решения задания {currentTask.task_number}</summary>
                <div className="oge-task__algo-content">
                  <h4>{algo.title_ru}</h4>
                  <ol className="oge-task__algorithm-steps">
                    {algo.algorithm_ru.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>

                  <h4>Ключевые факты</h4>
                  <ul>
                    {algo.key_facts_ru.map((fact, i) => (
                      <li key={i}>{fact}</li>
                    ))}
                  </ul>

                  <h4>Типичные ловушки</h4>
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
                Следующий вариант
              </button>
              <button type="button" className="btn" onClick={handleBackToSelect}>
                Другое задание
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
