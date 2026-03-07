export interface TrendExampleElement {
  symbol: string;
  /** Language-neutral numeric value (e.g. "152 пм", "4.0"). */
  value?: string;
}

export interface TrendExampleSeries {
  type: 'series';
  label: string;
  direction: 'period' | 'group';
  elements: TrendExampleElement[];
  comment: string;
}

export interface TrendExampleText {
  type: 'text';
  text: string;
}

export type TrendExample = TrendExampleSeries | TrendExampleText;

export interface PropertyTrend {
  id: string;
  title: string;
  icon: string;
  trend_period: string;
  trend_group: string;
  why_period: string;
  why_group: string;
  examples?: TrendExample[];
}

export interface ExceptionConsequence {
  id: string;
  element_Z: number;
  symbol: string;
  title: string;
  config_change: string;
  consequences: string[];
}

export interface GeneralPrinciple {
  title: string;
  text: string;
  formula: string;
}

export interface PeriodicTableTheory {
  property_trends: PropertyTrend[];
  exception_consequences: ExceptionConsequence[];
  general_principle?: GeneralPrinciple;
}
