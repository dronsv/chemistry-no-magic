import type { Element, ElementGroup } from '../../types/element';
import * as m from '../../paraglide/messages.js';

const GROUP_CSS_VAR: Record<ElementGroup, string> = {
  alkali_metal: 'var(--color-alkali-metal)',
  alkaline_earth: 'var(--color-alkaline-earth)',
  transition_metal: 'var(--color-transition-metal)',
  post_transition_metal: 'var(--color-post-transition-metal)',
  metalloid: 'var(--color-metalloid)',
  nonmetal: 'var(--color-nonmetal)',
  halogen: 'var(--color-halogen)',
  noble_gas: 'var(--color-noble-gas)',
  lanthanide: 'var(--color-lanthanide)',
  actinide: 'var(--color-actinide)',
};

interface ElementCellProps {
  element: Element;
  dimmed: boolean;
  highlighted?: boolean;
  isException?: boolean;
  onSelect: (element: Element) => void;
  onHoverElement: (group: ElementGroup) => void;
  onHoverElementEnd: () => void;
}

export default function ElementCell({ element, dimmed, highlighted, isException, onSelect, onHoverElement, onHoverElementEnd }: ElementCellProps) {
  const bgColor = GROUP_CSS_VAR[element.element_group];
  const cls = [
    'pt-cell',
    dimmed ? 'pt-cell--dimmed' : '',
    highlighted ? 'pt-cell--highlighted' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={cls}
      style={{ backgroundColor: bgColor }}
      onClick={() => onSelect(element)}
      onMouseEnter={() => onHoverElement(element.element_group)}
      onMouseLeave={onHoverElementEnd}
      title={`${element.Z} ${element.name_ru}`}
      type="button"
    >
      <span className="pt-cell__z">{element.Z}</span>
      {isException && <span className="pt-cell__exc" aria-label={m.pt_exception_label()} />}
      <span className="pt-cell__symbol">{element.symbol}</span>
      <span className="pt-cell__mass">{Math.round(element.atomic_mass)}</span>
    </button>
  );
}
