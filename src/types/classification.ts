export interface ClassificationRule {
  id: string;
  class: string;
  subclass: string;
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

export interface SubstanceIndexEntry {
  id: string;
  formula: string;
  name_ru?: string;
  class: string;
  subclass?: string;
}
