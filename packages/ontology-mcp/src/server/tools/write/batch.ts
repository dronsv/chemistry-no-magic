import type { IndexRef } from '../../../shared/types.js';

export interface BatchOperation {
  tool: string;  // e.g. "add_substance", "add_concept", "add_translation"
  args: Record<string, unknown>;
}

export interface BatchOperationResult {
  tool: string;
  status: 'ok' | 'error';
  result: unknown;
}

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchOperationResult[];
}

export async function batchAdd(
  indexRef: IndexRef,
  operations: BatchOperation[],
  executors: Record<string, (indexRef: IndexRef, args: any) => Promise<any>>,
): Promise<BatchResult> {
  const results: BatchOperationResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const op of operations) {
    const executor = executors[op.tool];
    if (!executor) {
      results.push({
        tool: op.tool,
        status: 'error',
        result: { error: true, code: 'UNKNOWN_TOOL', message: `Unknown tool: "${op.tool}"` },
      });
      failed++;
      continue;
    }

    try {
      const result = await executor(indexRef, op.args);
      const isError = result && typeof result === 'object' && 'error' in result && result.error === true;
      results.push({
        tool: op.tool,
        status: isError ? 'error' : 'ok',
        result,
      });
      if (isError) {
        failed++;
      } else {
        succeeded++;
      }
    } catch (err) {
      results.push({
        tool: op.tool,
        status: 'error',
        result: {
          error: true,
          code: 'EXECUTION_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      });
      failed++;
    }
  }

  return {
    total: operations.length,
    succeeded,
    failed,
    results,
  };
}
