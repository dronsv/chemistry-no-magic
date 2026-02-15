export interface Substance {
  id: string;
  formula: string;
  name_ru?: string;
  class: string;
  subclass?: string;
  ions?: string[];
  notes?: string;
  tags?: string[];
}

export interface SubstancesIndex {
  substances: Array<{
    id: string;
    formula: string;
    name_ru?: string;
    class: string;
  }>;
}
