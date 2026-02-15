export type IonType = 'cation' | 'anion';

export interface Ion {
  id: string;
  formula: string;
  charge: number;
  type: IonType;
  name_ru: string;
  name_ru_genitive?: string;
  parent_acid?: string;
  tags: string[];
}
