import { useCallback, type ReactNode } from 'react';
import FormulaChip from '../../components/FormulaChip';
import SlotAutocomplete, { type AutocompleteOption } from './SlotAutocomplete';
import type { SlotDef, SentenceTemplate, SlotDataSources } from './sentence-templates';

interface Props {
  template: SentenceTemplate;
  values: Record<string, string | number>;
  onChange: (values: Record<string, string | number>) => void;
  dataSources: SlotDataSources;
}

/**
 * Renders a sentence template with inline interactive slots.
 * Text parts are spans; entity slots are autocomplete chips;
 * number slots are inline <input type="number">.
 */
export default function SentenceEditor({ template, values, onChange, dataSources }: Props) {
  const setValue = useCallback(
    (id: string, val: string | number) => {
      onChange({ ...values, [id]: val });
    },
    [values, onChange],
  );

  return (
    <div className="sentence-editor">
      {template.sentence.map((part, i) => {
        if (typeof part === 'string') {
          return <span key={i}>{part}</span>;
        }
        return renderSlot(part, values, setValue, dataSources, i);
      })}
    </div>
  );
}

function renderSlot(
  slot: SlotDef,
  values: Record<string, string | number>,
  setValue: (id: string, val: string | number) => void,
  sources: SlotDataSources,
  idx: number,
): ReactNode {
  const val = values[slot.id];

  if (slot.kind === 'number' || slot.kind === 'quantity') {
    const numVal = typeof val === 'number' ? val : (slot.defaultValue as number) ?? 0;
    return (
      <input
        key={idx}
        type="number"
        className="slot-number"
        value={numVal}
        step="any"
        onChange={e => setValue(slot.id, Number(e.target.value))}
        title={slot.unit ?? ''}
      />
    );
  }

  // Entity slots: substance, indicator, element
  const options = getOptionsForSlot(slot, sources);
  const strVal = typeof val === 'string' ? val : (slot.defaultValue as string) ?? '';

  const renderSelected = (opt: AutocompleteOption | undefined) => {
    if (!opt) return slot.placeholder ?? '...';
    if (opt.formula) {
      return <FormulaChip formula={opt.formula} />;
    }
    return <span>{opt.label}</span>;
  };

  return (
    <SlotAutocomplete
      key={idx}
      options={options}
      value={strVal}
      onChange={id => setValue(slot.id, id)}
      renderSelected={renderSelected}
      placeholder={slot.placeholder}
    />
  );
}

function getOptionsForSlot(slot: SlotDef, sources: SlotDataSources): AutocompleteOption[] {
  if (slot.kind === 'indicator') {
    return sources.indicators;
  }

  if (slot.kind === 'element') {
    return sources.elements;
  }

  if (slot.kind === 'substance') {
    if (!slot.filter || slot.filter === 'all') {
      return sources.substances;
    }
    return sources.substances.filter(s => s.substanceClass === slot.filter);
  }

  return [];
}
