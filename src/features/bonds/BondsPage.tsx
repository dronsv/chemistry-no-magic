import type { SupportedLocale } from '../../types/i18n';
import BondCalculator from './BondCalculator';
import BondTheoryPanel from './BondTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './bonds.css';

export default function BondsPage({ locale = 'ru' as SupportedLocale }: { locale?: SupportedLocale }) {
  return (
    <div className="bonds-page">
      <BondCalculator locale={locale} />
      <BondTheoryPanel locale={locale} />
      <PracticeSection locale={locale} />
    </div>
  );
}
