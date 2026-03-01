import type { ReactNode } from 'react';
import type { RichText, TextSeg } from '../types/ontology-ref';
import type { SupportedLocale } from '../types/i18n';
import FormulaChip from './FormulaChip';
import OntologyRef from './OntologyRef';
import SmartText from './SmartText';

interface RichTextRendererProps {
  segments: RichText;
  locale?: SupportedLocale;
}

function renderSeg(seg: TextSeg, idx: number, locale?: SupportedLocale): ReactNode {
  switch (seg.t) {
    case 'text':
      // Run SmartText on plain text segments to detect remaining formulas/concepts
      return <SmartText key={idx} text={seg.v} locale={locale} />;
    case 'ref':
      return (
        <OntologyRef
          key={idx}
          id={seg.id}
          form={seg.form}
          surface={seg.surface}
          locale={locale}
        />
      );
    case 'formula':
      return (
        <FormulaChip
          key={idx}
          formula={seg.formula}
          substanceId={seg.kind === 'substance' ? seg.id : undefined}
          substanceClass={seg.kind === 'element' ? 'simple' : undefined}
          ionId={seg.kind === 'ion' ? seg.id : undefined}
          locale={locale}
        />
      );
    case 'br':
      return <br key={idx} />;
    case 'em':
      return <em key={idx}>{renderSegments(seg.children, locale)}</em>;
    case 'strong':
      return <strong key={idx}>{renderSegments(seg.children, locale)}</strong>;
    default:
      return null;
  }
}

function renderSegments(segments: RichText, locale?: SupportedLocale): ReactNode[] {
  return segments.map((seg, i) => renderSeg(seg, i, locale));
}

export default function RichTextRenderer({ segments, locale }: RichTextRendererProps) {
  return <>{renderSegments(segments, locale)}</>;
}
