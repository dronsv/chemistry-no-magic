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
  delta_Hf_kJmol?: number;   // standard enthalpy of formation, kJ/mol (IUPAC: negative = exothermic formation)
  S_JmolK?: number;          // standard molar entropy, J/(mol·K)
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
  delta_H_kJmol?: number;    // standard enthalpy of reaction, kJ/mol
}

export interface CalculationsData {
  calc_substances: CalcSubstance[];
  calc_reactions: CalcReaction[];
}
