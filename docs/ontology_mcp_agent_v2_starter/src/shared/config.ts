export interface LookupConfig {
  materialLanguage: string;
  fallbackLanguages: string[];
  defaultLimit: number;
  autoBindThreshold: number;
  reviewThreshold: number;
  semanticRecallEnabled: boolean;
}

export const DEFAULT_LOOKUP_CONFIG: LookupConfig = {
  materialLanguage: 'ru',
  fallbackLanguages: ['en'],
  defaultLimit: 10,
  autoBindThreshold: 0.9,
  reviewThreshold: 0.7,
  semanticRecallEnabled: false,
};
