export interface ClassificationRule {
  id: string;
  class: string;
  subclass?: string;
  pattern: string;
  description_ru: string;
  examples: string[];
}

export interface NamingRule {
  id: string;
  class: string;
  pattern: string;
  template_ru: string;
  examples: Array<{ formula: string; name_ru: string }>;
}

export interface SolubilityEntry {
  cation: string;
  anion: string;
  solubility: 'soluble' | 'insoluble' | 'slightly_soluble' | 'decomposes';
}

export interface ActivitySeriesEntry {
  symbol: string;
  name_ru: string;
  position: number;
  reduces_H: boolean;
}
