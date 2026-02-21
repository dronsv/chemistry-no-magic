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
  name_ru: string;
  name_en: string;
  name_pl: string;
  name_es: string;
  description_ru: string;
  icon: string;
  color: string;
  competency_map: Record<string, TopicCompetencyLink[]>;
}
