import type { Element } from '../../types/element';
import type { ElementGroupDict } from '../../types/element-group';
import type { SupportedLocale } from '../../types/i18n';
import { getValenceElectrons, getShorthandFormula } from '../../lib/electron-config';
import { localizeUrl } from '../../lib/i18n';
import * as m from '../../paraglide/messages.js';
import ElectronFormula from './ElectronFormula';
import OrbitalBoxDiagram from './OrbitalBoxDiagram';
import EnergyLevelDiagram from './EnergyLevelDiagram';

interface Props {
  element: Element;
  groups: ElementGroupDict;
  locale?: SupportedLocale;
  onClose: () => void;
}

export default function ElementDetailPanel({ element, groups, locale = 'ru', onClose }: Props) {
  const Z = element.Z;
  const valence = getValenceElectrons(Z);
  const valenceCount = valence.reduce((s, v) => s + v.electrons, 0);
  const oxStates = element.typical_oxidation_states
    .map(s => (s > 0 ? `+${s}` : String(s)))
    .join(', ');
  const exc = element.electron_exception;
  const groupInfo = groups[element.element_group];

  return (
    <div className="detail-panel">
      <button
        className="detail-panel__close"
        onClick={onClose}
        type="button"
        aria-label={m.close_label()}
      >
        &times;
      </button>

      {/* Header — clickable, navigates to element page */}
      <a href={localizeUrl(`/periodic-table/${element.symbol}/`, locale)} className="detail-panel__header detail-panel__header--link">
        <span className="detail-panel__z">Z={Z}</span>
        <span className="detail-panel__symbol">{element.symbol}</span>
        <span className="detail-panel__name">{element.name_ru}</span>
      </a>
      <div className="detail-panel__meta">
        {m.elem_period_group_meta({ period: String(element.period), group: String(element.group), type: groupInfo?.name_singular_ru ?? element.element_group })}
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
          <span className="detail-panel__prop-label">{m.elem_valence_electrons()}</span>
          <span className="detail-panel__prop-value">{valenceCount}</span>
        </div>
        <div className="detail-panel__prop">
          <span className="detail-panel__prop-label">{m.elem_oxidation_states()}</span>
          <span className="detail-panel__prop-value">{oxStates || '—'}</span>
        </div>
        <div className="detail-panel__prop">
          <span className="detail-panel__prop-label">{m.elem_electronegativity()}</span>
          <span className="detail-panel__prop-value">{element.electronegativity ?? '—'}</span>
        </div>
      </div>

      {/* Exception block */}
      {exc && (
        <div className="detail-panel__exception">
          <strong>{m.elem_electron_exception()}</strong>
          <div className="detail-panel__exception-compare">
            <span>{m.elem_expected()} <s>{exc.expected_formula}</s></span>
            <span>{m.elem_actual()} <b>{exc.actual_formula}</b></span>
          </div>
          <p className="detail-panel__exception-reason">{exc.reason_ru}</p>
        </div>
      )}

      {/* Why these oxidation states */}
      {element.typical_oxidation_states.length > 0 && (
        <div className="detail-panel__why">
          <strong>{m.elem_why_ox_states({ symbol: element.symbol, states: oxStates })}</strong>
          <p>
            {m.elem_valence_config_text({ config: getShorthandFormula(Z).split('] ')[1] || getShorthandFormula(Z), count: String(valenceCount) })}
          </p>
        </div>
      )}

      {/* Link to full element page */}
      <a
        href={localizeUrl(`/periodic-table/${element.symbol}/`, locale)}
        className="detail-panel__more-link"
      >
        {m.elem_more_details({ symbol: element.symbol })}
      </a>

    </div>
  );
}
