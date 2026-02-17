import { useState } from 'react';
import type { ExamResults } from '../../types/exam';

interface Props {
  results: ExamResults;
  onRestart: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} мин ${s} сек`;
}

function scoreClass(ratio: number): string {
  if (ratio >= 0.7) return 'good';
  if (ratio >= 0.4) return 'medium';
  return 'low';
}

export default function ExamResultsView({ results, onRestart }: Props) {
  const [showAll, setShowAll] = useState(false);
  const ratio = results.totalCorrect / results.totalQuestions;
  const percent = Math.round(ratio * 100);

  // Split competencies into weak and strong
  const weak = results.competencies.filter(c => c.correct / c.total < 0.6);
  const strong = results.competencies.filter(c => c.correct / c.total >= 0.6);

  // Exercises to review: wrong and skipped first
  const wrongExercises = results.exercises.filter(e => !e.correct);
  const correctExercises = results.exercises.filter(e => e.correct);
  const exercisesToShow = showAll
    ? results.exercises
    : wrongExercises;

  return (
    <div className="exam-results">
      {/* Summary card */}
      <div className="exam-results__summary">
        <div className={`exam-results__score exam-results__score--${scoreClass(ratio)}`}>
          {results.totalCorrect} / {results.totalQuestions}
        </div>
        <div className="exam-results__details">
          {percent}% правильных ответов за {formatTime(results.timeSpentSec)}
        </div>
      </div>

      {/* Weak competencies */}
      {weak.length > 0 && (
        <div className="exam-results__competencies">
          <h3 className="exam-results__comp-title">Что подтянуть</h3>
          {weak.map(c => {
            const r = c.total > 0 ? c.correct / c.total : 0;
            return (
              <div key={c.competencyId} className="exam-comp">
                <span className="exam-comp__name">{c.name_ru}</span>
                <span className="exam-comp__score">{c.correct}/{c.total}</span>
                <div className="exam-comp__bar">
                  <div
                    className={`exam-comp__fill exam-comp__fill--${scoreClass(r)}`}
                    style={{ width: `${Math.round(r * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Strong competencies */}
      {strong.length > 0 && (
        <div className="exam-results__competencies">
          <h3 className="exam-results__comp-title">Сильные стороны</h3>
          {strong.map(c => {
            const r = c.total > 0 ? c.correct / c.total : 0;
            return (
              <div key={c.competencyId} className="exam-comp">
                <span className="exam-comp__name">{c.name_ru}</span>
                <span className="exam-comp__score">{c.correct}/{c.total}</span>
                <div className="exam-comp__bar">
                  <div
                    className={`exam-comp__fill exam-comp__fill--${scoreClass(r)}`}
                    style={{ width: `${Math.round(r * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exercise review */}
      <div>
        <h3 className="exam-results__exercises-title">
          {showAll ? 'Все задания' : `Ошибки (${wrongExercises.length})`}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {exercisesToShow.map(e => {
            let cls = 'exam-review';
            let badge = '';
            let badgeCls = '';
            if (e.selectedId === null) {
              cls += ' exam-review--skipped';
              badge = 'Пропущено';
              badgeCls = 'exam-review__badge--skipped';
            } else if (e.correct) {
              cls += ' exam-review--correct';
              badge = 'Верно';
              badgeCls = 'exam-review__badge--correct';
            } else {
              cls += ' exam-review--wrong';
              badge = 'Неверно';
              badgeCls = 'exam-review__badge--wrong';
            }

            return (
              <div key={e.index} className={cls}>
                <div className="exam-review__header">
                  <span className="exam-review__number">#{e.index + 1}</span>
                  <span className={`exam-review__badge ${badgeCls}`}>{badge}</span>
                </div>
                <p className="exam-review__question">{e.question}</p>
                <div className="exam-review__explanation">{e.explanation}</div>
              </div>
            );
          })}
        </div>

        {!showAll && correctExercises.length > 0 && (
          <button
            type="button"
            className="btn"
            style={{ marginTop: 'var(--space-sm)' }}
            onClick={() => setShowAll(true)}
          >
            Показать все задания ({results.exercises.length})
          </button>
        )}
      </div>

      {/* Restart */}
      <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          Пройти ещё раз
        </button>
      </div>
    </div>
  );
}
