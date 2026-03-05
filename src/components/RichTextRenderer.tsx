import type { ReactNode } from 'react';
import type { RichText, TextSeg } from '../types/ontology-ref';
import type { SupportedLocale } from '../types/i18n';
import type { FormulaLookup } from '../types/formula-lookup';
import FormulaChip from './FormulaChip';
import OntologyRef from './OntologyRef';
import { parseOntRef } from '../lib/ontology-ref';
import SmartText from './SmartText';
import { useFormulaLookup } from './ChemText';

interface RichTextRendererProps {
  segments: RichText;
  locale?: SupportedLocale;
}

function renderSeg(seg: TextSeg, idx: number, locale?: SupportedLocale, lookup?: FormulaLookup | null): ReactNode {
  switch (seg.t) {
    case 'text':
      // Run SmartText on plain text segments to detect remaining formulas/concepts
      return <SmartText key={idx} text={seg.v} locale={locale} />;
    case 'ref': {
      let ontRef;
      try {
        ontRef = parseOntRef(seg.id);
      } catch {
        return <span key={idx}>{seg.surface ?? seg.id}</span>;
      }
      return (
        <OntologyRef
          key={idx}
          ontRef={ontRef}
          form={seg.form}
          surface={seg.surface}
          locale={locale}
        />
      );
    }
    case 'formula': {
      const entry = lookup?.[seg.formula];
      return (
        <FormulaChip
          key={idx}
          formula={seg.formula}
          substanceId={seg.kind === 'substance' ? seg.id : (entry?.type === 'substance' ? entry.id : undefined)}
          substanceClass={
            seg.kind === 'element' ? 'simple'
            : entry?.type === 'substance' ? entry.cls
            : undefined
          }
          ionId={seg.kind === 'ion' ? seg.id : (entry?.type === 'ion' ? entry.id : undefined)}
          elementId={seg.kind === 'element' ? seg.id : (entry?.type === 'element' ? entry.id : undefined)}
          locale={locale}
        />
      );
    }
    case 'br':
      return <br key={idx} />;
    case 'em':
      return <em key={idx}>{renderSegments(seg.children, locale, lookup)}</em>;
    case 'strong':
      return <strong key={idx}>{renderSegments(seg.children, locale, lookup)}</strong>;
    default:
      return null;
  }
}

function renderSegments(segments: RichText, locale?: SupportedLocale, lookup?: FormulaLookup | null): ReactNode[] {
  return segments.map((seg, i) => renderSeg(seg, i, locale, lookup));
}

export default function RichTextRenderer({ segments, locale }: RichTextRendererProps) {
  const lookup = useFormulaLookup();
  return <>{renderSegments(segments, locale, lookup)}</>;
}
