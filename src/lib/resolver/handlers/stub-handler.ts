import type { ResolutionDef } from '../../../types/resolution.js';

/**
 * Returns a not_implemented error for all unimplemented handler kinds.
 * Used as a safe fallback for ProblemKind values not yet supported.
 */
export function executeStub(resolution: ResolutionDef): { error: string } {
  return {
    error: `not_implemented: handler for kind "${resolution.kind}" is not yet available (resolution: ${resolution.id})`,
  };
}
