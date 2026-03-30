import { useState, useEffect, lazy, Suspense } from 'react';
import './theory-module.css';
import './ont-embed.css';
import type { ReactNode } from 'react';
import type { RichText } from '../types/ontology-ref';
import type { TheoryModule, TheorySection, TheoryBlock } from '../types/theory-module';
import type { OxRule, OxRulesData } from '../types/oxidation-rules';
import type { SupportedLocale } from '../types/i18n';
import { loadTheoryModule, loadTheoryModuleOverlay, loadSemanticModule, loadDidacticTemplates, loadDidacticOverrides, loadOxidationRules, loadFormulas, loadConstants, loadQuantityNames, loadConcepts, loadConceptOverlay, loadConceptLookup } from '../lib/data-loader';
import { ConceptProvider, type ConceptContextValue } from './ConceptProvider';
import { applySemanticLayer } from '../lib/semantic-renderer';
import type { ComputableFormula, PhysicalConstant } from '../types/formula';
import { formulaToDisplayString } from '../lib/formula-evaluator';
import CollapsibleSection, { useTheoryPanelState } from './CollapsibleSection';
import FormulaChip from './FormulaChip';
import { useFormulaLookup } from './ChemText';
import RichTextRenderer from './RichTextRenderer';
import { renderMaybeRichText } from '../lib/render-maybe-richtext';
import { QuantityLookupProvider, type QuantityLookup } from './OntologyRef';
import OntEmbedBlock from './OntEmbedBlock';
import * as m from '../paraglide/messages.js';

type OntEmbedBlockType = TheoryBlock & { t: 'ont_embed' };

// ---------------------------------------------------------------------------
// Lazy-loaded component slots
// ---------------------------------------------------------------------------

const SolubilityTable = lazy(() =>
  import('../features/reactions/SolubilityTable'),
);
const ActivitySeriesBar = lazy(() =>
  import('../features/reactions/ActivitySeriesBar'),
);
const MolarMassCalculator = lazy(() =>
  import('../features/calculations/MolarMassCalculator'),
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
    case 'MolarMassCalculator':
      return (
        <Suspense fallback={<div className="theory-loading">{m.loading()}</div>}>
          <MolarMassCalculator locale={locale} />
        </Suspense>
      );
    default:
      void COMPONENT_SLOTS;
      return <div className="theory-unknown-slot">[{component}]</div>;
  }
}

// ---------------------------------------------------------------------------
// Kind badge label helper
// ---------------------------------------------------------------------------

