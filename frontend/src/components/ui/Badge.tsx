interface BadgeProps {
  children: React.ReactNode;
  tone?: "teal" | "red" | "amber" | "violet" | "neutral";
}

const toneClasses = {
  teal: "bg-primary/10 text-primary",
  red: "bg-destructive/10 text-destructive",
  amber: "bg-amber-400/10 text-amber-300",
  violet: "bg-violet-400/10 text-violet-300",
  neutral: "bg-elevated text-muted-foreground",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
