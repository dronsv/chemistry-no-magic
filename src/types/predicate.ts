export interface PredicateDef {
  id: string;
  namespace: string;

  role: 'goal' | 'fact' | 'context';
  returns: string;

  positional_args: ArgDef[];
  named_args: ArgDef[];

  temporal_kind: 'static' | 'observable' | 'process';

  aliases: Record<string, string[]>;
  search_tokens: Record<string, string[]>;

  source: PredicateSource;
}

export interface ArgDef {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

export type PredicateSource =
  | { kind: 'property'; property_id: string }
  | { kind: 'formula_variable'; formula_id: string; variable: string }
  | { kind: 'concept'; concept_id: string }
  | { kind: 'process'; process_id: string }
  | { kind: 'constructor' }
  | { kind: 'manual' };
