export type ProcessKind = 'chemical' | 'physical' | 'driving_force' | 'operation' | 'constraint';

export type EffectCategory = 'kinetic' | 'thermodynamic' | 'mass_transfer' | 'phase';

export interface EffectsVocabEntry {
  id: string;
  category: EffectCategory;
  name_ru: string;
  description_ru: string;
}

export type EffectRef = string | { id: string; when: string };

export interface ProcessVocabEntry {
  id: string;
  kind: ProcessKind;
  name_ru: string;
  description_ru: string;
  params?: string[];
  effects?: EffectRef[];
  parent?: string;
}
