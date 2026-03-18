import type { CharacteristicEntry, EntityCharacteristics } from '../types/characteristic';

/** Get characteristic value from an entity's characteristics map */
export function getEntityCharValue(
  characteristics: EntityCharacteristics | undefined,
  conceptId: string,
  step?: number,
): number | string | boolean | undefined {
  if (!characteristics) return undefined;
  const entry = characteristics[conceptId];
  if (!entry) return undefined;
  if (Array.isArray(entry)) {
    const match = step != null
      ? entry.find(e => e.conditions?.dissociation_step === step)
      : entry[0];
    return match?.value;
  }
  return entry.value;
}

/** Get full characteristic entry from an entity */
export function getEntityCharEntry(
  characteristics: EntityCharacteristics | undefined,
  conceptId: string,
  step?: number,
): CharacteristicEntry | undefined {
  if (!characteristics) return undefined;
  const entry = characteristics[conceptId];
  if (!entry) return undefined;
  if (Array.isArray(entry)) {
    return step != null
      ? entry.find(e => e.conditions?.dissociation_step === step)
      : entry[0];
  }
  return entry;
}
