import type { OntologyIndex } from '../../../shared/types.js';

interface Gap {
  type: string;
  ref: string;
  locale?: string;
  detail?: string;
}

interface CoverageResult {
  summary: {
    total_entities: number;
    translations: Record<string, { covered: number; missing: number }>;
    characteristics: { with_any: number; without: number };
    relations: { with_any: number; orphaned: number };
  };
  gaps: Gap[];
}

const ALL_LOCALES = ['ru', 'en', 'pl', 'es'];

export function coverageReport(
  index: OntologyIndex,
  args: {
    kind: string;
    check: 'translations' | 'characteristics' | 'relations' | 'all';
    locales?: string[];
  },
): CoverageResult {
  const locales = args.locales ?? ALL_LOCALES;
  const checkTranslations = args.check === 'translations' || args.check === 'all';
  const checkCharacteristics = args.check === 'characteristics' || args.check === 'all';
  const checkRelations = args.check === 'relations' || args.check === 'all';

  let entities = Array.from(index.entitiesByRef.values());
  if (args.kind !== 'all') {
    entities = entities.filter(e => e.kind === args.kind);
  }

  const gaps: Gap[] = [];

  // Translation coverage
  const translations: Record<string, { covered: number; missing: number }> = {};
  if (checkTranslations) {
    for (const locale of locales) {
      let covered = 0;
      let missing = 0;
      for (const entity of entities) {
        if (entity.labels[locale]) {
          covered++;
        } else {
          missing++;
          gaps.push({ type: 'missing_translation', ref: entity.ref, locale });
        }
      }
      translations[locale] = { covered, missing };
    }
  }

  // Characteristics coverage (substances only — they have tags as proxy)
  const characteristics: { with_any: number; without: number } = { with_any: 0, without: 0 };
  if (checkCharacteristics) {
    const substances = entities.filter(e => e.kind === 'substance');
    for (const sub of substances) {
      if (sub.tags && sub.tags.length > 0) {
        characteristics.with_any++;
      } else {
        characteristics.without++;
        gaps.push({ type: 'no_characteristics', ref: sub.ref });
      }
    }
  }

  // Relation coverage
  let relWithAny = 0;
  let relOrphaned = 0;
  if (checkRelations) {
    for (const entity of entities) {
      const hasOutgoing = index.relations.bySubject.has(entity.ref);
      const hasIncoming = index.relations.byObject.has(entity.ref);
      if (hasOutgoing || hasIncoming) {
        relWithAny++;
      } else {
        relOrphaned++;
        gaps.push({ type: 'orphaned_entity', ref: entity.ref, detail: 'no relations' });
      }
    }

    // Substance-specific: acids without conjugate base
    if (args.kind === 'substance' || args.kind === 'all') {
      const substances = entities.filter(e => e.kind === 'substance');
      for (const sub of substances) {
        const outgoing = index.relations.bySubject.get(sub.ref) ?? [];
        const incoming = index.relations.byObject.get(sub.ref) ?? [];
        const allRels = [...outgoing, ...incoming];

        const isAcid = allRels.some(r => r.predicate === 'instance_of' && r.object === 'cls:acid');
        if (isAcid) {
          const hasConjugate = allRels.some(r =>
            r.predicate === 'has_conjugate_base' || r.predicate === 'has_conjugate_acid'
          );
          if (!hasConjugate) {
            gaps.push({
              type: 'missing_conjugate',
              ref: sub.ref,
              detail: 'acid with no conjugate_base relation',
            });
          }
        }
      }
    }

    // Concept-specific: no examples (no instance_of pointing to concept)
    if (args.kind === 'substance_class' || args.kind === 'concept' || args.kind === 'all') {
      const concepts = entities.filter(e =>
        e.kind === 'substance_class' || e.kind === 'concept'
      );
      for (const concept of concepts) {
        const incoming = index.relations.byObject.get(concept.ref) ?? [];
        const hasExamples = incoming.some(r => r.predicate === 'instance_of');
        if (!hasExamples) {
          gaps.push({
            type: 'concept_no_examples',
            ref: concept.ref,
            detail: 'no instance_of relations pointing to this concept',
          });
        }
      }
    }
  }

  return {
    summary: {
      total_entities: entities.length,
      translations,
      characteristics,
      relations: { with_any: relWithAny, orphaned: relOrphaned },
    },
    gaps,
  };
}
