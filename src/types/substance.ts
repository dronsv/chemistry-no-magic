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
  melting_point_C?: number | null;
  boiling_point_C?: number | null;
  density_g_cm3?: number | null;
  appearance?: string;
  hazards?: string[];
  storage?: string;
  industrial?: string;
  production?: string;
  fun_facts?: string[];
}

export interface SubstancesIndex {
  substances: Array<{
    id: string;
    formula: string;
    name?: string;
    class: string;
  }>;
}
