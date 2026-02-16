import { useState } from 'react';
import type { OxidationAssignment } from '../lib/oxidation-state';
import './formula-chip.css';

const SUPERSCRIPT: Record<string, string> = {
  '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
  '+': '\u207A', '-': '\u207B',
};

const CLASS_LABELS: Record<string, string> = {
  oxide: 'оксид',
  acid: 'кислота',
  base: 'основание',
  salt: 'соль',
  simple: 'простое вещество',
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

interface FormulaChipProps {
  formula: string;
  name?: string;
  substanceClass?: string;
  substanceId?: string;
  oxidationStates?: OxidationAssignment[];
}

export default function FormulaChip({
  formula,
  name,
  substanceClass,
  substanceId,
  oxidationStates,
}: FormulaChipProps) {
  const [hovered, setHovered] = useState(false);

  const cls = substanceClass ?? 'unknown';
  const classNames = [
    'formula-chip',
    `formula-chip--${cls}`,
    substanceId ? 'formula-chip--link' : '',
  ].filter(Boolean).join(' ');

  const hasTooltipContent = name || substanceClass || (oxidationStates && oxidationStates.length > 0);

  const tooltip = hasTooltipContent && hovered ? (
    <span className="formula-chip__tooltip">
      {name && <span className="formula-chip__tooltip-name">{name}</span>}
      {name && substanceClass && <span className="formula-chip__tooltip-sep">&middot;</span>}
      {substanceClass && CLASS_LABELS[substanceClass]}
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
  if (substanceClass && CLASS_LABELS[substanceClass]) titleParts.push(CLASS_LABELS[substanceClass]);
  if (oxidationStates && oxidationStates.length > 0) titleParts.push(formatOxLine(oxidationStates));
  const titleText = titleParts.length > 0 ? titleParts.join(' · ') : undefined;

  const handleClick = substanceId
    ? () => { window.location.href = `/substances/${substanceId}/`; }
    : undefined;

  return (
    <span
      className={classNames}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      role={substanceId ? 'link' : undefined}
      title={titleText}
    >
      {formula}
      {tooltip}
    </span>
  );
}
