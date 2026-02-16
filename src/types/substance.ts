export interface Substance {
  id: string;
  formula: string;
  name_ru?: string;
  class: string;
  subclass?: string;
  ions?: string[];
  notes?: string;
  tags?: string[];
  melting_point_C?: number | null;
  boiling_point_C?: number | null;
  density_g_cm3?: number | null;
  appearance_ru?: string;
  hazards_ru?: string[];
  storage_ru?: string;
  industrial_ru?: string;
  production_ru?: string;
  fun_facts_ru?: string[];
}

export interface SubstancesIndex {
  substances: Array<{
    id: string;
    formula: string;
    name_ru?: string;
    class: string;
  }>;
}
