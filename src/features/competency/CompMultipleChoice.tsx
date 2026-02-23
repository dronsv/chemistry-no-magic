import { useState } from 'react';
import type { Exercise } from './exercise-adapters';
import * as m from '../../paraglide/messages.js';

interface Props {
  exercise: Exercise;
  onAnswer: (correct: boolean) => void;
}

export default function CompMultipleChoice({ exercise, onAnswer }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const isCorrect = selected === exercise.correctId;

  function handleSelect(id: string) {
    if (revealed) return;
    setSelected(id);
    setRevealed(true);
  }

  function optionClass(id: string): string {
    const base = 'practice-option';
    if (!revealed) return base;
    if (id === exercise.correctId) {
      return id === selected ? `${base} ${base}--correct` : `${base} ${base}--missed`;
    }
    if (id === selected) return `${base} ${base}--wrong`;
    return base;
  }

  return (
    <div className="comp-practice__mc">
      <p className="comp-practice__question">{exercise.question}</p>
      <div className="comp-practice__options">
        {exercise.options.map(opt => (
          <button
            key={opt.id}
            type="button"
            className={optionClass(opt.id)}
            onClick={() => handleSelect(opt.id)}
            disabled={revealed}
          >
            {opt.text}
          </button>
        ))}
      </div>
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
