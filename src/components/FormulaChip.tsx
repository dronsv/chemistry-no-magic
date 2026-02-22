import { useState, type ReactNode } from 'react';
import type { OxidationAssignment } from '../lib/oxidation-state';
import { parseFormulaParts } from '../lib/formula-render';
import { useIonDetails } from './IonDetailsProvider';
import * as m from '../paraglide/messages.js';
import './formula-chip.css';

const SUPERSCRIPT: Record<string, string> = {
  '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
  '+': '\u207A', '-': '\u207B',
};

const CLASS_LABELS: Record<string, () => string> = {
  oxide: m.class_oxide_lower,
  acid: m.class_acid_lower,
  base: m.class_base_lower,
  salt: m.class_salt_lower,
  simple: m.class_simple_lower,
};

const ION_TYPE_LABELS: Record<string, () => string> = {
  cation: m.ion_cation,
  anion: m.ion_anion,
};

function toSuper(n: number): string {
  const sign = n >= 0 ? '+' : '-';
  const digits = String(Math.abs(n));
  return (sign + digits).split('').map(ch => SUPERSCRIPT[ch] ?? ch).join('');
}

function formatOxLine(assignments: OxidationAssignment[]): string {
  return assignments
    .map(a => `${a.symbol}${toSuper(a.state)}`)
    .join(' ');
}

/** Render formula with HTML <sup>/<sub> for proper notation. */
function renderFormulaHtml(formula: string): ReactNode[] {
  const parts = parseFormulaParts(formula);
  return parts.map((part, i) => {
    if (part.type === 'sup') return <sup key={i}>{part.content}</sup>;
    if (part.type === 'sub') return <sub key={i}>{part.content}</sub>;
    return <span key={i}>{part.content}</span>;
  });
}

interface FormulaChipProps {
  formula: string;
  name?: string;
  substanceClass?: string;
  substanceId?: string;
  oxidationStates?: OxidationAssignment[];
  ionType?: 'cation' | 'anion';
  ionId?: string;
}

export default function FormulaChip({
  formula,
  name,
  substanceClass,
  substanceId,
  oxidationStates,
  ionType,
  ionId,
}: FormulaChipProps) {
  const [hovered, setHovered] = useState(false);
  const ionDetails = useIonDetails();

  const isIon = !!ionType;
  const cls = isIon ? ionType : (substanceClass ?? 'unknown');
  const isClickable = !!substanceId || !!ionId;
  const classNames = [
    'formula-chip',
    isIon ? `formula-chip--${ionType}` : `formula-chip--${cls}`,
    isClickable ? 'formula-chip--link' : '',
  ].filter(Boolean).join(' ');

  const hasTooltipContent = name || substanceClass || ionType || (oxidationStates && oxidationStates.length > 0);

  const tooltip = hasTooltipContent && hovered ? (
    <span className="formula-chip__tooltip">
      {name && <span className="formula-chip__tooltip-name">{name}</span>}
      {name && (substanceClass || ionType) && <span className="formula-chip__tooltip-sep">&middot;</span>}
      {ionType && ION_TYPE_LABELS[ionType]?.()}
      {substanceClass && !ionType && CLASS_LABELS[substanceClass]?.()}
      {oxidationStates && oxidationStates.length > 0 && (
        <>
          {(name || substanceClass) && <span className="formula-chip__tooltip-sep">&middot;</span>}
          <span className="formula-chip__tooltip-ox">{formatOxLine(oxidationStates)}</span>
        </>
      )}
    </span>
  ) : null;

  // Build plain-text title for accessibility
  const titleParts: string[] = [];
  if (name) titleParts.push(name);
  if (ionType && ION_TYPE_LABELS[ionType]) titleParts.push(ION_TYPE_LABELS[ionType]());
  if (substanceClass && !ionType && CLASS_LABELS[substanceClass]) titleParts.push(CLASS_LABELS[substanceClass]());
  if (oxidationStates && oxidationStates.length > 0) titleParts.push(formatOxLine(oxidationStates));
  const titleText = titleParts.length > 0 ? titleParts.join(' · ') : undefined;

  const handleClick = ionId
    ? (e: React.MouseEvent) => {
        if (ionDetails) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          ionDetails.showIonDetails(ionId, rect);
        }
      }
    : substanceId
      ? () => { window.location.href = `/substances/${substanceId}/`; }
      : undefined;

  return (
    <span
      className={classNames}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      role={isClickable ? 'link' : undefined}
      title={titleText}
      aria-label={isIon ? `${formula} ${titleText ?? ''}`.trim() : undefined}
    >
      {isIon ? renderFormulaHtml(formula) : formula}
      {tooltip}
    </span>
  );
}
