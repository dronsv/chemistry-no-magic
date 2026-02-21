import { useCallback } from 'react';
import type { OgeLeftItem, OgeOption } from '../../../types/oge-task';
import ChemText from '../../../components/ChemText';
import * as m from '../../../paraglide/messages.js';

interface Props {
  leftItems: OgeLeftItem[];
  options: OgeOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  correct_answer?: string;
}

export default function MatchingAnswer({
  leftItems, options, value, onChange, disabled, correct_answer,
}: Props) {
  const assignments = value.split('');

  const handleAssign = useCallback(function handleAssign(rowIndex: number, optionId: string) {
    if (disabled) return;

    const next = [...assignments];
    // Pad array to the correct length
    while (next.length <= rowIndex) next.push('');

    // Toggle: if same value clicked again, clear it
    next[rowIndex] = next[rowIndex] === optionId ? '' : optionId;
    onChange(next.join(''));
  }, [assignments, disabled, onChange]);

  function cellClass(rowIndex: number, optionId: string): string {
    const base = 'oge-matching__btn';
    const classes = [base];

    if (assignments[rowIndex] === optionId) {
      classes.push(`${base}--selected`);
    }

    if (disabled && correct_answer) {
      const correctChar = correct_answer[rowIndex];
      const isAssigned = assignments[rowIndex] === optionId;
      const isCorrectOption = correctChar === optionId;

      if (isAssigned && isCorrectOption) {
        classes.push(`${base}--correct`);
      } else if (isAssigned && !isCorrectOption) {
        classes.push(`${base}--wrong`);
      } else if (!isAssigned && isCorrectOption) {
        classes.push(`${base}--missed`);
      }
    }

    return classes.join(' ');
  }

  return (
    <div className="oge-matching">
      <table className="oge-matching__table">
        <tbody>
          {leftItems.map((item, rowIndex) => (
            <tr key={item.label} className="oge-matching__row">
              <td className="oge-matching__label">{item.label}</td>
              <td className="oge-matching__text"><ChemText text={item.text} /></td>
              <td className="oge-matching__choices">
                {options.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    className={cellClass(rowIndex, opt.id)}
                    onClick={() => handleAssign(rowIndex, opt.id)}
                    disabled={disabled}
                    title={opt.text}
                  >
                    {opt.id}
                  </button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {value && (
        <div className="oge-matching__answer">
          {m.oge_answer_label()} <strong>{value}</strong>
        </div>
      )}
    </div>
  );
}
