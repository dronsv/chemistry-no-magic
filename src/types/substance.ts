import type { EntityCharacteristics } from './characteristic';

export interface Substance {
  id: string;
  formula: string;
  name?: string;
  class: string;
  subclass?: string;
  ions?: string[];
  notes?: string;
  tags?: string[];
  phase_standard?: 'g' | 'l' | 's' | 'aq';
  appearance?: string;
  hazards?: string[];
  storage?: string;
  industrial?: string;
  production?: string;
  fun_facts?: string[];
  characteristics?: EntityCharacteristics;
}

export interface SubstancesIndex {
  substances: Array<{
    id: string;
    formula: string;
    name?: string;
    class: string;
  }>;
}
