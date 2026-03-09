import { useEffect, useState } from 'react';
import { loadBridgeExplanations } from '../lib/data-loader';
import type { BridgeExplanation } from '../types/foundations';
import type { SupportedLocale } from '../types/i18n';
import { localizeUrl } from '../lib/i18n';
import * as m from '../paraglide/messages.js';

interface Props {
  bridgeId: string;
  locale?: SupportedLocale;
}

export default function PhysFoundationHint({ bridgeId, locale = 'ru' }: Props) {
  const [bridge, setBridge] = useState<BridgeExplanation | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadBridgeExplanations(locale).then(bridges => {
      const found = bridges.find(b => b.id === bridgeId);
      if (found) setBridge(found);
    });
  }, [bridgeId, locale]);

  if (!bridge) return null;

  const title = bridge.title ?? bridge.id;
  const deepLink = localizeUrl(`/physical-foundations/`, locale) + `#${bridgeId}`;

  return (
    <div className="phys-hint">
      <div className="phys-hint__bar">
        <span className="phys-hint__icon">ℹ</span>
        <span className="phys-hint__title">{title}</span>
        <button
          className="phys-hint__toggle"
          type="button"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
        >
          {expanded ? m.phys_hint_collapse() : m.phys_hint_expand()}
        </button>
      </div>

      {expanded && (
        <div className="phys-hint__body">
          {bridge.hint && <p className="phys-hint__text">{bridge.hint}</p>}
          <a href={deepLink} className="phys-hint__ref-link">
            {m.phys_hint_open_ref()}
          </a>
        </div>
      )}
    </div>
  );
}
