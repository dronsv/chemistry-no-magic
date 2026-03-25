import type { RichText } from './ontology-ref';

export type ProcessKind = 'chemical' | 'physical' | 'driving_force' | 'operation' | 'constraint';
export type EffectCategory = 'kinetic' | 'thermodynamic' | 'mass_transfer' | 'phase';

export type ParamKind = 'substance' | 'quantity' | 'categorical';

export interface TypedParam {
  key: string;
  kind: ParamKind;
  ref?: string;
  unit?: string;
}

export interface EffectsVocabEntry {
  id: string;
  category: EffectCategory;
  name: string;
  description: string | RichText;
  concept_ref?: string;
}

export type EffectRef = string | { id: string; when: string };

export interface ProcessVocabEntry {
  id: string;
  kind: ProcessKind;
  name: string;
  description: string | RichText;
  params?: (string | TypedParam)[];
  effects?: EffectRef[];
  parent?: string;
  concept_ref?: string;
}
