import type { TypedCharacteristic } from '../types/characteristic';

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
