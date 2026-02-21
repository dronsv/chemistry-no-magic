import * as m from '../../../paraglide/messages.js';

interface Props {
  precision: 'integer' | 'tenths';
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  correct_answer?: string;
}

function isAnswerCorrect(value: string, correct: string, precision: 'integer' | 'tenths'): boolean {
  if (precision === 'integer') {
    return parseInt(value, 10) === parseInt(correct, 10);
  }
  const userFloat = parseFloat(value);
  const correctFloat = parseFloat(correct);
  if (isNaN(userFloat) || isNaN(correctFloat)) return false;
  return Math.abs(userFloat - correctFloat) < 0.05;
}

export default function NumericAnswer({
  precision, value, onChange, disabled, correct_answer,
}: Props) {
  const showResult = disabled && correct_answer !== undefined;
  const correct = showResult ? isAnswerCorrect(value, correct_answer, precision) : null;

  function inputClass(): string {
    const base = 'oge-numeric__input';
    const classes = [base];

    if (correct === true) classes.push(`${base}--correct`);
    if (correct === false) classes.push(`${base}--wrong`);

    return classes.join(' ');
  }

  const placeholder = precision === 'integer' ? m.oge_numeric_integer() : m.oge_numeric_tenths();

  return (
    <div className="oge-numeric">
      <label className="oge-numeric__label">
        {m.oge_answer_label()}
        <input
          type="text"
          inputMode={precision === 'integer' ? 'numeric' : 'decimal'}
          className={inputClass()}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      </label>
      {showResult && correct === false && (
        <div className="oge-numeric__correct">
          {m.oge_correct_answer({ answer: correct_answer })}
        </div>
      )}
    </div>
  );
}
