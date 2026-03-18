import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Variable } from '../types/formula';
import type { PreviewContext, OntPreviewRequest, ResolvedOntPreview } from '../types/ont-preview';
import { resolveOntPreview } from '../lib/ont-preview/resolve-ont-preview';
import { buildCanonicalHref } from '../lib/ont-ref-registry';
import OntPreviewCard from './OntPreviewCard';
import './ont-interactive-ref.css';

interface Props {
  entityRef?: string;
  formulaVariable?: Variable;
  formulaId?: string;
  display: React.ReactNode;
  context?: PreviewContext;
  locale: string;
  children?: never;
}

// Module-level session cache
const previewCache = new Map<string, ResolvedOntPreview>();

function getCacheKey(props: Props): string | null {
  if (props.formulaVariable && props.formulaId) {
    return `fvar:${props.formulaId}:${props.formulaVariable.symbol}:${props.locale}`;
  }
  if (props.entityRef?.startsWith('formula:')) {
    return `formula:${props.entityRef}:${props.locale}`;
  }
  if (props.entityRef) {
    return `entity:${props.entityRef}:${props.locale}`;
  }
  return null;
}

function buildRequest(props: Props): OntPreviewRequest | null {
  if (props.formulaVariable && props.formulaId) {
    return {
      subjectKind: 'formula_variable',
      variable: props.formulaVariable,
      formulaId: props.formulaId,
      locale: props.locale,
      context: props.context,
    };
  }
  if (props.entityRef?.startsWith('formula:')) {
    return {
      subjectKind: 'formula',
      ref: props.entityRef,
      locale: props.locale,
      context: props.context,
    };
  }
  if (props.entityRef) {
    return {
      subjectKind: 'entity',
      ref: props.entityRef,
      locale: props.locale,
      context: props.context,
    };
  }
  return null;
}

export default function OntInteractiveRef(props: Props) {
  const { display, locale } = props;

  const [preview, setPreview] = useState<ResolvedOntPreview | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [positionAbove, setPositionAbove] = useState(false);

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Detect fine pointer (desktop) once
  const isFinePointer = useRef(
    typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (showTimerRef.current !== null) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const cancelHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const cancelShowTimer = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const checkPositionAbove = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    setPositionAbove(rect.bottom > viewportHeight * 0.6);
  }, []);

  const loadAndShow = useCallback(async () => {
    const request = buildRequest(props);
    if (!request) return;

    const cacheKey = getCacheKey(props);

    // Check cache first
    if (cacheKey && previewCache.has(cacheKey)) {
      const cached = previewCache.get(cacheKey)!;
      if (isMountedRef.current) {
        checkPositionAbove();
        setPreview(cached);
        setShowPopup(true);
      }
      return;
    }

    setLoading(true);
    try {
      const resolved = await resolveOntPreview(request);
      if (cacheKey) {
        previewCache.set(cacheKey, resolved);
      }
      if (isMountedRef.current) {
        checkPositionAbove();
        setPreview(resolved);
        setShowPopup(true);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [props, checkPositionAbove]);

  const handleWrapperMouseEnter = useCallback(() => {
    if (!isFinePointer.current) return;
    cancelHideTimer();
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      loadAndShow();
    }, 200);
  }, [cancelHideTimer, loadAndShow]);

  const handleWrapperMouseLeave = useCallback(() => {
    if (!isFinePointer.current) return;
    cancelShowTimer();
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (isMountedRef.current) setShowPopup(false);
    }, 150);
  }, [cancelShowTimer]);

  const handlePopupMouseEnter = useCallback(() => {
    cancelHideTimer();
  }, [cancelHideTimer]);

  const handlePopupMouseLeave = useCallback(() => {
    if (isMountedRef.current) setShowPopup(false);
  }, []);

  const handleClick = useCallback(() => {
    const href = preview?.target.canonicalHref;
    if (href) {
      window.location.href = href;
    }
  }, [preview]);

  // Escape key to close popup
  useEffect(() => {
    if (!showPopup) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPopup(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showPopup]);

  // Pre-compute navigability from props (don't wait for resolver)
  const immediateHref = useMemo(() => {
    if (props.entityRef) return buildCanonicalHref(props.entityRef, props.locale);
    return null;
  }, [props.entityRef, props.locale]);
  const canonicalHref = preview?.target.canonicalHref ?? immediateHref;
  const isNavigable = Boolean(canonicalHref);

  const wrapperClass = [
    'ont-iref',
    isNavigable ? 'ont-iref--navigable' : 'ont-iref--info-only',
    loading ? 'ont-iref--loading' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const popupClass = [
    'ont-iref__popup',
    positionAbove ? 'ont-iref__popup--above' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      ref={wrapperRef}
      className={wrapperClass}
      onMouseEnter={handleWrapperMouseEnter}
      onMouseLeave={handleWrapperMouseLeave}
      onClick={isNavigable ? handleClick : undefined}
      role={isNavigable ? 'link' : undefined}
      tabIndex={isNavigable ? 0 : undefined}
      onKeyDown={
        isNavigable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') handleClick();
            }
          : undefined
      }
    >
      {display}
      {showPopup && preview && (
        <span
          className={popupClass}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        >
          <OntPreviewCard
            data={preview.data}
            onClose={() => setShowPopup(false)}
          />
        </span>
      )}
    </span>
  );
}
