import { describe, it, expect } from 'vitest';
import { createRegistry } from '../template-registry';
import type { TaskTemplate } from '../types';

const MOCK_TEMPLATES: TaskTemplate[] = [
  {
    template_id: 'tmpl.pt.compare_property.v1',
    meta: {
      interaction: 'choice_single',
      objects: ['element', 'property'],
      reasoning: ['ordering_by_trend'],
      evaluation: { mode: 'exact' },
    },
    pipeline: {
      generator: { id: 'gen.pick_element_pair', params: {} },
      solvers: [{ id: 'solver.compare_property', params: {} }],
      renderers: [{ id: 'view.choice_single', params: {} }],
    },
    prompt_template_id: 'prompt.compare_property',
    explanation_template_id: 'explain.compare_property',
    evidence_rules: ['use_period_trend'],
    difficulty_model: { features: {}, target_band: [0.25, 0.55] },
    exam_tags: ['oge'],
    competency_hint: { periodic_trends: 'P' },
  },
  {
    template_id: 'tmpl.ox.determine_state.v1',
    meta: {
      interaction: 'numeric_input',
      objects: ['substance', 'element'],
      reasoning: ['constraint_satisfaction'],
      evaluation: { mode: 'exact' },
    },
    pipeline: {
      generator: { id: 'gen.pick_oxidation_example', params: {} },
      solvers: [{ id: 'solver.oxidation_states', params: {} }],
      renderers: [{ id: 'view.numeric_input', params: {} }],
    },
    prompt_template_id: 'prompt.determine_oxidation_state',
    explanation_template_id: 'explain.determine_oxidation_state',
    evidence_rules: ['determine_oxidation_state'],
    difficulty_model: { features: {}, target_band: [0.25, 0.7] },
    exam_tags: ['oge', 'ege'],
    competency_hint: { oxidation_states: 'P' },
  },
];

describe('TemplateRegistry', () => {
  it('getById returns template by ID', () => {
    const reg = createRegistry(MOCK_TEMPLATES);
    const tmpl = reg.getById('tmpl.pt.compare_property.v1');
    expect(tmpl).toBeDefined();
    expect(tmpl!.meta.interaction).toBe('choice_single');
  });

  it('getById returns undefined for unknown ID', () => {
    const reg = createRegistry(MOCK_TEMPLATES);
    expect(reg.getById('nonexistent')).toBeUndefined();
  });

  it('getByExamTag filters by exam tag', () => {
    const reg = createRegistry(MOCK_TEMPLATES);
    const oge = reg.getByExamTag('oge');
    expect(oge).toHaveLength(2);
    const ege = reg.getByExamTag('ege');
    expect(ege).toHaveLength(1);
    expect(ege[0].template_id).toBe('tmpl.ox.determine_state.v1');
  });

  it('getByCompetency filters by competency hint', () => {
    const reg = createRegistry(MOCK_TEMPLATES);
    const trends = reg.getByCompetency('periodic_trends');
    expect(trends).toHaveLength(1);
    expect(trends[0].template_id).toBe('tmpl.pt.compare_property.v1');
  });

  it('all returns all templates', () => {
    const reg = createRegistry(MOCK_TEMPLATES);
    expect(reg.all()).toHaveLength(2);
  });
});
