import type { Element, MetalType } from '../../types/element';
import type { ElectronConfigException } from '../../types/electron-config';

const METAL_TYPE_RU: Record<MetalType, string> = {
  metal: 'Металл',
  nonmetal: 'Неметалл',
  metalloid: 'Металлоид',
};

interface ElementDetailsProps {
  element: Element;
  exceptions?: ElectronConfigException[];
  onClose: () => void;
}

export default function ElementDetails({ element, exceptions, onClose }: ElementDetailsProps) {
  const oxStates = element.typical_oxidation_states
    .map((s) => (s > 0 ? `+${s}` : String(s)))
    .join(', ');

  const exception = exceptions?.find(e => e.Z === element.Z);

  return (
    <div className="pt-details">
      <button
        className="pt-details__close"
        onClick={onClose}
        type="button"
        aria-label="Закрыть"
      >
        &times;
      </button>

      <div className="pt-details__header">
        <span className="pt-details__z">{element.Z}</span>
        <span className="pt-details__symbol">{element.symbol}</span>
      </div>

      <h3 className="pt-details__name">{element.name_ru}</h3>

      <dl className="pt-details__props">
        <dt>Атомная масса</dt>
        <dd>{element.atomic_mass}</dd>

        <dt>Группа</dt>
        <dd>{element.group}</dd>

        <dt>Период</dt>
        <dd>{element.period}</dd>

        <dt>Тип</dt>
        <dd>{METAL_TYPE_RU[element.metal_type]}</dd>

        <dt>Степени окисления</dt>
        <dd>{oxStates || '—'}</dd>

        <dt>Электроотрицательность</dt>
        <dd>{element.electronegativity ?? '—'}</dd>
      </dl>

      {exception && (
        <p className="pt-details__exception-note">
          ⚠ Провал электрона: {exception.reason_ru}
        </p>
      )}
    </div>
  );
}
