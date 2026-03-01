import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { ConceptRegistry, ConceptOverlay, ConceptLookup } from '../types/ontology-ref';

export interface ConceptContextValue {
  registry: ConceptRegistry;
  overlay: ConceptOverlay;
  lookup: ConceptLookup;
}

const ConceptCtx = createContext<ConceptContextValue | null>(null);

export function ConceptProvider({
  value,
  children,
}: {
  value: ConceptContextValue | null;
  children: ReactNode;
}) {
  return <ConceptCtx.Provider value={value}>{children}</ConceptCtx.Provider>;
}

export function useConcepts(): ConceptContextValue | null {
  return useContext(ConceptCtx);
}
