export interface ElementGroupInfo {
  name_ru: string;
  name_singular_ru: string;
  origin_ru: string;
  description_ru: string;
  common_properties_ru: string[];
}

/** Dictionary keyed by ElementGroup id (e.g. "alkali_metal"). */
export type ElementGroupDict = Record<string, ElementGroupInfo>;
