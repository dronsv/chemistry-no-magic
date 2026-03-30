import type { ReactNode } from 'react';
import type { RichText } from '../types/ontology-ref';
import type { SupportedLocale } from '../types/i18n';
import SmartText from '../components/SmartText';
import RichTextRenderer from '../components/RichTextRenderer';

/**
 * Render a value that can be either a plain string (legacy) or RichText (migrated).
 *
 * - `string`    -> SmartText (auto-detects formulas + concepts at runtime)
 * - `RichText`  -> RichTextRenderer (pre-segmented, higher fidelity)
 * - `null`/`undefined` -> null
 *
 * Extracted from TheoryModulePanel for reuse across exam components.
 */
export function renderMaybeRichText(
  value: string | RichText | undefined | null,
  locale?: SupportedLocale,
): ReactNode {
  if (value == null) return null;
  if (typeof value === 'string') return <SmartText text={value} locale={locale} />;
  if (Array.isArray(value)) return <RichTextRenderer segments={value} locale={locale} />;
  return null;
}
