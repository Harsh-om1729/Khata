/** The number is always written next to the bar. */
export function ProgressBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div class="progress">
      <span class="progress__text">
        {label} <strong>{percent}%</strong>
      </span>
      <span class="progress__track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span class="progress__fill" style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}
