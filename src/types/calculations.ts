export interface CalcElementComposition {
  element: string;
  Ar: number;
  count: number;
}

export interface CalcSubstance {
  formula: string;
  name_ru: string;
  M: number;
  composition: CalcElementComposition[];
}

export interface CalcReactionSide {
  formula: string;
  coeff: number;
  M: number;
}

export interface CalcReaction {
  equation_ru: string;
  given: CalcReactionSide;
  find: CalcReactionSide;
}

export interface CalculationsData {
  calc_substances: CalcSubstance[];
  calc_reactions: CalcReaction[];
}
