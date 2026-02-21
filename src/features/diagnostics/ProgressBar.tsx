import * as m from '../../paraglide/messages.js';

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percent = Math.round((current / total) * 100);

  return (
    <div className="diag-progress">
      <span className="diag-progress__label">
        {m.diag_progress({ current: String(current), total: String(total) })}
      </span>
      <div className="diag-progress__track">
        <div
          className="diag-progress__fill"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
