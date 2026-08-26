import { useTranslation } from "react-i18next";

/**
 * Animated SVG flow diagram for the landing hero — mirrors the reference site's
 * "Idea → AI Planning → Approved → In Progress → Review → Done" pipeline with a
 * task card, AI plan, approval badge, progress bars, and a testing checklist.
 *
 * Theme-aware: every fill/stroke is a var(--color-*) token so it adapts to dark
 * and light. Two viewBoxes: desktop (900x440) side-by-side and mobile (360x560)
 * stacked. The connecting line animates via stroke-dashoffset (reduced-motion
 * safe through the global prefers-reduced-motion guard in index.css).
 */
export function HeroFlowDiagram({ className = "" }: { className?: string }) {
  const { t } = useTranslation();

  // ── shared text ─────────────────────────────────────────────────────────
  const stages = [
    { key: "idea", y: 52 },
    { key: "planning", y: 52 },
    { key: "approved", y: 52 },
    { key: "inProgress", y: 52 },
    { key: "review", y: 52 },
    { key: "done", y: 52 },
  ];
  const stageLabel = (k: string) => t(`landing.stages.${k}`);

  return (
    <>
      {/* ─── Desktop (side-by-side flow) ─── */}
      <svg
        viewBox="0 0 900 440"
        className={`hidden w-full overflow-visible md:block ${className}`}
        role="img"
        aria-label={t("landing.hero.flow.taskId") + " " + t("landing.hero.flow.taskTitle")}
        focusable="false"
        fill="none"
      >
        <defs>
          <linearGradient id="lf-flow-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="lf-ai-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* soft backing blob */}
        <ellipse cx="450" cy="220" rx="420" ry="200" fill="url(#lf-flow-grad)" />

        {/* ── stage pills row ── */}
        {stages.map((s, i) => {
          const x = 40 + i * 138;
          const active = s.key === "inProgress";
          return (
            <g key={s.key}>
              <rect
                x={x}
                y={s.y}
                width={118}
                height={40}
                rx={20}
                fill={active ? "var(--color-primary)" : "var(--color-card)"}
                stroke={active ? "none" : "var(--color-border-strong)"}
                strokeWidth="1.5"
              />
              {active && (
                <circle cx={x + 118} cy={s.y + 20} r={10} fill="var(--color-primary)" opacity="0.35" className="animate-glow-pulse" />
              )}
              <text
                x={x + 59}
                y={s.y + 25}
                textAnchor="middle"
                fontSize="12"
                fontWeight={active ? 700 : 600}
                fill={active ? "var(--color-on-primary)" : "var(--color-foreground)"}
              >
                {stageLabel(s.key)}
              </text>
            </g>
          );
        })}

        {/* connector line through the centers of the stage pills, so it reads
            as one connected pipeline instead of a floating bar */}
        <path
          d="M99 92 H789"
          stroke="var(--color-border-strong)"
          strokeWidth="2"
          strokeDasharray="6 6"
          className="animate-dash-flow"
        />
        {stages.map((s, i) => {
          const cx = 99 + i * 138;
          const active = s.key === "inProgress";
          return (
            <circle
              key={s.key}
              cx={cx}
              cy="92"
              r={active ? 6 : 3}
              fill={active ? "var(--color-primary)" : "var(--color-border-strong)"}
            />
          );
        })}

        {/* ── task card (left) ── */}
        <g>
          <rect x="48" y="120" width="250" height="150" rx="12" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
          <rect x="48" y="120" width="250" height="36" rx="12" fill="var(--color-elevated)" />
          <rect x="48" y="144" width="250" height="12" fill="var(--color-elevated)" />
          <circle cx="72" cy="138" r="8" fill="var(--color-primary)" opacity="0.7" />
          <text x="90" y="142" fontSize="13" fontWeight="700" fill="var(--color-foreground)">
            {t("landing.hero.flow.taskId")} · {t("landing.hero.flow.taskTitle")}
          </text>
          {/* description lines */}
          <rect x="66" y="172" width="214" height="6" rx="3" fill="var(--color-elevated)" />
          <rect x="66" y="186" width="180" height="6" rx="3" fill="var(--color-elevated)" />
          <rect x="66" y="200" width="200" height="6" rx="3" fill="var(--color-elevated)" />
          {/* meta row */}
          <rect x="66" y="222" width="40" height="16" rx="4" fill="var(--color-elevated)" />
          <rect x="116" y="228" width="30" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.4" />
          <rect x="156" y="228" width="30" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.4" />
          <rect x="196" y="228" width="30" height="5" rx="2.5" fill="var(--color-muted-foreground)" opacity="0.4" />
          {/* progress bar */}
          <rect x="66" y="252" width="214" height="6" rx="3" fill="var(--color-elevated)" />
          <rect x="66" y="252" width="140" height="6" rx="3" fill="var(--color-primary)" />
        </g>

        {/* ── AI Plan card (center) ── */}
        <g className="animate-float-slow">
          <rect x="330" y="130" width="240" height="150" rx="12" fill="url(#lf-ai-grad)" stroke="#8b5cf6" strokeOpacity="0.35" strokeWidth="1.5" />
          <rect x="330" y="130" width="240" height="36" rx="12" fill="#8b5cf6" opacity="0.15" />
          <rect x="330" y="154" width="240" height="12" fill="url(#lf-ai-grad)" />
          <circle cx="352" cy="148" r="7" fill="#8b5cf6" opacity="0.8" />
          <text x="368" y="152" fontSize="13" fontWeight="700" fill="var(--color-foreground)">
            {t("landing.hero.flow.aiPlan")}
          </text>
          <rect x="348" y="180" width="200" height="6" rx="3" fill="var(--color-elevated)" opacity="0.9" />
          <rect x="348" y="194" width="168" height="6" rx="3" fill="var(--color-elevated)" opacity="0.9" />
          <rect x="348" y="208" width="186" height="6" rx="3" fill="var(--color-elevated)" opacity="0.9" />
          <rect x="348" y="222" width="120" height="6" rx="3" fill="var(--color-elevated)" opacity="0.9" />
          {/* approved badge */}
          <rect x="390" y="244" width="120" height="24" rx="12" fill="var(--color-primary)" />
          <text x="450" y="260" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--color-on-primary)">
            {t("landing.hero.flow.approved")}
          </text>
        </g>

        {/* ── checklist card (right) ── */}
        <g>
          <rect x="602" y="120" width="250" height="150" rx="12" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
          <rect x="620" y="136" width="140" height="10" rx="5" fill="var(--color-muted-foreground)" opacity="0.5" />
          {/* checklist rows */}
          {[0, 1, 2, 3].map((i) => {
            const y = 162 + i * 22;
            const passed = i < 3;
            return (
              <g key={i}>
                <rect x="620" y={y} width="14" height="14" rx="4" fill={passed ? "var(--color-primary)" : "var(--color-elevated)"} stroke={passed ? "none" : "var(--color-border-strong)"} strokeWidth="1.5" />
                {passed && <path d={`M624 ${y + 7} l3 3 l5 -6`} stroke="var(--color-on-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                <rect x="642" y={y + 2} width="120" height="6" rx="3" fill="var(--color-elevated)" />
                <rect x="772" y={y + 2} width="52" height="6" rx="3" fill={passed ? "var(--color-primary)" : "var(--color-elevated)"} />
              </g>
            );
          })}
          {/* passed badge + version */}
          <rect x="620" y="252" width="76" height="22" rx="11" fill="var(--color-primary)" />
          <text x="658" y="267" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--color-on-primary)">
            {t("landing.hero.flow.checklistPassed").toUpperCase()}
          </text>
          <rect x="728" y="254" width="66" height="18" rx="4" fill="var(--color-elevated)" stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x="761" y="267" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill="var(--color-foreground)">
            {t("landing.hero.flow.version")}
          </text>
        </g>
      </svg>

      {/* ─── Mobile (stacked vertical flow) ─── */}
      <svg
        viewBox="0 0 360 560"
        className={`w-full overflow-visible md:hidden ${className}`}
        role="img"
        aria-label={t("landing.hero.flow.taskId") + " " + t("landing.hero.flow.taskTitle")}
        focusable="false"
        fill="none"
      >
        <defs>
          <linearGradient id="lf-flow-grad-m" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        <ellipse cx="180" cy="280" rx="190" ry="270" fill="url(#lf-flow-grad-m)" />

        {/* stacked stage pills */}
        {stages.map((s, i) => {
          const y = 20 + i * 46;
          const active = s.key === "inProgress";
          return (
            <g key={s.key}>
              <rect x="36" y={y} width="288" height="36" rx="18" fill={active ? "var(--color-primary)" : "var(--color-card)"} stroke={active ? "none" : "var(--color-border-strong)"} strokeWidth="1.5" />
              <text x="180" y={y + 23} textAnchor="middle" fontSize="13" fontWeight={active ? 700 : 600} fill={active ? "var(--color-on-primary)" : "var(--color-foreground)"}>
                {stageLabel(s.key)}
              </text>
            </g>
          );
        })}

        {/* task card */}
        <rect x="36" y="300" width="288" height="120" rx="12" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
        <rect x="36" y="300" width="288" height="34" rx="12" fill="var(--color-elevated)" />
        <rect x="36" y="322" width="288" height="12" fill="var(--color-elevated)" />
        <circle cx="60" cy="317" r="8" fill="var(--color-primary)" opacity="0.7" />
        <text x="78" y="321" fontSize="13" fontWeight="700" fill="var(--color-foreground)">
          {t("landing.hero.flow.taskId")} · {t("landing.hero.flow.taskTitle")}
        </text>
        <rect x="54" y="346" width="252" height="6" rx="3" fill="var(--color-elevated)" />
        <rect x="54" y="360" width="200" height="6" rx="3" fill="var(--color-elevated)" />
        <rect x="54" y="388" width="252" height="6" rx="3" fill="var(--color-elevated)" />
        <rect x="54" y="400" width="168" height="6" rx="3" fill="var(--color-primary)" />

        {/* checklist */}
        <rect x="36" y="436" width="288" height="108" rx="12" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
        {[0, 1, 2, 3].map((i) => {
          const y = 452 + i * 20;
          const passed = i < 3;
          return (
            <g key={i}>
              <rect x="54" y={y} width="14" height="14" rx="4" fill={passed ? "var(--color-primary)" : "var(--color-elevated)"} stroke={passed ? "none" : "var(--color-border-strong)"} strokeWidth="1.5" />
              {passed && <path d={`M58 ${y + 7} l3 3 l5 -6`} stroke="var(--color-on-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
              <rect x="76" y={y + 3} width="120" height="6" rx="3" fill="var(--color-elevated)" />
            </g>
          );
        })}
      </svg>
    </>
  );
}
