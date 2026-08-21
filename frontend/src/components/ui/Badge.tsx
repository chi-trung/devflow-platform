interface BadgeProps {
  children: string;
  tone?: "teal" | "orange" | "neutral";
}

const toneClasses = {
  teal: "bg-primary/10 text-primary",
  orange: "bg-accent/10 text-accent",
  neutral: "bg-muted text-muted-foreground",
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-xs font-medium uppercase ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
