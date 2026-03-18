import type { CharacteristicEntry } from '../types/characteristic';
import './characteristic-value.css';

interface Props {
  conceptName: string;
  entry: CharacteristicEntry;
  showConditions?: boolean;
}

function formatValue(v: number | string | boolean): string {
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return parseFloat(v.toPrecision(4)).toString();
  }
  return String(v);
}

function formatUnit(unit: string): string {
  return unit.replace(/^unit:/, '').replace(/_/g, '/').replace('per', '/');
}

function formatConditions(c: Record<string, unknown>): string {
  const parts: string[] = [];
  if (c.solvent) parts.push(String(c.solvent));
  if (c.temperature_C != null) parts.push(`${c.temperature_C}°C`);
  if (c.dissociation_step != null) parts.push(`step ${c.dissociation_step}`);
  return parts.join(', ');
}

export default function CharacteristicValue({ conceptName, entry, showConditions = true }: Props) {
  return (
    <span className="char-value">
      <span className="char-value__name">{conceptName}</span>
      <span className="char-value__eq"> = </span>
      <span className="char-value__val">{formatValue(entry.value)}</span>
      {entry.unit && <span className="char-value__unit"> {formatUnit(entry.unit)}</span>}
      {showConditions && entry.conditions && Object.keys(entry.conditions).length > 0 && (
        <span className="char-value__conditions"> ({formatConditions(entry.conditions as Record<string, unknown>)})</span>
      )}
    </span>
  );
}
