/** A link from a unified topic to a specific exam system's competency. */
export interface TopicCompetencyLink {
  id: string;
  weight: number;
}

/** Normalized difficulty levels across all exam systems. */
export type NormalizedDifficulty = 'basic' | 'advanced' | 'expert';

/** A unified topic that maps competencies across multiple exam systems. */
export interface UnifiedTopic {
  topic_id: string;
  /** Topic name — provided by locale overlay. */
  name: string;
  /** Topic description — provided by locale overlay. */
  description: string;
  icon: string;
  color: string;
  competency_map: Record<string, TopicCompetencyLink[]>;
}
