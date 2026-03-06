import { useState, type ReactNode } from 'react';
import type { OxidationAssignment } from '../lib/oxidation-state';
import type { SupportedLocale } from '../types/i18n';
import { parseChemicalFormula } from '../lib/formula-render';
import { parseFormula } from '../lib/formula-parser';
import { dispatchHighlight } from '../lib/formula-highlight-events';
import { localizeUrl } from '../lib/i18n';
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

const SUBCLASS_LABELS: Record<string, () => string> = {
  basic: m.subclass_basic,
  acidic: m.subclass_acidic,
  amphoteric: m.subclass_amphoteric,
  indifferent: m.subclass_indifferent,
  oxygen_containing: m.subclass_oxygen_containing,
  oxygen_free: m.subclass_oxygen_free,
  soluble: m.subclass_soluble,
  insoluble: m.subclass_insoluble,
  normal: m.subclass_normal,
  acidic_salt: m.subclass_acidic_salt,
  basic_salt: m.subclass_basic_salt,
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
  const parts = parseChemicalFormula(formula);
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
  subclass?: string;
  substanceId?: string;
  locale?: SupportedLocale;
  oxidationStates?: OxidationAssignment[];
  ionType?: 'cation' | 'anion';
  ionId?: string;
  elementId?: string;
}

export default function FormulaChip({
  formula,
  name,
  substanceClass,
  subclass,
  substanceId,
  locale,
  oxidationStates,
  ionType,
  ionId,
  elementId,
}: FormulaChipProps) {
  const [hovered, setHovered] = useState(false);
  const ionDetails = useIonDetails();

  const isIon = !!ionType;
  const cls = isIon ? ionType : (substanceClass ?? 'unknown');
  const isClickable = !!substanceId || !!ionId || !!elementId;
  const classNames = [
    'formula-chip',
    isIon ? `formula-chip--${ionType}` : `formula-chip--${cls}`,
    isClickable ? 'formula-chip--link' : '',
  ].filter(Boolean).join(' ');

  const hasTooltipContent = name || substanceClass || subclass || ionType || (oxidationStates && oxidationStates.length > 0);

  const classLabel = ionType
    ? ION_TYPE_LABELS[ionType]?.()
    : substanceClass
      ? CLASS_LABELS[substanceClass]?.()
      : undefined;
  const subclassLabel = subclass ? SUBCLASS_LABELS[subclass]?.() ?? subclass : undefined;

  const tooltip = hasTooltipContent && hovered ? (
    <span className="formula-chip__tooltip">
      {name && <span className="formula-chip__tooltip-name">{name}</span>}
      {name && classLabel && <span className="formula-chip__tooltip-sep">&middot;</span>}
      {classLabel}
      {subclassLabel && (
        <>
          <span className="formula-chip__tooltip-sep">&middot;</span>
          <span className="formula-chip__tooltip-sub">{subclassLabel}</span>
        </>
      )}
      {oxidationStates && oxidationStates.length > 0 && (
        <>
          {(name || classLabel || subclassLabel) && <span className="formula-chip__tooltip-sep">&middot;</span>}
          <span className="formula-chip__tooltip-ox">{formatOxLine(oxidationStates)}</span>
        </>
      )}
    </span>
  ) : null;

  // Build plain-text title for accessibility
  const titleParts: string[] = [];
  if (name) titleParts.push(name);
  if (classLabel) titleParts.push(classLabel);
  if (subclassLabel) titleParts.push(subclassLabel);
  if (oxidationStates && oxidationStates.length > 0) titleParts.push(formatOxLine(oxidationStates));
  const titleText = titleParts.length > 0 ? titleParts.join(' · ') : undefined;

  const substanceUrl = substanceId
    ? localizeUrl(`/substances/${substanceId}/`, locale ?? 'ru')
    : undefined;

  const elementUrl = elementId
    ? localizeUrl(`/periodic-table/${elementId}/`, locale ?? 'ru')
    : undefined;

  const handleClick = ionId
    ? (e: React.MouseEvent) => {
        if (ionDetails) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          ionDetails.showIonDetails(ionId, rect);
        }
      }
    : substanceUrl
      ? () => { window.location.href = substanceUrl; }
      : elementUrl
        ? () => { window.location.href = elementUrl; }
        : undefined;

  return (
    <span
      className={classNames}
      onMouseEnter={() => {
        setHovered(true);
        const elements = Object.keys(parseFormula(formula));
        dispatchHighlight(isIon ? { elements, ionId } : { elements, formula });
      }}
      onMouseLeave={() => {
        setHovered(false);
        dispatchHighlight(null);
      }}
      onClick={handleClick}
      role={isClickable ? 'link' : undefined}
      title={titleText}
      aria-label={isIon ? `${formula} ${titleText ?? ''}`.trim() : undefined}
    >
      {renderFormulaHtml(formula)}
      {tooltip}
    </span>
  );
}
