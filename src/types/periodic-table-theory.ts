export interface TrendExampleElement {
  symbol: string;
  /** Language-neutral numeric value (e.g. "152 пм", "4.0"). */
  value?: string;
  /** Language-dependent value (e.g. "металл"). Overlay replaces this. */
  value_ru?: string;
}

export interface TrendExampleSeries {
  type: 'series';
  label_ru: string;
  direction: 'period' | 'group';
  elements: TrendExampleElement[];
  comment_ru: string;
}

export interface TrendExampleText {
  type: 'text';
  text_ru: string;
}

export type TrendExample = TrendExampleSeries | TrendExampleText;

export interface PropertyTrend {
  id: string;
  title_ru: string;
  icon: string;
  trend_period_ru: string;
  trend_group_ru: string;
  why_period_ru: string;
  why_group_ru: string;
  examples?: TrendExample[];
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
