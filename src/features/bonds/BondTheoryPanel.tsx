import { useState, useEffect } from 'react';
import type { BondTheory, BondTypeInfo, CrystalStructureInfo } from '../../types/bond';
import { loadBondTheory } from '../../lib/data-loader';

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`theory-section ${open ? 'theory-section--open' : ''}`}>
      <button
        type="button"
        className="theory-section__toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="theory-section__title">{title}</span>
        <span className="theory-section__arrow">{open ? '\u25BE' : '\u25B8'}</span>
      </button>
      {open && <div className="theory-section__body">{children}</div>}
    </div>
  );
}

function BondTypeCard({ info }: { info: BondTypeInfo }) {
  return (
    <div className="bond-theory__rule">
      <div className="bond-theory__rule-header">{info.name_ru}</div>
      <p className="bond-theory__rule-text">
        <strong>Правило:</strong> {info.rule_ru}
      </p>
      <p className="bond-theory__rule-text">{info.description_ru}</p>
      <p className="bond-theory__rule-text">
        <strong>Свойства:</strong> {info.properties_ru}
      </p>
      <div className="bond-theory__rule-examples">
        Примеры: {info.examples.join(', ')}
      </div>
    </div>
  );
}

function CrystalComparisonTable({ structures }: { structures: CrystalStructureInfo[] }) {
  return (
    <div className="crystal-table-wrapper">
      <table className="crystal-table">
        <thead>
          <tr>
            <th>Тип</th>
            <th>В узлах</th>
            <th>Т.пл.</th>
            <th>Твёрдость</th>
            <th>Проводимость</th>
            <th>Растворимость</th>
          </tr>
        </thead>
        <tbody>
          {structures.map(s => (
            <tr key={s.id}>
              <td className="crystal-table__type">{s.name_ru}</td>
              <td>{s.description_ru}</td>
              <td>{s.properties.melting_point_ru}</td>
              <td>{s.properties.hardness_ru}</td>
              <td>{s.properties.conductivity_ru}</td>
              <td>{s.properties.solubility_ru}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BondTheoryPanel() {
  const [theory, setTheory] = useState<BondTheory | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || theory) return;
    setLoading(true);
    loadBondTheory()
      .then(data => {
        setTheory(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        setLoading(false);
      });
  }, [open, theory]);

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>Теория</span>
        <span className="theory-panel__trigger-arrow">{open ? '\u25BE' : '\u25B8'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">Загрузка...</div>}
          {error && <div className="theory-panel__error">{error}</div>}

          {theory && (
            <>
              <h3 className="theory-panel__heading">Типы химической связи</h3>
              {theory.bond_types.map(bt => (
                <CollapsibleSection key={bt.id} title={bt.name_ru}>
                  <BondTypeCard info={bt} />
                </CollapsibleSection>
              ))}

              <h3 className="theory-panel__heading">Сравнение кристаллических решёток</h3>
              <CrystalComparisonTable structures={theory.crystal_structures} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
