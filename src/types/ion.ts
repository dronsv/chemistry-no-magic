export type IonType = 'cation' | 'anion';

export interface IonNaming {
  root: string;
  suffix: string;
  prefix?: string;
  oxidation_state: number;
  pair_id?: string;
  derivation?: string;
}

export interface Ion {
  id: string;
  formula: string;
  charge: number;
  type: IonType;
  name: string;
  name_genitive?: string;
  parent_acid?: string;
  naming?: IonNaming;
  tags: string[];
}
