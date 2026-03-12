import type { Element } from '../../types/element';
import type { ElementGroupDict } from '../../types/element-group';
import type { SupportedLocale } from '../../types/i18n';
import { localizeUrl } from '../../lib/i18n';
import * as m from '../../paraglide/messages.js';

interface ElementDetailsProps {
  element: Element;
  groups: ElementGroupDict;
  locale?: SupportedLocale;
  onClose: () => void;
}

export default function ElementDetails({ element, groups, locale = 'ru', onClose }: ElementDetailsProps) {
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

      <a href={localizeUrl(`/periodic-table/${element.symbol}/`, locale)} className="pt-details__header pt-details__header--link">
        <span className="pt-details__z">{element.Z}</span>
        <span className="pt-details__symbol">{element.symbol}</span>
        <span className="pt-details__name">{element.name}</span>
      </a>

      <dl className="pt-details__props">
        <dt>{m.elem_atomic_mass()}</dt>
        <dd>{element.atomic_mass}</dd>

        <dt>{m.elem_group()}</dt>
        <dd>{element.group}</dd>

        <dt>{m.elem_period()}</dt>
        <dd>{element.period}</dd>

        <dt>{m.elem_type()}</dt>
        <dd>{groupInfo?.name_singular ?? element.element_group}</dd>

        <dt>{m.elem_oxidation_states()}</dt>
        <dd>{oxStates || '—'}</dd>

        <dt>{m.elem_electronegativity()}</dt>
        <dd>{element.electronegativity ?? '—'}</dd>
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
