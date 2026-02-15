export interface PropertyTrend {
  id: string;
  title_ru: string;
  icon: string;
  trend_period_ru: string;
  trend_group_ru: string;
  why_period_ru: string;
  why_group_ru: string;
  examples_ru: string[];
}

export interface ExceptionConsequence {
  id: string;
  element_Z: number;
  symbol: string;
  title_ru: string;
  config_change_ru: string;
  consequences_ru: string[];
}

export interface GeneralPrinciple {
  title_ru: string;
  text_ru: string;
  formula_ru: string;
}

export interface PeriodicTableTheory {
  property_trends: PropertyTrend[];
  exception_consequences: ExceptionConsequence[];
  general_principle_ru: GeneralPrinciple;
}
