interface EmptyStateProps {
  icon: React.ReactNode;
  /** When provided, renders a large illustration instead of `icon`. */
  illustration?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      {illustration ?? (
        <span className="flex size-20 items-center justify-center rounded-2xl bg-elevated/60 text-muted-foreground">
          {icon}
        </span>
      )}
      {title && <p className="font-display text-lg font-semibold">{title}</p>}
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
