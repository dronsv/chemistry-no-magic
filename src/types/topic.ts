export type CourseUnitKind = 'concept' | 'procedure' | 'comparison' | 'calculator';
export type ExampleRefKind = 'substance' | 'element' | 'ion';

export interface ExampleRef {
  kind: ExampleRefKind;
  /** substance id, element symbol, or ion id */
  id: string;
}

export interface TheoryRef {
  module: string;       // e.g. "module:bonds_and_crystals.v1"
  section_id: string;   // e.g. "bond_types"
  block_id: string | null; // null = render whole section; set = render single block
}

export interface TopicPractice {
  preferred_templates: string[];
  difficulty_range: [number, number];
  allowed_examples: string[];
}

export interface Topic {
  id: string;               // "topic:ionic_bond"
  section: string;          // parent section url slug (ru), e.g. "bonds"
  slug: string;             // topic url slug, e.g. "ionic"
  course_unit_kind: CourseUnitKind;
  title: string;
  summary: string;
  competency_ids: string[];
  theory_refs: TheoryRef[];
  example_refs: ExampleRef[];
  related_topic_ids: string[];
  practice: TopicPractice;
}

/** SEO/delivery overlay keyed by topic id */
export interface TopicPage {
  seo_title: string;
  search_aliases: string[];
  faq: FAQItem[];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export type TopicPagesMap = Record<string, TopicPage>;

/** Build-time locale overlay shape (keyed by topic id) */
export type TopicLocaleOverlay = Record<string, {
  slug?: string;
  title?: string;
  summary?: string;
}>;

export type TopicPageLocaleOverlay = Record<string, {
  seo_title?: string;
  search_aliases?: string[];
  faq?: FAQItem[];
}>;
