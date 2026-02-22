export type SearchCategory = 'element' | 'substance' | 'reaction' | 'competency' | 'page' | 'ion';

export interface SearchIndexEntry {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  search: string;
  url: string;
  meta?: Record<string, string>;
}
