import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Ion } from '../types/ion';
import type { SupportedLocale } from '../types/i18n';
import { loadIons } from '../lib/data-loader';
import { parseFormulaParts } from '../lib/formula-render';
import * as m from '../paraglide/messages.js';
import FormulaChip from './FormulaChip';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface IonDetailsContextValue {
  showIonDetails: (ionId: string, anchorRect: DOMRect) => void;
}

const IonDetailsCtx = createContext<IonDetailsContextValue | null>(null);

export function useIonDetails(): IonDetailsContextValue | null {
  return useContext(IonDetailsCtx);
}

// ---------------------------------------------------------------------------
// IonDetails popup component
// ---------------------------------------------------------------------------

interface PopupState {
  ionId: string;
  anchorRect: DOMRect;
}

function IonDetailsPopup({
  ionId,
  anchorRect,
  onClose,
  locale,
}: {
  ionId: string;
  anchorRect: DOMRect;
  onClose: () => void;
  locale: SupportedLocale;
}) {
  const [ion, setIon] = useState<Ion | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadIons(locale).then(ions => {
      const found = ions.find(i => i.id === ionId);
      setIon(found ?? null);
    });
  }, [ionId, locale]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid closing from the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Position: try above the anchor, fall back to below
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const style: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderRadius: '1rem 1rem 0 0',
        maxHeight: '60vh',
      }
    : {
        position: 'fixed',
        left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - 280)),
        top: anchorRect.top > 200
          ? anchorRect.top - 8
          : anchorRect.bottom + 8,
        transform: anchorRect.top > 200 ? 'translateY(-100%)' : undefined,
        maxWidth: 320,
      };

  const renderFormulaHtml = (formula: string) => {
    const parts = parseFormulaParts(formula);
    return parts.map((part, i) => {
      if (part.type === 'sup') return <sup key={i}>{part.content}</sup>;
      if (part.type === 'sub') return <sub key={i}>{part.content}</sub>;
      return <span key={i}>{part.content}</span>;
    });
  };

  return (
    <div
      className="ion-details-overlay"
      role="dialog"
      aria-label={m.ion_details_title()}
    >
      <div className="ion-details-popup" ref={popupRef} style={style}>
        {!ion ? (
          <div className="ion-details-popup__loading">{m.loading()}</div>
        ) : (
          <>
            <div className="ion-details-popup__header">
              <span className={`ion-details-popup__formula ion-details-popup__formula--${ion.type}`}>
                {renderFormulaHtml(ion.formula)}
              </span>
              <button className="ion-details-popup__close" onClick={onClose} type="button" aria-label={m.close_label()}>
                &times;
              </button>
            </div>
            <div className="ion-details-popup__body">
              <div className="ion-details-popup__name">{ion.name_ru}</div>
              <div className="ion-details-popup__meta">
                <span className="ion-details-popup__meta-label">{m.ion_type_label()}:</span>
                <span className={`ion-details-popup__badge ion-details-popup__badge--${ion.type}`}>
                  {ion.type === 'cation' ? m.ion_cation() : m.ion_anion()}
                </span>
              </div>
              <div className="ion-details-popup__meta">
                <span className="ion-details-popup__meta-label">{m.ion_charge()}:</span>
                <span>{ion.charge > 0 ? `+${ion.charge}` : ion.charge}</span>
              </div>
              {ion.parent_acid && (
                <div className="ion-details-popup__meta">
                  <span className="ion-details-popup__meta-label">{m.ion_parent_acid()}:</span>
                  <FormulaChip
                    formula={ion.parent_acid}
                    substanceClass="acid"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function IonDetailsProvider({
  locale = 'ru' as SupportedLocale,
  children,
}: {
  locale?: SupportedLocale;
  children: ReactNode;
}) {
  const [popup, setPopup] = useState<PopupState | null>(null);

  const showIonDetails = useCallback((ionId: string, anchorRect: DOMRect) => {
    setPopup({ ionId, anchorRect });
  }, []);

  const closePopup = useCallback(() => {
    setPopup(null);
  }, []);

  return (
    <IonDetailsCtx.Provider value={{ showIonDetails }}>
      {children}
      {popup && (
        <IonDetailsPopup
          ionId={popup.ionId}
          anchorRect={popup.anchorRect}
          onClose={closePopup}
          locale={locale}
        />
      )}
    </IonDetailsCtx.Provider>
  );
}
