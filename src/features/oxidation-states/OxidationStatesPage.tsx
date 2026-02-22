import type { SupportedLocale } from '../../types/i18n';
import OxidationCalculator from './OxidationCalculator';
import OxidationTheoryPanel from './OxidationTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './oxidation-states.css';

export default function OxidationStatesPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  return (
    <div className="oxidation-page">
      <OxidationCalculator />
      <OxidationTheoryPanel />
      <PracticeSection locale={locale} />
    </div>
  );
}
