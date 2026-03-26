import { join } from 'node:path';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface FormulaVariable {
  symbol: string;
  display_symbol?: string;
  quantity: string;
  unit: string;
  role: string;
  binding?: { mode: string; ref: string };
  explanation_overrides?: Record<string, string>;
}

interface FormulaEntry {
  id: string;
  kind: string;
  domain: string;
  school_grade: number[];
  concept_refs?: string[];
  didactic_scope?: string;
  variables: FormulaVariable[];
  expression: Record<string, unknown>;
  result_variable: string;
  invertible_for?: string[];
  inversions?: Record<string, unknown>;
  constants_used?: string[];
  prerequisite_formulas?: string[];
  used_by_solvers?: string[];
  [key: string]: unknown;
}

interface AddFormulaArgs {
  id: string;
  kind: string;
  domain: string;
  school_grade: number[];
  concept_refs?: string[];
  didactic_scope?: string;
  variables: FormulaVariable[];
  expression: Record<string, unknown>;
  result_variable: string;
  invertible_for?: string[];
  inversions?: Record<string, unknown>;
  constants_used?: string[];
  prerequisite_formulas?: string[];
  used_by_solvers?: string[];
}

interface UpdateFormulaArgs {
  id: string;
  kind?: string;
  domain?: string;
  school_grade?: number[];
  concept_refs?: string[];
  didactic_scope?: string;
  variables?: FormulaVariable[];
  expression?: Record<string, unknown>;
  result_variable?: string;
  invertible_for?: string[];
  inversions?: Record<string, unknown>;
  constants_used?: string[];
  prerequisite_formulas?: string[];
  used_by_solvers?: string[];
}

interface AddFormulaResult {
  ref?: string;
  status?: 'created';
  requires_review?: boolean;
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

interface UpdateFormulaResult {
  ref?: string;
  status?: 'updated';
  updated_fields?: string[];
  requires_review?: boolean;
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

export async function addFormula(
  indexRef: IndexRef,
  args: AddFormulaArgs,
  dataSrcOverride?: string,
): Promise<AddFormulaResult> {
  // Validate id prefix
  if (!args.id.startsWith('formula:')) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: `Formula id "${args.id}" must start with "formula:"`,
    };
  }

  // Validate variables
  if (!args.variables?.length) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: 'variables must have at least 1 entry',
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'foundations', 'formulas.json');

  let entries: FormulaEntry[];
  try {
    entries = (await readJsonFile(filePath)) as FormulaEntry[];
  } catch {
    entries = [];
  }

  if (entries.some(e => e.id === args.id)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Formula "${args.id}" already exists`,
    };
  }

  const entry: FormulaEntry = {
    id: args.id,
    kind: args.kind,
    domain: args.domain,
    school_grade: args.school_grade,
    variables: args.variables,
    expression: args.expression,
    result_variable: args.result_variable,
  };

  if (args.concept_refs !== undefined) entry.concept_refs = args.concept_refs;
  if (args.didactic_scope !== undefined) entry.didactic_scope = args.didactic_scope;
  if (args.invertible_for !== undefined) entry.invertible_for = args.invertible_for;
  if (args.inversions !== undefined) entry.inversions = args.inversions;
  if (args.constants_used !== undefined) entry.constants_used = args.constants_used;
  if (args.prerequisite_formulas !== undefined) entry.prerequisite_formulas = args.prerequisite_formulas;
  if (args.used_by_solvers !== undefined) entry.used_by_solvers = args.used_by_solvers;

  entries.push(entry);

  await writeJsonFile(filePath, entries);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: args.id,
    status: 'created',
    requires_review: true,
  };
}

export async function updateFormula(
  indexRef: IndexRef,
  args: UpdateFormulaArgs,
  dataSrcOverride?: string,
): Promise<UpdateFormulaResult> {
  if (!args.id.startsWith('formula:')) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: `Formula id "${args.id}" must start with "formula:"`,
    };
  }

  // Validate variables if provided
  if (args.variables !== undefined && !args.variables.length) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: 'variables must have at least 1 entry',
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'foundations', 'formulas.json');

  let entries: FormulaEntry[];
  try {
    entries = (await readJsonFile(filePath)) as FormulaEntry[];
  } catch {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `formulas.json not found at ${filePath}`,
    };
  }

  const idx = entries.findIndex(e => e.id === args.id);

  if (idx === -1) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Formula "${args.id}" not found`,
    };
  }

  const { id: _id, ...fields } = args;
  void _id;

  const updated: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      (entries[idx] as any)[k] = v;
      updated.push(k);
    }
  }

  await writeJsonFile(filePath, entries);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    ref: args.id,
    status: 'updated',
    updated_fields: updated,
    requires_review: true,
  };
}
