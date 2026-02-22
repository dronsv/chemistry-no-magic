import type { SupportedLocale } from '../../types/i18n';
import SubstanceCatalog from './SubstanceCatalog';
import ClassificationTheoryPanel from './ClassificationTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './substances.css';

export default function SubstancesPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  return (
    <div className="substances-page">
      <SubstanceCatalog locale={locale} />
      <ClassificationTheoryPanel />
      <PracticeSection locale={locale} />
    </div>
  );
}
