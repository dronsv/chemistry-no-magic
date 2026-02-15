import type { Element, MetalType } from '../../types/element';
import type { ElectronConfigException } from '../../types/electron-config';
import { getValenceElectrons, isException, getShorthandFormula } from '../../lib/electron-config';
import ElectronFormula from './ElectronFormula';
import OrbitalBoxDiagram from './OrbitalBoxDiagram';
import EnergyLevelDiagram from './EnergyLevelDiagram';

const METAL_TYPE_RU: Record<MetalType, string> = {
  metal: 'Металл',
  nonmetal: 'Неметалл',
  metalloid: 'Металлоид',
};

interface Props {
  element: Element;
  exceptions: ElectronConfigException[];
  onClose: () => void;
}

export default function ElementDetailPanel({ element, exceptions, onClose }: Props) {
  const Z = element.Z;
  const valence = getValenceElectrons(Z);
  const valenceCount = valence.reduce((s, v) => s + v.electrons, 0);
  const oxStates = element.typical_oxidation_states
    .map(s => (s > 0 ? `+${s}` : String(s)))
    .join(', ');
  const exception = isException(Z)
    ? exceptions.find(e => e.Z === Z)
    : null;

  return (
    <div className="detail-panel">
      <button
        className="detail-panel__close"
        onClick={onClose}
        type="button"
        aria-label="Закрыть"
      >
        &times;
      </button>

      {/* Header */}
      <div className="detail-panel__header">
        <span className="detail-panel__z">Z={Z}</span>
        <span className="detail-panel__symbol">{element.symbol}</span>
        <span className="detail-panel__name">{element.name_ru}</span>
      </div>
      <div className="detail-panel__meta">
        Период {element.period} · Группа {element.group} · {METAL_TYPE_RU[element.metal_type]}
      </div>

      {/* Orbital diagram — full width, right after header */}
      <div className="detail-panel__orbital-full">
        <OrbitalBoxDiagram Z={Z} />
      </div>

      {/* Formula + Energy diagram side by side */}
      <div className="detail-panel__vizs">
        <ElectronFormula Z={Z} />
        <EnergyLevelDiagram Z={Z} />
      </div>

      {/* Properties */}
      <div className="detail-panel__props">
        <div className="detail-panel__prop">
          <span className="detail-panel__prop-label">Валентные электроны</span>
          <span className="detail-panel__prop-value">{valenceCount}</span>
        </div>
        <div className="detail-panel__prop">
          <span className="detail-panel__prop-label">Степени окисления</span>
          <span className="detail-panel__prop-value">{oxStates || '—'}</span>
        </div>
        <div className="detail-panel__prop">
          <span className="detail-panel__prop-label">Электроотрицательность</span>
          <span className="detail-panel__prop-value">{element.electronegativity ?? '—'}</span>
        </div>
      </div>

      {/* Exception block */}
      {exception && (
        <div className="detail-panel__exception">
          <strong>Провал электрона</strong>
          <div className="detail-panel__exception-compare">
            <span>Ожидаемая: <s>{exception.expected_formula}</s></span>
            <span>Реальная: <b>{exception.actual_formula}</b></span>
          </div>
          <p className="detail-panel__exception-reason">{exception.reason_ru}</p>
        </div>
      )}

      {/* Why these oxidation states */}
      {element.typical_oxidation_states.length > 0 && (
        <div className="detail-panel__why">
          <strong>Почему {element.symbol} проявляет СО {oxStates}?</strong>
          <p>
            Конфигурация валентных электронов: {getShorthandFormula(Z).split('] ')[1] || getShorthandFormula(Z)}.
            {' '}Всего {valenceCount} валентных электронов, которые могут участвовать в образовании химических связей.
          </p>
        </div>
      )}
    </div>
  );
}
