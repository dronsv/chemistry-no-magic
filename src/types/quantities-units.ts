export interface QuantityDef {
  id: string;
  name_ru: string;
  dimension: string;
  recommended_units: string[];
  optional?: boolean;
  notes?: string;
}

export interface UnitDef {
  id: string;
  name_ru: string;
  quantity: string;
  to_SI: { unit: string; factor: number; offset?: number } | null;
  notes?: string;
}

export interface QuantitiesUnitsOntology {
  meta: { title: string; version: string; generated_utc?: string; namespaces: Record<string, string> };
  quantities: QuantityDef[];
  units: UnitDef[];
  structures: Record<string, unknown>;
  examples: Record<string, unknown>;
}
