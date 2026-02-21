import type { Element } from '../../types/element';
import type { ElementGroupDict } from '../../types/element-group';
import * as m from '../../paraglide/messages.js';

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
        aria-label={m.close_label()}
      >
        &times;
      </button>

      <div className="pt-details__header">
        <span className="pt-details__z">{element.Z}</span>
        <span className="pt-details__symbol">{element.symbol}</span>
      </div>

      <h3 className="pt-details__name">{element.name_ru}</h3>

      <dl className="pt-details__props">
        <dt>{m.elem_atomic_mass()}</dt>
        <dd>{element.atomic_mass}</dd>

        <dt>{m.elem_group()}</dt>
        <dd>{element.group}</dd>

        <dt>{m.elem_period()}</dt>
        <dd>{element.period}</dd>

        <dt>{m.elem_type()}</dt>
        <dd>{groupInfo?.name_singular_ru ?? element.element_group}</dd>

        <dt>{m.elem_oxidation_states()}</dt>
        <dd>{oxStates || '—'}</dd>

        <dt>{m.elem_electronegativity()}</dt>
        <dd>{element.electronegativity ?? '—'}</dd>
      </dl>

      {exc && (
        <p className="pt-details__exception-note">
          {m.elem_exception_note({ reason: exc.reason_ru })}
        </p>
      )}
    </div>
  );
}
