import type { TypedCharacteristic } from '../types/characteristic';
import './characteristic-value.css';

interface Props {
  characteristic: TypedCharacteristic;
  conceptName?: string;
  showConditions?: boolean;
}

/** Format a number value for display: up to 4 significant digits, strip trailing zeros */
function formatNumber(v: number): string {
  if (Number.isInteger(v)) return String(v);
  // Round to 4 significant digits
  const s = parseFloat(v.toPrecision(4)).toString();
  return s;
}

/** Build condition label string from ConditionContext */
function buildConditionsLabel(char: TypedCharacteristic): string | null {
  const c = char.conditions;
  if (!c) return null;
  const parts: string[] = [];
  if (c.solvent === 'water') parts.push('aq');
  if (c.temperature_C != null) parts.push(`${c.temperature_C}°C`);
  if (c.dissociation_step != null) parts.push(`step ${c.dissociation_step}`);
  if (c.phase) parts.push(c.phase);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Strip "unit:" prefix for display */
function formatUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  return unit.replace(/^unit:/, '');
}

/** Clean up concept ID to a display label if no name is provided */
function cleanConceptId(id: string): string {
  return id.replace(/^concept:/, '');
}

export default function CharacteristicValue({
  characteristic,
  conceptName,
  showConditions = true,
}: Props) {
  const name = conceptName ?? cleanConceptId(characteristic.characteristic_concept_id);
  const valueStr =
    typeof characteristic.value === 'number'
      ? formatNumber(characteristic.value)
      : String(characteristic.value);
  const unit = formatUnit(characteristic.unit);
  const condLabel = showConditions ? buildConditionsLabel(characteristic) : null;

  return (
    <span className="char-value">
      <span className="char-value__name">{name}</span>
      <span className="char-value__eq">=</span>
      <span className="char-value__val">{valueStr}</span>
      {unit && <span className="char-value__unit">{unit}</span>}
      {condLabel && (
        <span className="char-value__conditions">({condLabel})</span>
      )}
    </span>
  );
}
