export interface Factor {
  variable: string;
  position: 'numerator' | 'denominator' | 'exponent';
  power?: number;
  effect_on_result: 'direct' | 'inverse';
}

export interface QualPrediction {
  if_change: string;
  direction: 'increase' | 'decrease';
  then: string;
  direction_result: 'increase' | 'decrease';
}

export interface QualitativeRelation {
  id: string;              // namespace qrel:
  kind: 'qualitative_relation';
  domain: string;
  statement: string;       // machine-readable proportionality (e.g. "F ~ Z_eff / r^2"), not prose
  factors: Factor[];
  result_variable: string;
  grounded_in: string | null; // ref to formula:* or qrel:*, or null if fundamental
  predictions: QualPrediction[];
  school_grade: number[];
}
