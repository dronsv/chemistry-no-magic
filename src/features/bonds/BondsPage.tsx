import BondCalculator from './BondCalculator';
import BondTheoryPanel from './BondTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './bonds.css';

export default function BondsPage() {
  return (
    <div className="bonds-page">
      <BondCalculator />
      <BondTheoryPanel />
      <PracticeSection />
    </div>
  );
}
