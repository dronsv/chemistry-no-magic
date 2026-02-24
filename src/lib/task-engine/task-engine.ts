import type {
  TaskTemplate,
  OntologyData,
  GeneratedTask,
  SlotValues,
  SolverResult,
} from './types';
import { createRegistry, type TemplateRegistry } from './template-registry';
import { runGenerator } from './generators';
import { runSolver } from './solvers';
import { renderPrompt, type RenderContext } from './prompt-renderer';
import { generateDistractors } from './distractor-engine';

// ── Public types ─────────────────────────────────────────────────

export interface Exercise {
  type: string;
  question: string;
  format: 'multiple_choice' | 'interactive_orbital';
  options: Array<{ id: string; text: string }>;
  correctId: string;
  explanation: string;
  competencyMap: Record<string, 'P' | 'S'>;
}

export interface TaskEngine {
  /** Generate a task from a specific template. */
  generate(templateId: string): GeneratedTask;
  /** Generate a task from a random template. */
  generateRandom(): GeneratedTask;
  /** Generate a task for a specific competency, or null if none match. */
  generateForCompetency(competencyId: string): GeneratedTask | null;
  /** Convert a GeneratedTask into a UI-ready Exercise (shuffled options). */
  toExercise(task: GeneratedTask): Exercise;
}

// ── Factory ──────────────────────────────────────────────────────

export function createTaskEngine(
  templates: TaskTemplate[],
  ontology: OntologyData,
): TaskEngine {
  const registry: TemplateRegistry = createRegistry(templates);

  function generate(templateId: string): GeneratedTask {
    const template = registry.getById(templateId);
    if (!template) throw new Error(`Unknown template: ${templateId}`);
    return executeTemplate(template, ontology);
  }

  function generateRandom(): GeneratedTask {
    const all = registry.all();
    if (all.length === 0) throw new Error('No templates registered');
    const template = all[Math.floor(Math.random() * all.length)];
    return executeTemplate(template, ontology);
  }

  function generateForCompetency(competencyId: string): GeneratedTask | null {
    const matching = registry.getByCompetency(competencyId);
    if (matching.length === 0) return null;
    const template = matching[Math.floor(Math.random() * matching.length)];
    return executeTemplate(template, ontology);
  }

  function toExercise(task: GeneratedTask): Exercise {
    // Build options: correct + distractors, shuffled
    const options: Array<{ id: string; text: string }> = [
      { id: 'correct', text: String(task.correct_answer) },
    ];
    for (let i = 0; i < task.distractors.length; i++) {
      options.push({ id: `wrong_${i}`, text: task.distractors[i] });
    }

    // Fisher-Yates shuffle
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return {
      type: task.template_id,
      question: task.question,
      format: 'multiple_choice',
      options,
      correctId: 'correct',
      explanation: task.explanation,
      competencyMap: task.competency_map,
    };
  }

  return { generate, generateRandom, generateForCompetency, toExercise };
}

// ── Internal pipeline ────────────────────────────────────────────

function executeTemplate(
  template: TaskTemplate,
  ontology: OntologyData,
): GeneratedTask {
  // 1. Generator: fill slots
  const gen = template.pipeline.generator;
  const slots: SlotValues = runGenerator(gen.id, gen.params, ontology);

  // 2. Solvers: compute answer (run all solvers, last result wins)
  let solverResult: SolverResult = { answer: '' };
  for (const solver of template.pipeline.solvers) {
    solverResult = runSolver(solver.id, solver.params, slots, ontology);
  }

  // 3. Render prompt
  const renderCtx: RenderContext = {
    promptTemplates: ontology.promptTemplates,
    properties: ontology.properties,
    morphology: ontology.morphology,
  };
  const question = renderPrompt(template.prompt_template_id, slots, renderCtx);

  // 4. Render explanation (use explanation_template_id if available, else empty)
  let explanation = '';
  if (template.explanation_template_id) {
    try {
      // Merge solver explanation_slots into slots for rendering
      const explSlots: SlotValues = {
        ...slots,
        ...(solverResult.explanation_slots ?? {}),
        correct_answer: String(solverResult.answer),
      };
      explanation = renderPrompt(template.explanation_template_id, explSlots, renderCtx);
    } catch {
      // Explanation template may not exist yet — fail gracefully
      explanation = '';
    }
  }

  // 5. Distractors
  const distractors = generateDistractors(
    solverResult.answer,
    slots,
    template.meta.interaction,
    ontology,
    3,
  );

  // 6. Difficulty estimate (midpoint of target band)
  const [lo, hi] = template.difficulty_model.target_band;
  const difficulty = (lo + hi) / 2;

  // 7. Competency map
  const competency_map: Record<string, 'P' | 'S'> = template.competency_hint ?? {};

  return {
    template_id: template.template_id,
    interaction: template.meta.interaction,
    question,
    correct_answer: solverResult.answer,
    distractors,
    explanation,
    competency_map,
    difficulty,
    exam_tags: template.exam_tags ?? [],
    slots,
  };
}
