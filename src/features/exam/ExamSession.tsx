import { useState, useEffect, useRef, useCallback } from 'react';
import type { ExamVariant, ExamAnswer } from '../../types/exam';
import ChemText from '../../components/ChemText';
import * as m from '../../paraglide/messages.js';

interface Props {
  variant: ExamVariant;
  onSubmit: (answers: ExamAnswer[], timeSpentSec: number) => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ExamSession({ variant, onSubmit }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Map<number, string>>(() => new Map());
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(sec);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Auto-submit when time runs out
  useEffect(() => {
    if (elapsed >= variant.timeLimitSec) {
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const handleSubmit = useCallback(() => {
    clearInterval(timerRef.current);
    const timeSpent = Math.floor((Date.now() - startRef.current) / 1000);
    const result: ExamAnswer[] = variant.exercises.map((_, i) => ({
      index: i,
      selectedId: answers.get(i) ?? null,
    }));
    onSubmit(result, timeSpent);
  }, [answers, variant.exercises, onSubmit]);

  const remaining = Math.max(0, variant.timeLimitSec - elapsed);
  const isWarning = remaining <= 300; // 5 minutes
  const exercise = variant.exercises[currentIdx];
  const total = variant.exercises.length;
  const answeredCount = answers.size;

  function selectOption(id: string) {
    setAnswers(prev => {
      const next = new Map(prev);
      if (next.get(currentIdx) === id) {
        next.delete(currentIdx); // deselect
      } else {
        next.set(currentIdx, id);
      }
      return next;
    });
  }

  function goTo(idx: number) {
    if (idx >= 0 && idx < total) setCurrentIdx(idx);
  }

  return (
    <div className="exam-session">
      {/* Header with progress and timer */}
      <div className="exam-header">
        <span className="exam-header__progress">
          {m.exam_question_progress({ current: String(currentIdx + 1), total: String(total), answered: String(answeredCount) })}
        </span>
        <span className={`exam-header__timer${isWarning ? ' exam-header__timer--warning' : ''}`}>
          {formatTime(remaining)}
        </span>
      </div>

      {/* Current question */}
      <div className="exam-question">
        <div className="exam-question__number">{m.exam_task_number({ number: String(currentIdx + 1) })}</div>
        <p className="exam-question__text"><ChemText text={exercise.question} /></p>
        <div className="exam-question__options">
          {exercise.options.map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`exam-option${answers.get(currentIdx) === opt.id ? ' exam-option--selected' : ''}`}
              onClick={() => selectOption(opt.id)}
            >
              <ChemText text={opt.text} />
            </button>
          ))}
        </div>
      </div>

      {/* Navigation dots */}
      <div className="exam-nav">
        {variant.exercises.map((_, i) => {
          let cls = 'exam-nav__dot';
          if (i === currentIdx) cls += ' exam-nav__dot--current';
          else if (answers.has(i)) cls += ' exam-nav__dot--answered';
          return (
            <button
              key={i}
              type="button"
              className={cls}
              onClick={() => goTo(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="exam-actions">
        <button
          type="button"
          className="btn exam-actions__prev"
          onClick={() => goTo(currentIdx - 1)}
          disabled={currentIdx === 0}
        >
          {m.back()}
        </button>
        {currentIdx < total - 1 ? (
          <button
            type="button"
            className="btn btn-primary exam-actions__next"
            onClick={() => goTo(currentIdx + 1)}
          >
            {m.next()}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary exam-actions__submit"
            onClick={handleSubmit}
          >
            {m.exam_finish({ answered: String(answeredCount), total: String(total) })}
          </button>
        )}
        {currentIdx < total - 1 && (
          <button
            type="button"
            className="btn exam-actions__submit"
            onClick={handleSubmit}
          >
            {m.exam_finish_short()}
          </button>
        )}
      </div>
    </div>
  );
}
