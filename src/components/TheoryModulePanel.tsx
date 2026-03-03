import { useState, useEffect, lazy, Suspense } from 'react';
import './theory-module.css';
import type { ReactNode } from 'react';
import type { TheoryModule, TheorySection, TheoryBlock } from '../types/theory-module';
import type { SupportedLocale } from '../types/i18n';
import { loadTheoryModule } from '../lib/data-loader';
import CollapsibleSection, { useTheoryPanelState } from './CollapsibleSection';
import FormulaChip from './FormulaChip';
import * as m from '../paraglide/messages.js';

// ---------------------------------------------------------------------------
// Lazy-loaded component slots
// ---------------------------------------------------------------------------

const SolubilityTable = lazy(() =>
  import('../features/reactions/SolubilityTable'),
);
const ActivitySeriesBar = lazy(() =>
  import('../features/reactions/ActivitySeriesBar'),
);

const COMPONENT_SLOTS: Record<string, ReactNode> = {};

function renderComponentSlot(
  component: string,
  props: Record<string, unknown> = {},
  locale?: SupportedLocale,
): ReactNode {
  switch (component) {
    case 'SolubilityTable': {
      const variant = (props.variant as 'compact' | 'full') ?? 'compact';
      return (
        <Suspense fallback={<div className="theory-loading">{m.loading()}</div>}>
          <SolubilityTable locale={locale} variant={variant} />
        </Suspense>
      );
    }
    case 'ActivitySeriesBar':
      return (
        <Suspense fallback={<div className="theory-loading">{m.loading()}</div>}>
          <ActivitySeriesBar locale={locale} />
        </Suspense>
      );
    default:
      void COMPONENT_SLOTS;
      return <div className="theory-unknown-slot">[{component}]</div>;
  }
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function renderBlock(block: TheoryBlock, locale?: SupportedLocale): ReactNode {
  switch (block.t) {
    case 'heading':
      if (block.level === 2) return <h2 className="theory-module__h2">{block.text_ru}</h2>;
      if (block.level === 3) return <h3 className="theory-module__h3">{block.text_ru}</h3>;
      return <h4 className="theory-module__h4">{block.text_ru}</h4>;

    case 'paragraph':
      return <p className="theory-module__p">{block.text_ru}</p>;

    case 'ordered_list':
      return (
        <ol className="theory-module__ol">
          {block.items_ru.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );

    case 'equation':
      return <div className="theory-module__equation">{block.text_ru}</div>;

    case 'formula_list':
      return (
        <div className="theory-module__formula-list">
          {block.formulas.map((f, i) => (
            <span key={f}>
              {i > 0 && ' '}
              <FormulaChip formula={f} locale={locale} />
            </span>
          ))}
        </div>
      );

    case 'rule_card':
      return (
        <div className="theory-module__rule-card">
          <div className="theory-module__rule-title">{block.title_ru}</div>
          <p className="theory-module__rule-text">{block.rule_ru}</p>
          {block.description_ru && (
            <p className="theory-module__rule-desc">{block.description_ru}</p>
          )}
          {block.examples && block.examples.length > 0 && (
            <div className="theory-module__rule-examples">
              {m.theory_examples_label()}{' '}
              {block.examples.map((f, i) => (
                <span key={f}>
                  {i > 0 && ', '}
                  <FormulaChip formula={f} locale={locale} />
                </span>
              ))}
            </div>
          )}
        </div>
      );

    case 'example_block':
      return (
        <div className="theory-module__example">
          <span className="theory-module__example-label">{block.label_ru}</span>{' '}
          {block.content_ru}
        </div>
      );

    case 'table':
      return (
        <div className="theory-module__table-wrapper">
          <table className="theory-module__table">
            <thead>
              <tr>
                {block.columns_ru.map((col, i) => (
                  <th key={i}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.cells.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'component_slot':
      return renderComponentSlot(block.component, block.props, locale);

    case 'text_block':
      // Legacy: just render the RichText inline — import lazily to avoid circular
      return null; // handled by ConceptModuleIsland; not used in new modules

    case 'concept_card':
      // concept_card is used by ConceptModuleIsland; TheoryModulePanel shows a stub
      return (
        <div className="theory-module__concept-stub" data-concept={block.conceptId} />
      );

    case 'frame':
      // Frame rendering is deferred; show placeholder
      return (
        <div className="theory-module__frame" data-frame={block.frame_id}>
          {/* Frame content rendered at runtime */}
        </div>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

function renderSection(
  section: TheorySection,
  pageKey: string,
  forceSectionId: string | undefined,
  locale: SupportedLocale,
): ReactNode {
  const title = section.title_ru ?? section.id;
  const forceOpen = forceSectionId === section.id;

  return (
    <CollapsibleSection
      key={section.id}
      id={section.id}
      pageKey={pageKey}
      title={title}
      forceOpen={forceOpen}
    >
      {section.blocks.map((block, i) => (
        <div key={i}>{renderBlock(block, locale)}</div>
      ))}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// TheoryModulePanel component
// ---------------------------------------------------------------------------

interface TheoryModulePanelProps {
  /** Key used to look up the module from the manifest (e.g. "bonds_and_crystals") */
  moduleKey: string;
  /** Key for CollapsibleSection state persistence in localStorage */
  pageKey: string;
  locale?: SupportedLocale;
  /** Force a specific section open (for filter-driven navigation) */
  forceSectionId?: string;
}

export default function TheoryModulePanel({
  moduleKey,
  pageKey,
  locale = 'ru' as SupportedLocale,
  forceSectionId,
}: TheoryModulePanelProps) {
  const [module, setModule] = useState<TheoryModule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, toggleOpen] = useTheoryPanelState(pageKey);

  useEffect(() => {
    if (!open || module) return;
    setLoading(true);
    loadTheoryModule(moduleKey)
      .then(mod => {
        setModule(mod);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : m.error_loading_short());
        setLoading(false);
      });
  }, [open, module, moduleKey]);

  return (
    <div className="theory-panel">
      <button
        type="button"
        className={`theory-panel__trigger ${open ? 'theory-panel__trigger--active' : ''}`}
        onClick={toggleOpen}
      >
        <span>{m.theory_label()}</span>
        <span className="theory-panel__trigger-arrow">{open ? '\u25BE' : '\u25B8'}</span>
      </button>

      {open && (
        <div className="theory-panel__content">
          {loading && <div className="theory-panel__loading">{m.loading()}</div>}
          {error && <div className="theory-panel__error">{error}</div>}

          {module && module.sections.map(section =>
            renderSection(section, pageKey, forceSectionId, locale),
          )}
        </div>
      )}
    </div>
  );
}
