import { useCallback } from 'react';
import type { OgeOption } from '../../../types/oge-task';
import ChemText from '../../../components/ChemText';
import * as m from '../../../paraglide/messages.js';

interface Props {
  options: OgeOption[];
  count: number;
  ordered: boolean;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  correct_answer?: string;
}

function parseSelected(value: string): string[] {
  return value ? value.split('') : [];
}

export default function SelectAnswer({
  options, count, ordered, value, onChange, disabled, correct_answer,
}: Props) {
  const selected = parseSelected(value);

  const handleClick = useCallback(function handleClick(id: string) {
    if (disabled) return;

    const idx = selected.indexOf(id);
    let next: string[];

    if (idx >= 0) {
      // Deselect
      next = selected.filter((_, i) => i !== idx);
    } else if (selected.length < count) {
      // Add selection
      next = [...selected, id];
    } else {
      return;
    }

    if (!ordered) {
      next.sort();
    }
    onChange(next.join(''));
  }, [selected, count, ordered, disabled, onChange]);

  function optionClass(id: string): string {
    const base = 'oge-select__option';
    const classes = [base];

    const isSelected = selected.includes(id);
    if (isSelected) classes.push(`${base}--selected`);

    if (disabled && correct_answer) {
      const correctIds = correct_answer.split('');
      const isCorrect = correctIds.includes(id);

      if (isSelected && isCorrect) {
        classes.push(`${base}--correct`);
      } else if (isSelected && !isCorrect) {
        classes.push(`${base}--wrong`);
      } else if (!isSelected && isCorrect) {
        classes.push(`${base}--missed`);
      }
    }

    return classes.join(' ');
  }

  return (
    <div className="oge-select">
      <div className="oge-select__options">
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            className={optionClass(opt.id)}
            onClick={() => handleClick(opt.id)}
            disabled={disabled}
          >
            <span className="oge-select__id">{opt.id})</span>
            <span className="oge-select__text"><ChemText text={opt.text} /></span>
          </button>
        ))}
      </div>
      {value && (
        <div className="oge-select__answer">
          {m.oge_answer_label()} <strong>{value}</strong>
        </div>
      )}
    </div>
  );
}
