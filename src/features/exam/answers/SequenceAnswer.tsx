import { useCallback } from 'react';
import type { OgeOption } from '../../../types/oge-task';
import ChemText from '../../../components/ChemText';

interface Props {
  items: OgeOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  correct_answer?: string;
}

export default function SequenceAnswer({
  items, value, onChange, disabled, correct_answer,
}: Props) {
  const placed = value.split('');

  const handleItemClick = useCallback(function handleItemClick(id: string) {
    if (disabled) return;
    if (placed.includes(id)) return; // Already placed
    onChange(value + id);
  }, [placed, value, disabled, onChange]);

  const handleSlotClick = useCallback(function handleSlotClick(slotIndex: number) {
    if (disabled) return;
    // Remove this slot and all after it
    const next = placed.slice(0, slotIndex);
    onChange(next.join(''));
  }, [placed, disabled, onChange]);

  function slotClass(slotIndex: number): string {
    const base = 'oge-sequence__slot';
    const classes = [base];

    if (placed[slotIndex]) {
      classes.push(`${base}--filled`);
    }

    if (disabled && correct_answer && placed[slotIndex]) {
      if (placed[slotIndex] === correct_answer[slotIndex]) {
        classes.push(`${base}--correct`);
      } else {
        classes.push(`${base}--wrong`);
      }
    }

    return classes.join(' ');
  }

  function itemClass(id: string): string {
    const base = 'oge-sequence__item';
    if (placed.includes(id)) return `${base} ${base}--used`;
    return base;
  }

  return (
    <div className="oge-sequence">
      <div className="oge-sequence__items">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            className={itemClass(item.id)}
            onClick={() => handleItemClick(item.id)}
            disabled={disabled || placed.includes(item.id)}
          >
            <span className="oge-sequence__item-id">{item.id})</span>
            <ChemText text={item.text} />
          </button>
        ))}
      </div>

      <div className="oge-sequence__slots">
        {items.map((_, i) => (
          <div key={i} className="oge-sequence__slot-wrapper">
            {i > 0 && <span className="oge-sequence__arrow">&rarr;</span>}
            <button
              type="button"
              className={slotClass(i)}
              onClick={() => handleSlotClick(i)}
              disabled={disabled || !placed[i]}
            >
              {placed[i] || '\u00A0'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
