interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percent = Math.round((current / total) * 100);

  return (
    <div className="diag-progress">
      <span className="diag-progress__label">
        Вопрос {current} из {total}
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
