export interface ElementGroupInfo {
  name: string;
  name_singular: string;
  origin: string;
  description: string;
  common_properties: string[];
}

/** Dictionary keyed by ElementGroup id (e.g. "alkali_metal"). */
export type ElementGroupDict = Record<string, ElementGroupInfo>;
