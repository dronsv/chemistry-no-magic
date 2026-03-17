import type { CharacteristicEntry, EntityCharacteristics, TypedCharacteristic } from '../types/characteristic';

/** Index characteristics by subject_id for fast lookup */
export function indexCharacteristicsBySubject(
  chars: TypedCharacteristic[],
): Map<string, TypedCharacteristic[]> {
  const map = new Map<string, TypedCharacteristic[]>();
  for (const c of chars) {
    const list = map.get(c.subject_id);
    if (list) list.push(c);
    else map.set(c.subject_id, [c]);
  }
  return map;
}

/** Index characteristics by concept_id for finding all subjects with a property */
export function indexCharacteristicsByConcept(
  chars: TypedCharacteristic[],
): Map<string, TypedCharacteristic[]> {
  const map = new Map<string, TypedCharacteristic[]>();
  for (const c of chars) {
    const list = map.get(c.characteristic_concept_id);
    if (list) list.push(c);
    else map.set(c.characteristic_concept_id, [c]);
  }
  return map;
}

/** Get a single characteristic value for a subject+concept pair */
export function getCharacteristicValue(
  subjectChars: TypedCharacteristic[] | undefined,
  conceptId: string,
  step?: number,
): number | string | boolean | undefined {
  if (!subjectChars) return undefined;
  const match = subjectChars.find(c =>
    c.characteristic_concept_id === conceptId &&
    (step == null || c.conditions?.dissociation_step === step)
  );
  return match?.value;
}

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