function kindLabel(kind: OxRule['kind']): string {
  switch (kind) {
    case 'exception': return m.pt_exception_label();
    case 'default': return '~';
    case 'constraint': return 'Σ=0';
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Formula display helper
// ---------------------------------------------------------------------------

/** Map of formula.id → ComputableFormula for equation resolution. */
type FormulaMap = Record<string, ComputableFormula>;

/** Resolved formula data for display. */
interface FormulaData {
  formulas: FormulaMap;
  constants: PhysicalConstant[];
}

// ---------------------------------------------------------------------------
// Example formulas with auto-resolved substance class from FormulaLookup
// ---------------------------------------------------------------------------

function ExampleFormulas({ formulas, locale }: { formulas: string[]; locale: SupportedLocale }) {
  const lookup = useFormulaLookup();
  return (
    <div className="theory-module__rule-examples">
      {m.theory_examples_label()}{' '}
      {formulas.map((f, i) => {
        const entry = lookup?.[f];
        return (
          <span key={f}>
            {i > 0 && ', '}
            <FormulaChip
              formula={f}
              substanceId={entry?.type === 'substance' ? entry.id : undefined}
              substanceClass={entry?.type === 'substance' ? entry.cls : (entry?.type === 'element' ? 'simple' : undefined)}
              ionId={entry?.type === 'ion' ? entry.id : undefined}
              ionType={entry?.type === 'ion' ? entry.ionType : undefined}
              elementId={entry?.type === 'element' ? entry.id : undefined}
              locale={locale}
            />
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RichText / string hybrid helper
// ---------------------------------------------------------------------------

/** Helper type for blocks with _didactic* fields injected by semantic renderer */
type DidacticBlock = TheoryBlock & Record<string, unknown>;

// renderMaybeRichText imported from src/lib/render-maybe-richtext.tsx

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function renderBlock(
  block: TheoryBlock,
  locale: SupportedLocale,
  rulesById: Record<string, OxRule> | null,
  formulaData: FormulaData,
): ReactNode {
  switch (block.t) {
    case 'heading': {
      const hText = (block as DidacticBlock)._didacticText ?? block.text;
      const content = renderMaybeRichText(hText as string | RichText, locale);
      if (block.level === 2) return <h2 className="theory-module__h2">{content}</h2>;
      if (block.level === 3) return <h3 className="theory-module__h3">{content}</h3>;
      return <h4 className="theory-module__h4">{content}</h4>;
    }

    case 'paragraph': {
      const pText = (block as DidacticBlock)._didacticText ?? block.text;
      return <div className="theory-module__p">{renderMaybeRichText(pText as string | RichText, locale)}</div>;
    }

    case 'ordered_list': {
      const olItems = (block as DidacticBlock)._didacticItems ?? block.items;
      return (
        <ol className="theory-module__ol">
          {(olItems as (string | RichText)[]).map((item, i) => (
            <li key={i}>{renderMaybeRichText(item as string | RichText, locale)}</li>
          ))}
        </ol>
      );
    }

    case 'equation': {
      const f = block.formula_id ? formulaData.formulas[block.formula_id] : undefined;
      const eqText = f
        ? formulaToDisplayString(f, block.inversion_for, formulaData.constants)
        : block.text;
      const note = block.note;
      return (
        <div className="theory-module__equation">
          {eqText}{note ? ` (${note})` : ''}
        </div>
      );
    }

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

    case 'rule_card': {
      const db = block as DidacticBlock;
      const rcTitle = db._didacticTitle ?? block.title;
      const rcRule = db._didacticRule ?? block.rule;
      const rcDesc = db._didacticDescription ?? block.description;
      return (
        <div className="theory-module__rule-card">
          <div className="theory-module__rule-title">{renderMaybeRichText(rcTitle as string | RichText, locale)}</div>
          <div className="theory-module__rule-text">{renderMaybeRichText(rcRule as string | RichText, locale)}</div>
          {rcDesc && (
            <div className="theory-module__rule-desc">{renderMaybeRichText(rcDesc as string | RichText, locale)}</div>
          )}
          {block.examples && block.examples.length > 0 && (
            <ExampleFormulas formulas={block.examples} locale={locale} />
          )}
        </div>
      );
    }

    case 'example_block': {
      const ebDb = block as DidacticBlock;
      const ebLabel = ebDb._didacticLabel ?? block.label;
      const ebContent = ebDb._didacticContent ?? block.content;
      return (
        <div className="theory-module__example">
          <span className="theory-module__example-label">{renderMaybeRichText(ebLabel as string | RichText, locale)}</span>{' '}
          {renderMaybeRichText(ebContent as string | RichText, locale)}
        </div>
      );
    }

    case 'table': {
      const tDb = block as DidacticBlock;
      const tCols = tDb._didacticColumns ?? block.columns;
      const tRows = tDb._didacticRows ?? block.rows;
      return (
        <div className="theory-module__table-wrapper">
          <table className="theory-module__table">
            <thead>
              <tr>
                {(tCols as (string | RichText)[]).map((col, i) => (
                  <th key={i}>{renderMaybeRichText(col as string | RichText, locale)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(tRows as (import('../types/theory-module').TableRow | RichText[])[]).map((row, ri) => {
                // Support both legacy TableRow format and didactic RichText[][] format
                const cells = Array.isArray(row) && !('cells' in row)
                  ? row as RichText[]
                  : (row as import('../types/theory-module').TableRow).cells.map(c => c as unknown);
                return (
                  <tr key={ri}>
                    {(cells as (string | RichText)[]).map((cell, ci) => (
                      <td key={ci}>{renderMaybeRichText(cell as string | RichText, locale)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    case 'ox_rule': {
      const rule = rulesById?.[block.rule_id];
      if (!rule) return null;
      return (
        <div className="theory-module__rule-card">
          <div className="theory-module__rule-title">
            <span className={`theory-module__rule-kind theory-module__rule-kind--${rule.kind}`}>
              {kindLabel(rule.kind)}
            </span>
            {rule.title}
          </div>
          <p className="theory-module__rule-text">
            {renderMaybeRichText(rule.description, locale)}
          </p>
          {rule.examples && rule.examples.length > 0 && (
            <div className="theory-module__rule-examples">
              {m.theory_examples_label()}{' '}
              {rule.examples.map((f, i) => (
                <span key={f}>
                  {i > 0 && ', '}
                  <FormulaChip formula={f} locale={locale} />
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'component_slot':
      return renderComponentSlot(block.component, block.props, locale);

    case 'text_block':
      if (!block.content || block.content.length === 0) return null;
      return <p className="theory-module__p"><RichTextRenderer segments={block.content} locale={locale} /></p>;

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

    case 'ont_embed':
      return <OntEmbedBlock block={block as OntEmbedBlockType} locale={locale} />;

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
  rulesById: Record<string, OxRule> | null,
  formulaData: FormulaData,
): ReactNode {
  // Check for didactic RichText title injected by semantic renderer
  const didacticTitle = (section as TheorySection & { _didacticTitle?: RichText })._didacticTitle;
  const title = section.title ?? section.id;
  const forceOpen = forceSectionId === section.id;

  return (
    <CollapsibleSection
      key={section.id}
      id={section.id}
      pageKey={pageKey}
      title={didacticTitle
        ? <RichTextRenderer segments={didacticTitle} locale={locale} />
        : title}
      forceOpen={forceOpen}
    >
      {section.blocks.map((block, i) => (
        <div key={i}>{renderBlock(block, locale, rulesById, formulaData)}</div>
      ))}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Overlay application (pure function, exported for testing)
// ---------------------------------------------------------------------------

type SectionOverlay = {
  title?: string;
  blocks?: Array<Record<string, unknown>>;
};

type ModuleOverlay = {
  sections?: Record<string, SectionOverlay>;
};

export function applyTheoryModuleOverlay(
  module: TheoryModule,
  overlay: Record<string, unknown> | null,
): TheoryModule {
  if (!overlay) return module;
  const sections = (overlay as ModuleOverlay).sections;
  if (!sections) return module;

  return {
    ...module,
    sections: module.sections.map(section => {
      const secOverlay = sections[section.id];
      if (!secOverlay) return section;

      const title = secOverlay.title ?? section.title;
      const blockOverlays = secOverlay.blocks;
      if (!blockOverlays) return { ...section, title };

      // Apply block overlays in position order, skipping ox_rule blocks
      let overlayIdx = 0;
      const blocks = section.blocks.map(block => {
        if (block.t === 'ox_rule') return block;
        const bo = blockOverlays[overlayIdx++];
        if (!bo) return block;

        if (block.t === 'paragraph' && bo.text) {
          return { ...block, text: bo.text as string };
        }
        if (block.t === 'equation') {
          return {
            ...block,
            ...(bo.text ? { text: bo.text as string } : {}),
            ...(bo.note ? { note: bo.note as string } : {}),
          };
        }
        if (block.t === 'rule_card') {
          return {
            ...block,
            ...(bo.title ? { title: bo.title as string } : {}),
            ...(bo.rule ? { rule: bo.rule as string } : {}),
            ...(bo.description ? { description: bo.description as string } : {}),
          };
        }
        if (block.t === 'table') {
          return {
            ...block,
            ...(bo.columns ? { columns: bo.columns as string[] } : {}),
            ...(bo.rows ? { rows: (bo.rows as string[][]).map(cells => ({ cells })) } : {}),
          };
        }
        if (block.t === 'ordered_list' && bo.items) {
          return { ...block, items: bo.items as string[] };
        }
        if (block.t === 'example_block') {
          return {
            ...block,
            ...(bo.label ? { label: bo.label as string } : {}),
            ...(bo.content ? { content: bo.content as string } : {}),
          };
        }
        if (block.t === 'text_block' && bo.content) {
          return { ...block, content: bo.content as import('../types/ontology-ref').RichText };
        }
        if (block.t === 'heading' && bo.text) {
          return { ...block, text: bo.text as string };
        }
        if (block.t === 'ont_embed') {
          return block;
        }
        return block;
      });

      return { ...section, title, blocks };
    }),
  };
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
  const [rulesById, setRulesById] = useState<Record<string, OxRule> | null>(null);
  const [formulaData, setFormulaData] = useState<FormulaData>({ formulas: {}, constants: [] });
  const [quantityNames, setQuantityNames] = useState<QuantityLookup | null>(null);
  const [conceptCtx, setConceptCtx] = useState<ConceptContextValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, toggleOpen] = useTheoryPanelState(pageKey);

  useEffect(() => {
    if (!open || module) return;
    setLoading(true);

    const overlayPromise = loadTheoryModuleOverlay(moduleKey, locale);
    const semanticPromise = loadSemanticModule(moduleKey);
    const templatesPromise = loadDidacticTemplates(locale);
    const overridesPromise = loadDidacticOverrides(moduleKey, locale);

    const oxRulesPromise = moduleKey === 'oxidation_states'
      ? loadOxidationRules(locale)
      : Promise.resolve(null);

    Promise.all([loadTheoryModule(moduleKey), overlayPromise, semanticPromise, templatesPromise, overridesPromise, oxRulesPromise])
      .then(async ([mod, overlay, semantic, templates, overrides, oxRules]) => {
        // Apply legacy overlay first (backward compat), then semantic layer if available
        let finalMod = applyTheoryModuleOverlay(mod, overlay);
        if (semantic && templates) {
          finalMod = applySemanticLayer(finalMod, semantic, templates, overrides);
        }

        // Load formulas + constants if any equation block references a formula_id
        const needsFormulas = finalMod.sections.some(s =>
          s.blocks.some(b => b.t === 'equation' && 'formula_id' in b && b.formula_id),
        );
        // Load quantity names if any text_block has ref segments (for OntologyRef tooltips)
        const needsQuantityNames = !!semantic || finalMod.sections.some(s =>
          s.blocks.some(b => b.t === 'text_block' && b.content?.some(
            seg => seg.t === 'ref' && (seg.id.startsWith('q:') || seg.id.startsWith('unit:')),
          )),
        );

        const promises: Promise<unknown>[] = [];
        if (needsFormulas) {
          promises.push(
            Promise.all([loadFormulas(), loadConstants()]).then(([formulas, constants]) => {
              const map: FormulaMap = {};
              for (const f of formulas) map[f.id] = f;
              setFormulaData({ formulas: map, constants });
            }),
          );
        }
        if (needsQuantityNames) {
          promises.push(
            loadQuantityNames(locale).then(names => setQuantityNames(names)),
          );
        }
        // Load concept data when semantic layer is active (for ConceptRef resolution)
        if (semantic) {
          promises.push(
            Promise.all([
              loadConcepts(),
              loadConceptOverlay(locale),
              loadConceptLookup(locale).catch(() => ({} as Record<string, string>)),
            ]).then(([registry, overlay, lookup]) => {
              if (registry && overlay) {
                setConceptCtx({ registry, overlay, lookup: lookup ?? {} });
              }
            }),
          );
        }
        await Promise.all(promises);

        setModule(finalMod);
        if (oxRules) {
          const byId: Record<string, OxRule> = {};
          for (const rule of (oxRules as OxRulesData).rules) byId[rule.id] = rule;
          setRulesById(byId);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : m.error_loading_short());
        setLoading(false);
      });
  }, [open, module, moduleKey, locale]);

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
        <ConceptProvider value={conceptCtx}>
          <QuantityLookupProvider value={quantityNames}>
            <div className="theory-panel__content">
              {loading && <div className="theory-panel__loading">{m.loading()}</div>}
              {error && <div className="theory-panel__error">{error}</div>}

              {module && module.sections.map(section =>
                renderSection(section, pageKey, forceSectionId, locale, rulesById, formulaData),
              )}
            </div>
          </QuantityLookupProvider>
        </ConceptProvider>
      )}
    </div>
  );
}
