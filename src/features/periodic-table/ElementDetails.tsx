import type { Element } from '../../types/element';
import type { ElementGroupDict } from '../../types/element-group';
import type { SupportedLocale } from '../../types/i18n';
import type { TypedCharacteristic } from '../../types/characteristic';
import { localizeUrl } from '../../lib/i18n';
import { getCharacteristicValue } from '../../lib/characteristics-utils';
import * as m from '../../paraglide/messages.js';

interface ElementDetailsProps {
  element: Element;
  groups: ElementGroupDict;
  locale?: SupportedLocale;
  charsBySubject?: Map<string, TypedCharacteristic[]>;
  onClose: () => void;
}

export default function ElementDetails({ element, groups, locale = 'ru', charsBySubject, onClose }: ElementDetailsProps) {
  const oxStates = element.typical_oxidation_states
    .map((s) => (s > 0 ? `+${s}` : String(s)))
    .join(', ');

  // Characteristics lookups with flat-field fallback
  const subjectChars = charsBySubject?.get(`el:${element.symbol}`);
  const atomicMass = (getCharacteristicValue(subjectChars, 'concept:atomic_mass') as number | undefined) ?? element.atomic_mass;
  const electronegativity = (getCharacteristicValue(subjectChars, 'concept:electronegativity') as number | undefined) ?? element.electronegativity;

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

      <a href={localizeUrl(`/periodic-table/${element.symbol}/`, locale)} className="pt-details__header pt-details__header--link">
        <span className="pt-details__z">{element.Z}</span>
        <span className="pt-details__symbol">{element.symbol}</span>
        <span className="pt-details__name">{element.name}</span>
      </a>

      <dl className="pt-details__props">
        <dt>{m.elem_atomic_mass()}</dt>
        <dd>{atomicMass}</dd>

        <dt>{m.elem_group()}</dt>
        <dd>{element.group}</dd>

        <dt>{m.elem_period()}</dt>
        <dd>{element.period}</dd>

        <dt>{m.elem_type()}</dt>
        <dd>{groupInfo?.name_singular ?? element.element_group}</dd>

        <dt>{m.elem_oxidation_states()}</dt>
        <dd>{oxStates || '—'}</dd>

        <dt>{m.elem_electronegativity()}</dt>
        <dd>{electronegativity ?? '—'}</dd>
      </dl>

      {exc?.reason && (
        <p className="pt-details__exception-note">
          {m.elem_exception_note({ reason: exc.reason })}
          {exc.stabilization?.bridge_id && (
            <a
              href={`/physical-foundations/#${exc.stabilization.bridge_id}`}
              className="pt-details__exception-link"
            >
              {m.elem_exception_deep_link()}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
