import type { TaskTemplate } from './types';

export interface TemplateRegistry {
  getById(id: string): TaskTemplate | undefined;
  getByExamTag(tag: string): TaskTemplate[];
  getByCompetency(competencyId: string): TaskTemplate[];
  all(): TaskTemplate[];
}

export function createRegistry(templates: TaskTemplate[]): TemplateRegistry {
  const byId = new Map<string, TaskTemplate>();
  for (const t of templates) {
    byId.set(t.template_id, t);
  }

  return {
    getById: (id) => byId.get(id),

    getByExamTag: (tag) =>
      templates.filter(t => t.exam_tags?.includes(tag)),

    getByCompetency: (competencyId) =>
      templates.filter(t => t.competency_hint?.[competencyId] !== undefined),

    all: () => [...templates],
  };
}
