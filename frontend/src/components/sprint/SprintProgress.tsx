interface SprintProgressProps {
  total: number;
  completed: number;
  className?: string;
}

export function SprintProgress({
  total,
  completed,
  className = "",
}: SprintProgressProps) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const barColor =
    pct < 30 ? "bg-destructive" : pct <= 70 ? "bg-amber-400" : "bg-primary";

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>
          {completed}/{total} tasks done
        </span>
        <span>{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Sprint progress: ${completed} of ${total} tasks completed`}
        className="h-1.5 overflow-hidden rounded-full bg-elevated"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${total === 0 ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}
