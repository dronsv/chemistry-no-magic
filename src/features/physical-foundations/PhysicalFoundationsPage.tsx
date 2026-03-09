import { useEffect, useState } from 'react';
import {
  loadBridgeExplanations,
  loadMechanisms,
  loadPhysicalConcepts,
} from '../../lib/data-loader';
import type { BridgeExplanation, Mechanism, PhysicalConcept } from '../../types/foundations';
import type { SupportedLocale } from '../../types/i18n';
import './physical-foundations.css';

interface Props {
  locale: SupportedLocale;
}

export default function PhysicalFoundationsPage({ locale }: Props) {
  const [bridges, setBridges] = useState<BridgeExplanation[]>([]);
  const [mechanisms, setMechanisms] = useState<Mechanism[]>([]);
  const [concepts, setConcepts] = useState<PhysicalConcept[]>([]);

  useEffect(() => {
    Promise.all([
      loadBridgeExplanations(locale),
      loadMechanisms(locale),
      loadPhysicalConcepts(locale),
    ]).then(([b, m, c]) => {
      setBridges(b);
      setMechanisms(m);
      setConcepts(c);
    });
  }, [locale]);

  const mechById = Object.fromEntries(mechanisms.map(m => [m.id, m]));
  const conceptById = Object.fromEntries(concepts.map(c => [c.id, c]));

  if (bridges.length === 0) {
    return <div className="pf-page pf-page--loading" />;
  }

  return (
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
        {bridges.map(bridge => (
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

            {bridge.school_explanation && (
              <div className="pf-bridge__explanation">
                {bridge.school_explanation}
              </div>
            )}

            {bridge.mechanism_ids.length > 0 && (
              <div className="pf-bridge__mechanisms">
                <h3 className="pf-bridge__mechanisms-heading">
                  {locale === 'ru' ? 'Цепочка механизмов' : 'Mechanism chain'}
                </h3>
                <ol className="pf-bridge__mechanism-list">
                  {bridge.mechanism_ids.map((mid, i) => {
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
                {bridge.prerequisite_concepts.map((cid, i) => {
                  const concept = conceptById[cid];
                  return (
                    <span key={cid} className="pf-concept-chip">
                      {concept?.name ?? cid}
                    </span>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
