import { useEffect, useState } from 'react';
import {
  loadBridgeExplanations,
  loadMechanisms,
  loadPhysicalConcepts,
  loadPhysicalIndices,
  loadFormulaLookup,
} from '../../lib/data-loader';
import type { BridgeExplanation, Mechanism, PhysicalConcept, PhysicalIndices } from '../../types/foundations';
import type { FormulaLookup } from '../../types/formula-lookup';
import type { SupportedLocale } from '../../types/i18n';
import { localizeUrl } from '../../lib/i18n';
import { FormulaLookupProvider } from '../../components/ChemText';
import RichTextRenderer from '../../components/RichTextRenderer';
import FormulaChip from '../../components/FormulaChip';
import './physical-foundations.css';

interface Props {
  locale: SupportedLocale;
}

export default function PhysicalFoundationsPage({ locale }: Props) {
  const [bridges, setBridges] = useState<BridgeExplanation[]>([]);
  const [mechanisms, setMechanisms] = useState<Mechanism[]>([]);
  const [concepts, setConcepts] = useState<PhysicalConcept[]>([]);
  const [indices, setIndices] = useState<PhysicalIndices | null>(null);
  const [formulaLookup, setFormulaLookup] = useState<FormulaLookup | null>(null);

  useEffect(() => {
    Promise.all([
      loadBridgeExplanations(locale),
      loadMechanisms(locale),
      loadPhysicalConcepts(locale),
      loadPhysicalIndices(),
      loadFormulaLookup(),
    ]).then(([b, m, c, idx, fl]) => {
      setBridges(b);
      setMechanisms(m);
      setConcepts(c);
      setIndices(idx);
      setFormulaLookup(fl);
    });
  }, [locale]);

  const mechById = Object.fromEntries(mechanisms.map(m => [m.id, m]));
  const conceptById = Object.fromEntries(concepts.map(c => [c.id, c]));

  if (bridges.length === 0) {
    return <div className="pf-page pf-page--loading" />;
  }

  return (
    <FormulaLookupProvider value={formulaLookup}>
      <div className="pf-page">
        <header className="pf-page__header">
        <h1 className="pf-page__title">
          {locale === 'ru' ? 'Физические основы химии' : 'Physical Foundations of Chemistry'}
        </h1>
        <p className="pf-page__lead">
          {locale === 'ru'
            ? 'Здесь объясняется, почему работают законы химии — через физические механизмы.'
            : 'Here we explain why chemistry laws work — through physical mechanisms.'}
        </p>
      </header>

      <div className="pf-page__bridges">
        {bridges.map(bridge => {
          const pageLinks = indices?.bridge_to_pages[bridge.id] ?? [];
          return (
            <section
              key={bridge.id}
              id={bridge.id}
              className="pf-bridge"
            >
              <h2 className="pf-bridge__title">
                {bridge.title ?? bridge.id}
              </h2>

              {bridge.hint && (
                <p className="pf-bridge__hint">{bridge.hint}</p>
              )}

              {(bridge.school_explanation_content || bridge.school_explanation) && (
                <div className="pf-bridge__explanation">
                  {bridge.school_explanation_content
                    ? <RichTextRenderer segments={bridge.school_explanation_content} locale={locale} />
                    : bridge.school_explanation}
                </div>
              )}

              {bridge.exception_element_ids && bridge.exception_element_ids.length > 0 && (
                <div className="pf-bridge__elements">
                  <span className="pf-bridge__prereqs-label">
                    {locale === 'ru' ? 'Элементы: ' : 'Elements: '}
                  </span>
                  {bridge.exception_element_ids.map(symbol => (
                    <FormulaChip
                      key={symbol}
                      formula={symbol}
                      substanceClass="simple"
                      elementId={symbol}
                      locale={locale}
                    />
                  ))}
                </div>
              )}

              {bridge.mechanism_ids.length > 0 && (
                <div className="pf-bridge__mechanisms">
                  <h3 className="pf-bridge__mechanisms-heading">
                    {locale === 'ru' ? 'Цепочка механизмов' : 'Mechanism chain'}
                  </h3>
                  <ol className="pf-bridge__mechanism-list">
                    {bridge.mechanism_ids.map(mid => {
                      const mech = mechById[mid];
                      return (
                        <li key={mid} className="pf-mechanism">
                          {mech?.name ?? mid}
                          {mech?.school && (
                            <p className="pf-mechanism__detail">{mech.school}</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {bridge.prerequisite_concepts.length > 0 && (
                <div className="pf-bridge__prereqs">
                  <span className="pf-bridge__prereqs-label">
                    {locale === 'ru' ? 'Понятия: ' : 'Concepts: '}
                  </span>
                  {bridge.prerequisite_concepts.map(cid => {
                    const concept = conceptById[cid];
                    return (
                      <span key={cid} className="pf-concept-chip">
                        {concept?.name ?? cid}
                      </span>
                    );
                  })}
                </div>
              )}

              {pageLinks.length > 0 && (
                <div className="pf-bridge__pages">
                  <span className="pf-bridge__pages-label">
                    {locale === 'ru' ? 'Используется на: ' : 'Used on: '}
                  </span>
                  {pageLinks.map(slug => (
                    <a key={slug} href={localizeUrl(`/${slug}/`, locale)} className="pf-bridge__page-link">
                      {slug}
                    </a>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
    </FormulaLookupProvider>
  );
}
