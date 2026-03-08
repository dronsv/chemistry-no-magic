import { useState, useEffect } from 'react';
import type { ConceptEntry, ConceptRegistry, ConceptOverlay, ConceptLookup, RichText } from '../../types/ontology-ref';
import type { ConceptFilter } from '../../types/filter-dsl';
import type { TheoryModule, TheoryBlock } from '../../types/theory-module';
import type { SupportedLocale } from '../../types/i18n';
import { loadConcepts, loadConceptOverlay, loadConceptLookup, loadTheoryModule, loadTheoryModuleOverlay, loadSubstancesIndex, loadReactions, loadFormulaLookup } from '../../lib/data-loader';
import { filterEntities } from '../../lib/filter-evaluator';
import { filtersToRichText, isDslFilter } from '../../lib/filter-to-richtext';
import { ConceptProvider } from '../../components/ConceptProvider';
import RichTextRenderer from '../../components/RichTextRenderer';
import FormulaChip from '../../components/FormulaChip';
import { FormulaLookupProvider } from '../../components/ChemText';
import { localizeUrl, CONCEPT_KIND_ROUTES } from '../../lib/i18n';
import './concept-module-island.css';

interface Props {
  conceptId: string;
  locale: string;
}

interface SubstanceInfo {
  id: string;
  formula: string;
  name?: string;
  class: string;
  subclass?: string;
  tags?: string[];
}

interface ReactionInfo {
  reaction_id: string;
  title: string;
  equation: string;
  type_tags: string[];
  heat_effect?: string;
}

/** Find which theory module applies to this concept or its ancestors */
function findApplicableModule(
  conceptId: string,
  registry: ConceptRegistry,
  modules: TheoryModule[],
): TheoryModule | undefined {
  let current: string | null = conceptId;
  while (current) {
    const found = modules.find(m => m.applies_to.includes(current!));
    if (found) return found;
    current = registry[current]?.parent_id ?? null;
  }
  return undefined;
}

/** Find the concept_card block for a given conceptId within a module */
function findConceptCard(
  conceptId: string,
  module: TheoryModule,
): (TheoryBlock & { t: 'concept_card' }) | undefined {
  for (const section of module.sections) {
    for (const block of section.blocks) {
      if (block.t === 'concept_card' && block.conceptId === conceptId) {
        return block as TheoryBlock & { t: 'concept_card' };
      }
    }
  }
  return undefined;
}

/** Apply theory module overlay to get localized reactivity_rules */
function getLocalizedReactivityRules(
  conceptId: string,
  section: { id: string },
  moduleOverlay: Record<string, unknown> | null,
  defaultRules?: RichText,
): RichText | undefined {
  if (!moduleOverlay) return defaultRules;
  const sections = (moduleOverlay as Record<string, Record<string, Record<string, unknown>>>).sections;
  if (!sections) return defaultRules;
  const sectionData = sections[section.id];
  if (!sectionData) return defaultRules;
  const cardData = sectionData[conceptId];
  if (!cardData?.reactivity_rules) return defaultRules;
  return cardData.reactivity_rules as RichText;
}

