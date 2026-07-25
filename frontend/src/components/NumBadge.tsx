// A big actionable number + small label (e.g. "6 required", "1 can skip").
// The number is the hero; the label is small context.
export default function NumBadge({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex shrink-0 items-baseline gap-1.5">
      <span className={`text-3xl font-extrabold ${tone}`}>{n}</span>
      <span className="max-w-[3.5rem] text-[11px] font-medium uppercase leading-tight text-text-muted">
        {label}
      </span>
    </div>
  );
}
