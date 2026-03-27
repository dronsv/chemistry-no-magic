import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface AuditEntry {
  timestamp: string;  // ISO 8601
  tool: string;       // e.g. "add_concept"
  args: Record<string, unknown>;
  result: 'ok' | 'error';
  ref?: string;       // created/updated entity ref
}

export async function appendAuditLog(
  dataSrcRoot: string,
  entry: AuditEntry,
): Promise<void> {
  const logPath = join(dataSrcRoot, '.audit-log.jsonl');
  const line = JSON.stringify(entry) + '\n';
  await appendFile(logPath, line, 'utf-8');
}

export async function readAuditLog(
  dataSrcRoot: string,
  limit?: number,
): Promise<AuditEntry[]> {
  const logPath = join(dataSrcRoot, '.audit-log.jsonl');
  try {
    const content = await readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries = lines.map(l => JSON.parse(l) as AuditEntry);
    if (limit !== undefined) return entries.slice(-limit);
    return entries;
  } catch { return []; }
}
