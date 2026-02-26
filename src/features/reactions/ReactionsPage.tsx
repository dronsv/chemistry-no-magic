import type { SupportedLocale } from '../../types/i18n';
import ReactionCards from './ReactionCards';
import ReactionTheoryPanel from './ReactionTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './reactions.css';

export default function ReactionsPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  return (
    <div className="reactions-page">
      <ReactionCards locale={locale} />
      <ReactionTheoryPanel />
      <PracticeSection locale={locale} />
    </div>
  );
}
