export interface CalcElementComposition {
  element: string;
  Ar: number;
  count: number;
}

export interface CalcSubstance {
  formula: string;
  name: string;
  composition: CalcElementComposition[];
}

export interface CalcReactionSide {
  formula: string;
  coeff: number;
  M: number;
}

export interface CalcReaction {
  equation: string;
  given: CalcReactionSide;
  find: CalcReactionSide;
  delta_H_kJmol?: number;    // standard enthalpy of reaction, kJ/mol
}

export interface CalculationsData {
  calc_substances: CalcSubstance[];
  calc_reactions: CalcReaction[];
}
