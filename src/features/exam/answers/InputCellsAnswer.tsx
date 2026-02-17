import { useCallback, useRef } from 'react';

interface Props {
  labels: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  correct_answer?: string;
}

export default function InputCellsAnswer({
  labels, value, onChange, disabled, correct_answer,
}: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.padEnd(labels.length, ' ').split('').slice(0, labels.length);

  const handleInput = useCallback(function handleInput(index: number, char: string) {
    if (disabled) return;

    const next = [...digits];
    if (/^\d$/.test(char)) {
      next[index] = char;
      // Auto-focus next cell
      if (index < labels.length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (char === '') {
      next[index] = ' ';
    }

    onChange(next.join('').trimEnd());
  }, [digits, labels.length, disabled, onChange]);

  const handleKeyDown = useCallback(function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === 'Backspace' && digits[index] === ' ' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  function cellClass(index: number): string {
    const base = 'oge-cells__input';
    const classes = [base];

    if (disabled && correct_answer) {
      const userChar = digits[index]?.trim();
      const correctChar = correct_answer[index];
      if (userChar && correctChar) {
        if (userChar === correctChar) {
          classes.push(`${base}--correct`);
        } else {
          classes.push(`${base}--wrong`);
        }
      }
    }

    return classes.join(' ');
  }

  return (
    <div className="oge-cells">
      {labels.map((label, i) => (
        <div key={i} className="oge-cells__cell">
          <label className="oge-cells__label">{label}</label>
          <input
            ref={el => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className={cellClass(i)}
            value={digits[i]?.trim() ?? ''}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
