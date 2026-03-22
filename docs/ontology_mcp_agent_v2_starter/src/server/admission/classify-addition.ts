import type { AdditionType } from '../../shared/types';

export interface ClassifyAdditionInput {
  candidateText: string;
  nearestRefs: Array<{ ref: string; score: number }>;
  materialLanguage: string;
  context?: string;
}

export interface ClassifyAdditionResult {
  additionType: AdditionType;
  confidence: number;
  rationale: string;
  targetLayer: 'core' | 'localization_overlay' | 'search_overlay' | 'relations' | 'review_queue';
}

export function classifyAddition(input: ClassifyAdditionInput): ClassifyAdditionResult {
  if (input.nearestRefs[0]?.score >= 0.9) {
    return {
      additionType: 'alias_addition',
      confidence: 0.85,
      rationale: 'Strong nearest ref suggests existing concept coverage; prefer alias/search overlay.',
      targetLayer: 'search_overlay',
    };
  }

  return {
    additionType: 'new_core_entity',
    confidence: 0.4,
    rationale: 'No strong nearby ref found. Needs review before any core admission decision.',
    targetLayer: 'review_queue',
  };
}
