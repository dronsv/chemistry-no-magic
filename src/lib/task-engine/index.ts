// ── Public API for the Task Engine ───────────────────────────────

export { createTaskEngine } from './task-engine';
export type { TaskEngine, Exercise } from './task-engine';

export type {
  TaskTemplate,
  GeneratedTask,
  OntologyData,
  PromptTemplateMap,
  PropertyDef,
  MorphologyData,
  EvaluationResult,
  EvaluationSpec,
  SlotValues,
} from './types';

export { evaluate } from './evaluator';
export { createRegistry } from './template-registry';
