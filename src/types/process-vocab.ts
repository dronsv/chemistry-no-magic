export type ProcessKind = 'chemical' | 'operation' | 'physical' | 'physchem' | 'constraint';

export interface ProcessVocabEntry {
  id: string;
  kind: ProcessKind;
  name_ru: string;
  description_ru: string;
  params?: string[];
}
