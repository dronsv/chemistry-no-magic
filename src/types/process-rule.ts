export interface ProcessEffect {
  effect: string;
  strength: string;
}

export interface SurfaceLayerExample {
  element: string;
  layer: string;
}

export interface SurfaceLayer {
  compound_hint: string;
  examples: SurfaceLayerExample[];
}

export interface ProcessConsequence {
  type: string;
  reaction_family: string;
}

export interface ProcessDefinition {
  id: string;
  type: 'surface_process';
  /** From translation overlay */
  name?: string;
  /** From translation overlay */
  description?: string;
  effects: ProcessEffect[];
}

export interface PassivationRule {
  id: string;
  type: 'passivation_rule';
  process_id: string;
  applies_to: { element_ids: string[] };
  conditions: Record<string, unknown>;
  surface_layer: SurfaceLayer;
  consequences: ProcessConsequence[];
  /** From translation overlay */
  notes?: string[];
  related_applicability_rule_id?: string;
}

export interface PassivationDestruction {
  id: string;
  type: 'passivation_destruction';
  target_process_id: string;
  applies_to: { element_ids: string[] };
  /** From translation overlay */
  method?: string;
  /** From translation overlay */
  result?: string;
}

export type ProcessRule = ProcessDefinition | PassivationRule | PassivationDestruction;
