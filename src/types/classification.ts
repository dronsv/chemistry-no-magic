export interface ClassificationRule {
  id: string;
  class: string;
  subclass: string;
  pattern: string;
  description: string;
  examples: string[];
}

export interface NamingRule {
  id: string;
  class: string;
  pattern: string;
  template: string;
  examples: Array<{ formula: string; name: string }>;
}

export interface SubstanceIndexEntry {
  id: string;
  formula: string;
  name?: string;
  class: string;
  subclass?: string;
}
