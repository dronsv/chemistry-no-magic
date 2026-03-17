export type ValueSourceKind = 'asserted' | 'derived' | 'approximate';

export interface ConditionContext {
  solvent?: string;
  temperature_C?: number;
  pressure_kPa?: number;
  dissociation_step?: number;
  phase?: 'solid' | 'liquid' | 'gas' | 'aqueous';
}

export interface TypedCharacteristic {
  id: string;
  characteristic_concept_id: string;
  subject_id: string;
  value_kind: 'number' | 'string' | 'boolean' | 'enum';
  value: number | string | boolean;
  unit?: string | null;
  conditions?: ConditionContext;
  source?: {
    kind: ValueSourceKind;
    ref?: string;
    derived_from?: string[];
  };
  explanation_concept_id?: string;
}

/** Single characteristic value stored on an entity */
export interface CharacteristicEntry {
  value: number | string | boolean;
  unit?: string | null;
  conditions?: ConditionContext;
  source?: { kind: ValueSourceKind; ref?: string; derived_from?: string[] };
  explanation_concept_id?: string;
}

/** Characteristics map on an entity: concept_id → entry or array (multi-step) */
export type EntityCharacteristics = Record<string, CharacteristicEntry | CharacteristicEntry[]>;
