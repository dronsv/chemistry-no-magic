import { useState } from 'react';
import type { FacetState } from '../../types/reaction';
import type { SupportedLocale } from '../../types/i18n';
import { createEmptyFacetState } from './facet-filter';
import ReactionFacets from './ReactionFacets';
import ReactionCards from './ReactionCards';
import ReactionTheoryPanel from './ReactionTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './reactions.css';

export default function ReactionsPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [facets, setFacets] = useState<FacetState>(createEmptyFacetState);
  return (
    <div className="reactions-page">
      <ReactionCards locale={locale} facets={facets} onFacetsChange={setFacets} />
      <ReactionTheoryPanel facets={facets} locale={locale} />
      <PracticeSection locale={locale} />
    </div>
  );
}
