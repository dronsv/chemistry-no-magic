import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { readJsonFile, writeJsonFile, rebuildIndex, getDataSrcRoot } from './_shared.js';
import type { IndexRef } from '../../../shared/types.js';

interface AddRuleTermArgs {
  term: string;
}

interface UpdateRuleTermArgs {
  old_term: string;
  new_term: string;
}

interface AddRuleTermResult {
  term?: string;
  status?: 'created';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

interface UpdateRuleTermResult {
  old_term?: string;
  new_term?: string;
  status?: 'updated';
  warnings?: string[];
  error?: boolean;
  code?: string;
  message?: string;
}

async function ensureVocabDir(dataSrc: string): Promise<void> {
  await mkdir(join(dataSrc, 'vocab'), { recursive: true });
}

async function readTerms(filePath: string): Promise<string[]> {
  try {
    return (await readJsonFile(filePath)) as string[];
  } catch {
    return [];
  }
}

export async function addRuleTerm(
  indexRef: IndexRef,
  args: AddRuleTermArgs,
  dataSrcOverride?: string,
): Promise<AddRuleTermResult> {
  if (!args.term || !args.term.trim()) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: 'term must be a non-empty string',
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  await ensureVocabDir(dataSrc);
  const filePath = join(dataSrc, 'vocab', 'rule_terms.json');

  const terms = await readTerms(filePath);

  if (terms.includes(args.term)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Rule term "${args.term}" already exists`,
    };
  }

  terms.push(args.term);
  terms.sort();

  await writeJsonFile(filePath, terms);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    term: args.term,
    status: 'created',
  };
}

export async function updateRuleTerm(
  indexRef: IndexRef,
  args: UpdateRuleTermArgs,
  dataSrcOverride?: string,
): Promise<UpdateRuleTermResult> {
  if (!args.old_term || !args.old_term.trim()) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: 'old_term must be a non-empty string',
    };
  }

  if (!args.new_term || !args.new_term.trim()) {
    return {
      error: true,
      code: 'VALIDATION_FAILED',
      message: 'new_term must be a non-empty string',
    };
  }

  const dataSrc = dataSrcOverride ?? getDataSrcRoot();
  const filePath = join(dataSrc, 'vocab', 'rule_terms.json');

  let terms: string[];
  try {
    terms = (await readJsonFile(filePath)) as string[];
  } catch {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `rule_terms.json not found at ${filePath}`,
    };
  }

  const idx = terms.indexOf(args.old_term);

  if (idx === -1) {
    return {
      error: true,
      code: 'NOT_FOUND',
      message: `Rule term "${args.old_term}" not found`,
    };
  }

  if (terms.includes(args.new_term)) {
    return {
      error: true,
      code: 'ENTITY_EXISTS',
      message: `Rule term "${args.new_term}" already exists`,
    };
  }

  terms[idx] = args.new_term;
  terms.sort();

  await writeJsonFile(filePath, terms);

  if (!dataSrcOverride) {
    await rebuildIndex(indexRef);
  }

  return {
    old_term: args.old_term,
    new_term: args.new_term,
    status: 'updated',
  };
}
