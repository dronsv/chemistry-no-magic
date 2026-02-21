import { useCallback, useRef } from 'react';

interface Props {
  labels: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  correct_answer?: string;
}

/** Detect pipe-separated format: "7|3" vs concatenated "73". */
function isPipeSeparated(answer: string): boolean {
  return answer.includes('|');
}

/** Parse correct_answer into per-cell values. */
function parseCorrectCells(answer: string, count: number): string[] {
  if (isPipeSeparated(answer)) {
    return answer.split('|');
  }
  // Legacy OGE format: one character per cell
  return answer.padEnd(count, ' ').split('').slice(0, count);
}

/** Parse user value into per-cell values. */
function parseUserCells(val: string, count: number, usePipe: boolean): string[] {
  if (usePipe) {
    const parts = val.split('|');
    while (parts.length < count) parts.push('');
    return parts.slice(0, count);
  }
  return val.padEnd(count, ' ').split('').slice(0, count);
}

/** Serialize per-cell values back to string. */
function serializeCells(cells: string[], usePipe: boolean): string {
  if (usePipe) {
    return cells.join('|').replace(/\|+$/, '');
  }
  return cells.join('').trimEnd();
}

export default function InputCellsAnswer({
  labels, value, onChange, disabled, correct_answer,
}: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const usePipe = correct_answer ? isPipeSeparated(correct_answer) : value.includes('|');
  const isMultiChar = usePipe;
  const cells = parseUserCells(value, labels.length, usePipe);

  const handleChange = useCallback(function handleChange(index: number, newVal: string) {
    if (disabled) return;

    const next = [...cells];

    if (isMultiChar) {
      next[index] = newVal;
    } else {
      // Legacy single-digit mode
      if (/^\d$/.test(newVal)) {
        next[index] = newVal;
        if (index < labels.length - 1) {
          inputRefs.current[index + 1]?.focus();
        }
      } else if (newVal === '') {
        next[index] = ' ';
      } else {
        return;
      }
    }

    onChange(serializeCells(next, usePipe));
  }, [cells, labels.length, disabled, onChange, isMultiChar, usePipe]);

  const handleKeyDown = useCallback(function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (!isMultiChar && e.key === 'Backspace' && cells[index]?.trim() === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [cells, isMultiChar]);

  function cellClass(index: number): string {
    const base = 'oge-cells__input';
    const classes = [base];

    if (disabled && correct_answer) {
      const userVal = cells[index]?.trim();
      const correctCells = parseCorrectCells(correct_answer, labels.length);
      const correctVal = correctCells[index]?.trim();
      if (userVal && correctVal) {
        if (userVal === correctVal) {
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
            inputMode={isMultiChar ? 'text' : 'numeric'}
            maxLength={isMultiChar ? 10 : 1}
            className={`${cellClass(i)}${isMultiChar ? ' oge-cells__input--wide' : ''}`}
            value={cells[i]?.trim() ?? ''}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
