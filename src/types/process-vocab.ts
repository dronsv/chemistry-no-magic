export type ProcessKind = 'chemical' | 'physical' | 'driving_force' | 'operation' | 'constraint';

export type EffectCategory = 'kinetic' | 'thermodynamic' | 'mass_transfer' | 'phase';

export interface EffectsVocabEntry {
  id: string;
  category: EffectCategory;
  name: string;
  description: string;
}

export type EffectRef = string | { id: string; when: string };

export interface ProcessVocabEntry {
  id: string;
  kind: ProcessKind;
  name: string;
  description: string;
  params?: string[];
  effects?: EffectRef[];
  parent?: string;
}
