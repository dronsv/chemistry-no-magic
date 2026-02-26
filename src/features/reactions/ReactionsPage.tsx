import { useState } from 'react';
import type { SupportedLocale } from '../../types/i18n';
import ReactionCards from './ReactionCards';
import ReactionTheoryPanel from './ReactionTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './reactions.css';

export default function ReactionsPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  const [filter, setFilter] = useState('all');
  return (
    <div className="reactions-page">
      <ReactionCards locale={locale} filter={filter} onFilterChange={setFilter} />
      <ReactionTheoryPanel activeFilter={filter} />
      <PracticeSection locale={locale} />
    </div>
  );
}
