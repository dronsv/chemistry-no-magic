import { useState } from 'react';
import * as m from '../../../paraglide/messages.js';
import type { Exercise } from '../../competency/exercise-adapters';

interface Props {
  exercise: Exercise;
  onAnswer: (correct: boolean) => void;
}

export default function OrderItemsExercise({ exercise, onAnswer }: Props) {
  const items = exercise.items ?? [];
  const correctOrder = exercise.correctOrder ?? [];

  const [placed, setPlaced] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  const isCorrect = placed.length === correctOrder.length
    && placed.every((v, i) => v === correctOrder[i]);

  const remaining = items.filter(item => !placed.includes(item));

  function handlePick(item: string) {
    if (revealed) return;
    const next = [...placed, item];
    setPlaced(next);
    if (next.length === items.length) {
      setRevealed(true);
    }
  }

  function handleUndo() {
    if (revealed || placed.length === 0) return;
    setPlaced(placed.slice(0, -1));
  }

  function slotClass(index: number): string {
    const base = 'order-slot';
    if (!revealed) return base;
    return placed[index] === correctOrder[index]
      ? `${base} ${base}--correct`
      : `${base} ${base}--wrong`;
  }

  return (
    <div className="practice-order">
      <p className="practice-mc__question">{exercise.question}</p>

      {/* Placed slots */}
      <div className="order-slots">
        {items.map((_, i) => (
          <div key={i} className={slotClass(i)}>
            <span className="order-slot__number">{i + 1}</span>
            <span className="order-slot__value">{placed[i] ?? ''}</span>
          </div>
        ))}
      </div>

      {/* Available items to pick from */}
      {!revealed && (
        <div className="order-picks">
          {remaining.map(item => (
            <button
              key={item}
              type="button"
              className="practice-option"
              onClick={() => handlePick(item)}
            >
              {item}
            </button>
          ))}
          {placed.length > 0 && (
            <button
              type="button"
              className="order-undo"
              onClick={handleUndo}
            >
              ←
            </button>
          )}
        </div>
      )}

      {/* Correct order on wrong answer */}
      {revealed && !isCorrect && (
        <div className="order-correct-answer">
          {correctOrder.join(' → ')}
        </div>
      )}

      {revealed && (
        <>
          <div className={`practice-feedback practice-feedback--${isCorrect ? 'correct' : 'wrong'}`}>
            <span className="practice-feedback__label">
              {isCorrect ? m.correct() : m.wrong()}
            </span>
            {exercise.explanation}
          </div>
          <button
            type="button"
            className="btn btn-primary practice-next"
            onClick={() => onAnswer(isCorrect)}
          >
            {m.practice_next_task()}
          </button>
        </>
      )}
    </div>
  );
}
