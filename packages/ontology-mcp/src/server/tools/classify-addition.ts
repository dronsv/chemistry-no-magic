import type { OntologyIndex, AdditionType } from '../../shared/types.js';
import { searchEntities } from './search-entities.js';

interface ClassifyResult {
  addition_type: AdditionType;
  confidence: number;
  rationale: string;
  recommended_target_layer: string;
}

export function classifyAddition(
  index: OntologyIndex,
  args: {
    candidate_text: string;
    material_language: string;
    context?: string;
    nearest_refs?: string[];
  }
): ClassifyResult {
  const { candidate_text, material_language, nearest_refs } = args;

  // Step 1: Search for existing matches
  const searchResult = searchEntities(index, { query: candidate_text, limit: 5 });
  const topScore = searchResult.candidates[0]?.score ?? 0;
  const topRef = searchResult.candidates[0]?.ref;

  // Step 2: Already a known alias/label
  if (topScore >= 0.95) {
    return {
      addition_type: 'alias_addition',
      confidence: topScore,
      rationale: `'${candidate_text}' closely matches existing ref '${topRef}'. Likely an alias or exact match.`,
      recommended_target_layer: 'search_overlay',
    };
  }

  // Step 3: Check nearest_refs for locale/alias gap
  if (nearest_refs?.length) {
    const nearestEntity = index.entitiesByRef.get(nearest_refs[0]);
    if (nearestEntity) {
      const hasLabelInLang = nearestEntity.labels[material_language];
      if (!hasLabelInLang) {
        return {
          addition_type: 'overlay_addition',
          confidence: 0.85,
          rationale: `Entity '${nearest_refs[0]}' exists but lacks a ${material_language} label. '${candidate_text}' is a localization candidate.`,
          recommended_target_layer: 'localization_overlay',
        };
      }

      if (topScore >= 0.7) {
        return {
          addition_type: 'alias_addition',
          confidence: topScore,
          rationale: `'${candidate_text}' is a variant of existing ref '${nearest_refs[0]}'.`,
          recommended_target_layer: 'search_overlay',
        };
      }
    }
  }

  // Step 4: Partial match — relation or extension
  if (topScore >= 0.5) {
    return {
      addition_type: 'relation_addition',
      confidence: 0.6,
      rationale: `'${candidate_text}' partially matches '${topRef}'. May need a relation rather than a new entity.`,
      recommended_target_layer: 'relations',
    };
  }

  // Step 5: No match — new core entity candidate
  return {
    addition_type: 'new_core_entity',
    confidence: 0.4,
    rationale: `'${candidate_text}' has no close match in the ontology. Requires human review before adding to core.`,
    recommended_target_layer: 'proposal_queue',
  };
}