export default function ConceptModuleIsland({ conceptId, locale }: Props) {
  const loc = locale as SupportedLocale;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<ConceptRegistry | null>(null);
  const [overlay, setOverlay] = useState<ConceptOverlay | null>(null);
  const [lookup, setLookup] = useState<ConceptLookup | null>(null);
  const [formulaLookup, setFormulaLookup] = useState<Record<string, { id: string; kind: string }> | null>(null);
  const [criteriaRichText, setCriteriaRichText] = useState<RichText | null>(null);
  const [reactivityRules, setReactivityRules] = useState<RichText | null>(null);
  const [matchingSubstances, setMatchingSubstances] = useState<SubstanceInfo[]>([]);
  const [matchingReactions, setMatchingReactions] = useState<ReactionInfo[]>([]);
  const [showCriteria, setShowCriteria] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [reg, ov, lk, fl] = await Promise.all([
          loadConcepts(),
          loadConceptOverlay(loc),
          loadConceptLookup(loc),
          loadFormulaLookup(),
        ]);

        if (cancelled) return;
        if (!ov) { setError('Overlay not available'); setLoading(false); return; }

        setRegistry(reg);
        setOverlay(ov);
        setLookup(lk);
        setFormulaLookup(fl);

        const entry = reg[conceptId];
        if (!entry) { setError('Concept not found'); setLoading(false); return; }

        // Auto-generate criteria from Filter DSL
        if (isDslFilter(entry.filters)) {
          const rt = filtersToRichText(entry.filters as ConceptFilter, locale);
          setCriteriaRichText(rt);
        }

        // Resolve concept filter for filterEntities
        const resolveConceptFilter = (id: string): ConceptFilter | undefined => {
          const e = reg[id];
          if (!e) return undefined;
          if (isDslFilter(e.filters)) return e.filters as ConceptFilter;
          return undefined;
        };

        // Load entities and run filter
        const kind = entry.kind;
        if ((kind === 'substance_class') && isDslFilter(entry.filters)) {
          try {
            const substances = await loadSubstancesIndex(loc);
            const matches = filterEntities(
              entry.filters as ConceptFilter,
              substances as unknown as Record<string, unknown>[],
              resolveConceptFilter,
            ) as unknown as SubstanceInfo[];
            if (!cancelled) setMatchingSubstances(matches);
          } catch { /* substance index optional */ }
        }

        if ((kind === 'reaction_type' || kind === 'reaction_facet') && isDslFilter(entry.filters)) {
          try {
            const reactions = await loadReactions();
            const matches = filterEntities(
              entry.filters as ConceptFilter,
              reactions as unknown as Record<string, unknown>[],
              resolveConceptFilter,
            ) as unknown as ReactionInfo[];
            if (!cancelled) setMatchingReactions(matches);
          } catch { /* reactions optional */ }
        }

        // Load theory module
        try {
          const moduleKeys = ['classification_inorganic', 'reaction_types'];
          const modules: TheoryModule[] = [];
          for (const key of moduleKeys) {
            try {
              const mod = await loadTheoryModule(key);
              modules.push(mod);
            } catch { /* module might not exist */ }
          }

          const applicableModule = findApplicableModule(conceptId, reg, modules);
          if (applicableModule) {
            const card = findConceptCard(conceptId, applicableModule);
            if (card?.reactivity_rules) {
              // Try to get localized version
              const moduleKey = applicableModule.id.includes('classification')
                ? 'classification_inorganic'
                : 'reaction_types';
              const moduleOverlay = await loadTheoryModuleOverlay(moduleKey, loc);
              const section = applicableModule.sections.find(s =>
                s.blocks.some(b => b.t === 'concept_card' && b.conceptId === conceptId)
              );
              const rules = section
                ? getLocalizedReactivityRules(conceptId, section, moduleOverlay, card.reactivity_rules)
                : card.reactivity_rules;
              if (!cancelled && rules) setReactivityRules(rules);
            }
          }
        } catch { /* theory modules optional */ }

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Load error');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [conceptId, locale, loc]);

  if (loading) {
    return <div className="concept-island concept-island--loading">Загрузка...</div>;
  }
  if (error) {
    return <div className="concept-island concept-island--error">{error}</div>;
  }
  if (!registry || !overlay) return null;

  const entry = registry[conceptId];
  if (!entry) return null;

  const conceptCtx = { registry, overlay, lookup: lookup ?? {} };
  const baseRoute = CONCEPT_KIND_ROUTES[entry.kind] ?? '/';

  // Build children links
  const children = (entry.children_order ?? [])
    .map(childId => {
      const childOv = overlay[childId];
      const childEntry = registry[childId];
      if (!childOv || !childEntry) return null;

      // Build slug path
      const slugs: string[] = [];
      let cur: string | null = childId;
      while (cur) {
        const ov = overlay[cur];
        if (ov) slugs.unshift(ov.slug);
        cur = registry[cur]?.parent_id ?? null;
      }
      const href = localizeUrl(baseRoute + slugs.join('/') + '/', loc);

      // Count matching entities for the child
      let count: number | undefined;
      if (isDslFilter(childEntry.filters)) {
        if (childEntry.kind === 'substance_class') {
          count = matchingSubstances.filter(s => {
            try {
              return filterEntities(
                childEntry.filters as ConceptFilter,
                [s as unknown as Record<string, unknown>],
                (id) => {
                  const e = registry[id];
                  return e && isDslFilter(e.filters) ? e.filters as ConceptFilter : undefined;
                },
              ).length > 0;
            } catch { return false; }
          }).length;
        }
      }

      return { id: childId, name: childOv.name, href, count };
    })
    .filter(Boolean) as { id: string; name: string; href: string; count?: number }[];

  return (
    <FormulaLookupProvider lookup={formulaLookup}>
      <ConceptProvider value={conceptCtx}>
        <div className="concept-island">
          {/* Criteria block */}
          {criteriaRichText && criteriaRichText.length > 0 && (
            <section className="concept-criteria">
              <button
                className="concept-criteria__toggle"
                onClick={() => setShowCriteria(!showCriteria)}
                aria-expanded={showCriteria}
              >
                {showCriteria ? '▾ Скрыть критерии' : '▸ Показать критерии'}
              </button>
              {showCriteria && (
                <div className="concept-criteria__content">
                  <RichTextRenderer segments={criteriaRichText} locale={loc} />
                </div>
              )}
            </section>
          )}

          {/* Reactivity rules */}
          {reactivityRules && (
            <section className="concept-reactivity">
              <RichTextRenderer segments={reactivityRules} locale={loc} />
            </section>
          )}

          {/* Children subcategories */}
          {children.length > 0 && (
            <section className="concept-children-grid">
              {children.map(child => (
                <a key={child.id} className="concept-child-card" href={child.href}>
                  <span className="concept-child-card__name">{child.name}</span>
                  {child.count !== undefined && (
                    <span className="concept-child-card__count">{child.count}</span>
                  )}
                </a>
              ))}
            </section>
          )}

          {/* Matching substances */}
          {matchingSubstances.length > 0 && (
            <section className="concept-entities">
              <h2>Вещества ({matchingSubstances.length})</h2>
              <div className="concept-entities__grid">
                {matchingSubstances.map(s => (
                  <FormulaChip
                    key={s.id}
                    formula={s.formula}
                    name={s.name}
                    substanceId={s.id}
                    substanceClass={s.class}
                    locale={locale}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Matching reactions */}
          {matchingReactions.length > 0 && (
            <section className="concept-entities">
              <h2>Реакции ({matchingReactions.length})</h2>
              <div className="concept-reactions__list">
                {matchingReactions.map(r => (
                  <div key={r.reaction_id} className="concept-reaction-card">
                    <div className="concept-reaction-card__equation">{r.equation}</div>
                    <div className="concept-reaction-card__title">{r.title}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </ConceptProvider>
    </FormulaLookupProvider>
  );
}
