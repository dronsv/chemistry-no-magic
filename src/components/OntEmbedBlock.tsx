import { useState, useEffect } from 'react';
import type { TheoryBlock } from '../types/theory-module';
import type { ConceptOverlay, ConceptRegistry } from '../types/ontology-ref';
import { loadConcepts, loadConceptOverlay } from '../lib/data-loader';
import type { SupportedLocale } from '../types/i18n';
import { localizeUrl, CONCEPT_KIND_ROUTES } from '../lib/i18n';
import FormulaChip from './FormulaChip';
import AcidStrengthScale from './AcidStrengthScale';
import OntInteractiveRef from './OntInteractiveRef';
import './ont-embed.css';

type OntEmbedBlockType = TheoryBlock & { t: 'ont_embed' };

interface Props {
  block: OntEmbedBlockType;
  locale: string;
}

/** Build concept page URL by walking parent_id chain for slug hierarchy */
function buildConceptUrl(
  conceptId: string,
  registry: ConceptRegistry,
  overlay: ConceptOverlay,
  locale: SupportedLocale,
): string {
  const entry = registry[conceptId];
  if (!entry) return '#';
  const ov = overlay[conceptId];
  if (!ov) return '#';

  const slugs: string[] = [];
  let current: string | null = conceptId;
  while (current) {
    const curOv = overlay[current];
    if (curOv) slugs.unshift(curOv.slug);
    current = registry[current]?.parent_id ?? null;
  }

  const base = CONCEPT_KIND_ROUTES[entry.kind] ?? '/';
  const path = base + slugs.join('/') + '/';
  return localizeUrl(path, locale);
}

export default function OntEmbedBlock({ block, locale }: Props) {
  const loc = locale as SupportedLocale;
  const [registry, setRegistry] = useState<ConceptRegistry | null>(null);
  const [overlay, setOverlay] = useState<ConceptOverlay | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadConcepts(), loadConceptOverlay(loc)])
      .then(([reg, ov]) => {
        if (cancelled) return;
        setRegistry(reg);
        setOverlay(ov);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => { cancelled = true; };
  }, [loc]);

  if (loadError) return null;
  if (!registry || !overlay) return null;

  const entry = registry[block.concept_id];
  const ov = overlay[block.concept_id];

  if (!entry || !ov) {
    // Fallback: render concept_id as plain text
    return <span>{block.concept_id}</span>;
  }

  const conceptName = ov.name;
  const description = ov.description;

  if (block.mode === 'OntRef') {
    const canLink = entry.kind !== 'domain_concept';
    const href = canLink
      ? buildConceptUrl(block.concept_id, registry, overlay, loc)
      : null;

    const refContent = (
      <span className="ont-embed-ref">
        {href ? (
          <a href={href}>{conceptName}</a>
        ) : (
          <span>{conceptName}</span>
        )}
      </span>
    );

    return (
      <OntInteractiveRef
        entityRef={block.concept_id}
        display={refContent}
        locale={locale}
      />
    );
  }

  if (block.mode === 'OntDef') {
    return (
      <div className="ont-embed-def">
        <h4 className="ont-embed-def__title">{conceptName}</h4>
        {description && (
          <p className="ont-embed-def__description">{description}</p>
        )}
      </div>
    );
  }

  // OntBlock mode
  const showChars = block.include?.characteristics;
  const showExamples = block.include?.examples;

  return (
    <div className="ont-embed-block">
      <h3 className="ont-embed-block__title">{conceptName}</h3>
      {description && (
        <p className="ont-embed-block__description">{description}</p>
      )}
      {showExamples && entry.examples && entry.examples.length > 0 && (
        <div className="ont-embed-block__examples">
          {entry.examples
            .filter((ex: { kind: string }) => ex.kind === 'substance')
            .map((ex: { kind: string; id: string }) => (
              <FormulaChip
                key={ex.id}
                formula={ex.id}
                substanceId={`sub:${ex.id}`}
                locale={loc}
              />
            ))}
        </div>
      )}
      {showChars && block.concept_id === 'concept:acid_strength' && (
        <AcidStrengthScale locale={locale} />
      )}
    </div>
  );
}
