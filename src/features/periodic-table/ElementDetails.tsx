import type { Element } from '../../types/element';
import type { ElementGroupDict } from '../../types/element-group';

interface ElementDetailsProps {
  element: Element;
  groups: ElementGroupDict;
  onClose: () => void;
}

export default function ElementDetails({ element, groups, onClose }: ElementDetailsProps) {
  const oxStates = element.typical_oxidation_states
    .map((s) => (s > 0 ? `+${s}` : String(s)))
    .join(', ');

  const exc = element.electron_exception;
  const groupInfo = groups[element.element_group];

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
        <dd>{groupInfo?.name_singular_ru ?? element.element_group}</dd>

        <dt>Степени окисления</dt>
        <dd>{oxStates || '—'}</dd>

        <dt>Электроотрицательность</dt>
        <dd>{element.electronegativity ?? '—'}</dd>
      </dl>

      {exc && (
        <p className="pt-details__exception-note">
          ⚠ Провал электрона: {exc.reason_ru}
        </p>
      )}
    </div>
  );
}
