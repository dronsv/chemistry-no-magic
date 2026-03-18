// src/types/ont-preview.ts

import type { Variable } from './formula';

export interface PreviewFact {
  label: string;
  value: string;
  unit?: string;
}

export interface PreviewChip {
  label: string;
  variant?: 'default' | 'primary' | 'muted';
}

export interface PreviewAction {
  label: string;
  href: string;
}

export interface OntPreviewData {
  title: string;
  subtitle?: string;
  description?: string;
  facts?: PreviewFact[];
  chips?: PreviewChip[];
  primaryAction?: PreviewAction;
}

export interface ResolvedOntPreview {
  target: {
    ref: string;
    subjectKind: 'entity' | 'formula_variable' | 'formula';
    canonicalHref?: string;
  };
  data: OntPreviewData;
}

export interface PreviewContext {
  sourceRef?: string;
  formulaRef?: string;
  substanceRef?: string;
  deprotonationStep?: number;
  profile?: 'default' | 'acid_base' | 'solubility' | 'redox';
}

export type OntPreviewRequest =
  | { subjectKind: 'entity'; ref: string; locale: string; context?: PreviewContext }
  | { subjectKind: 'formula'; ref: string; locale: string; context?: PreviewContext }
  | { subjectKind: 'formula_variable'; variable: Variable; formulaId: string; locale: string; context?: PreviewContext };
