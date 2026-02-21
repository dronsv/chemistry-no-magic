import { useState } from 'react';
import type { DiagnosticQuestion } from '../../types/diagnostic';
import * as m from '../../paraglide/messages.js';

interface QuestionCardProps {
  question: DiagnosticQuestion;
  onAnswer: (correct: boolean) => void;
}

export default function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const isCorrect = selected === question.correct_option;

  function handleSelect(optionId: string) {
    if (revealed) return;
    setSelected(optionId);
    setRevealed(true);
  }

  function handleNext() {
    onAnswer(isCorrect);
  }

  function optionClass(optionId: string): string {
    const base = 'diag-option';
    if (!revealed) return base;
    if (optionId === question.correct_option) {
      return optionId === selected ? `${base} ${base}--correct` : `${base} ${base}--missed`;
    }
    if (optionId === selected) return `${base} ${base}--wrong`;
    return base;
  }

  return (
    <div>
      <p className="diag-question__text">{question.question_ru}</p>
      <div className="diag-question__options">
        {question.options.map((opt) => (
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
          <div className={`diag-feedback diag-feedback--${isCorrect ? 'correct' : 'wrong'}`}>
            <span className="diag-feedback__label">
              {isCorrect ? m.correct() : m.wrong()}
            </span>
            {question.explanation_ru}
          </div>
          <button
            type="button"
            className="btn btn-primary diag-next"
            onClick={handleNext}
          >
            {m.next()}
          </button>
        </>
      )}
    </div>
  );
}
