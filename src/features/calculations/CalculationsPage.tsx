import CalculationsTheoryPanel from './CalculationsTheoryPanel';
import PracticeSection from './practice/PracticeSection';
import './calculations.css';

export default function CalculationsPage() {
  return (
    <div className="calculations-page">
      <h1 className="calculations-page__title">Расчёты по химии</h1>
      <p className="calculations-page__intro">
        Молярная масса, количество вещества, массовая доля, расчёты по уравнениям реакций и выход продукта.
      </p>
      <CalculationsTheoryPanel />
      <PracticeSection />
    </div>
  );
}
