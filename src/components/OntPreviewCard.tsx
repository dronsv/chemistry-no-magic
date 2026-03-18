import type { OntPreviewData } from '../types/ont-preview';
import './ont-preview-card.css';

interface Props {
  data: OntPreviewData;
  onClose?: () => void;
}

export default function OntPreviewCard({ data, onClose }: Props) {
  return (
    <div className="ont-preview-card" role="dialog" aria-label={data.title}>
      <div className="ont-preview-card__header">
        <span className="ont-preview-card__title">{data.title}</span>
        {data.subtitle && <span className="ont-preview-card__subtitle">{data.subtitle}</span>}
        {onClose && <button className="ont-preview-card__close" onClick={onClose} aria-label="Close">×</button>}
      </div>

      {data.description && (
        <p className="ont-preview-card__desc">{data.description}</p>
      )}

      {data.chips && data.chips.length > 0 && (
        <div className="ont-preview-card__chips">
          {data.chips.map((chip, i) => (
            <span key={i} className={`ont-preview-card__chip ont-preview-card__chip--${chip.variant ?? 'default'}`}>
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {data.facts && data.facts.length > 0 && (
        <dl className="ont-preview-card__facts">
          {data.facts.map((fact, i) => (
            <div key={i} className="ont-preview-card__fact">
              <dt>{fact.label}</dt>
              <dd>{fact.value}{fact.unit ? ` ${fact.unit}` : ''}</dd>
            </div>
          ))}
        </dl>
      )}

      {data.primaryAction && (
        <a className="ont-preview-card__action" href={data.primaryAction.href}>
          {data.primaryAction.label} →
        </a>
      )}
    </div>
  );
}
