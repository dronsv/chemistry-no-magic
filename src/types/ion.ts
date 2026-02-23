export type IonType = 'cation' | 'anion';

export interface IonNaming {
  root_ru: string;
  suffix_ru: string;
  prefix_ru?: string;
  suffix_en?: string;
  prefix_en?: string;
  oxidation_state: number;
  pair_id?: string;
  derivation_ru?: string;
}

export interface Ion {
  id: string;
  formula: string;
  charge: number;
  type: IonType;
  name_ru: string;
  name_ru_genitive?: string;
  parent_acid?: string;
  naming?: IonNaming;
  tags: string[];
}
