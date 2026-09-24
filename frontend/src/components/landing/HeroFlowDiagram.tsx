import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, BookOpen, Check, Copy, Hash } from "lucide-react";

/**
 * Honest animated hero — mirrors the real product instead of a generic
 * pipeline sketch:
 * - 7 stage pills with the REAL board names (landing.stages.*: Idea,
 *   Planning, Approval, Ready, In Progress, Review, Done).
 * - ONE task card rendered with real TaskCard fields (key chip with copy
 *   affordance, priority dot + label, story-points chip, due date, DoD badge).
 * - An AI plan block shaped like AiPlanPanel output (summary + Steps list +
 *   Definition of Done bullets, Pending badge).
 * - A wiki entry row with a real KnowledgeEntryCard status badge (Accepted)
 *   and a real `w {weight}` weight chip.
 *
 * Decorative (role="img"): every inner element is a non-focusable span/div so
 * the img role stays valid. Theme-aware via design tokens. CSS-only motion
 * (animate-float-slow / animate-glow-pulse, settled by the global
 * prefers-reduced-motion guard) plus a mouse-tilt 3D wrapper (max ~6deg,
 * skipped under reduced-motion, reset on leave). Desktop + mobile layouts via
 * the hidden md:block / md:hidden pattern. Pure React/CSS, no new deps.
 */
export function HeroFlowDiagram({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({
      rx: Math.max(-6, Math.min(6, -py * 12)),
      ry: Math.max(-6, Math.min(6, px * 12)),
    });
  }

  function handleLeave() {
    setTilt({ rx: 0, ry: 0 });
  }

  // Static t() calls so i18n-usage can verify every key exists.
  const stages = [
    t("landing.stages.idea"),
    t("landing.stages.planning"),
    t("landing.stages.approval"),
    t("landing.stages.ready"),
    t("landing.stages.inProgress"),
    t("landing.stages.review"),
    t("landing.stages.done"),
  ];
  const activeStage = t("landing.stages.inProgress");

  const steps = [
    t("landing.hero.flow.checklistTitle"),
    t("landing.hero.flow.checklistPassed"),
    t("landing.hero.flow.version"),
  ];
  const dod = [t("landing.hero.flow.approved"), t("landing.hero.flow.applied")];

  const label = `${t("landing.hero.flow.taskId")} ${t("landing.hero.flow.taskTitle")}`;

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ perspective: "1200px" }}
      className={className}
    >
      <div
        role="img"
        aria-label={label}
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: tilt.rx === 0 && tilt.ry === 0 ? "transform 0.25s ease-out" : undefined,
          transformStyle: "preserve-3d",
        }}
        className="w-full"
      >
        {/* ─── Desktop ─── */}
        <div className="hidden w-full md:block">
          {/* 7 real stage pills */}
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            {stages.map((s) => {
              const active = s === activeStage;
              return (
                <span
                  key={s}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    active
                      ? "bg-primary text-on-primary"
                      : "border border-border-strong bg-card text-foreground"
                  }`}
                >
                  {active && (
                    <span
                      className="size-1.5 rounded-full bg-on-primary animate-glow-pulse"
                      aria-hidden
                    />
                  )}
                  {s}
                </span>
              );
            })}
          </div>

          <div className="grid grid-cols-2 items-start gap-4 text-left">
            {/* Task card — real TaskCard fields */}
            <div className="rounded-xl border border-border-strong bg-card p-3.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)]">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-foreground">
                  {t("landing.hero.flow.taskTitle")}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                  {t("landing.hero.flow.taskId")}
                  <Copy className="size-3" aria-hidden />
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {t("landing.hero.flow.overview")}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-amber-300" aria-hidden />
                  {t("task.high")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-strong">
                  <Hash className="size-3" aria-hidden />5
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">Sep 28</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-500">
                  <Check className="size-3" aria-hidden />
                  {t("board.dodMet")}
                </span>
              </div>
            </div>

            {/* AI plan block — AiPlanPanel output shape */}
            <div className="rounded-xl border border-violet-400/25 bg-violet-400/5 p-3.5 animate-float-slow">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400">
                  <Brain className="size-3.5" aria-hidden />
                  {t("landing.hero.flow.aiPlan")}
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">
                  {t("ai.pending")}
                </span>
              </div>
              <p className="mb-2 text-xs leading-relaxed text-foreground">
                {t("landing.hero.flow.aiPlanDesc")}
              </p>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ai.steps")}
              </p>
              <ol className="mb-2 list-inside list-decimal space-y-0.5 text-[11px] leading-snug text-muted-foreground">
                {steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ai.dod")}
              </p>
              <ul role="list" className="space-y-0.5">
                {dod.map((d) => (
                  <li
                    key={d}
                    className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground"
                  >
                    <span className="mt-0.5 shrink-0" aria-hidden>
                      •
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary">
                  {t("ai.applyPlan")}
                </span>
                <span className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {t("ai.regenerate")}
                </span>
              </div>
            </div>
          </div>

          {/* Wiki entry row — real KnowledgeEntryCard badges */}
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left">
            <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
              ADR-127: No client cache
            </span>
            <span className="shrink-0 rounded-md border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {t("knowledge.type.Adr")}
            </span>
            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
              {t("knowledge.status.Accepted")}
            </span>
            <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              w 0.94
            </span>
          </div>
        </div>

        {/* ─── Mobile (stacked) ─── */}
        <div className="w-full md:hidden">
          <div className="mb-4 grid grid-cols-2 gap-1.5">
            {stages.map((s) => {
              const active = s === activeStage;
              return (
                <span
                  key={s}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-center text-[11px] font-semibold ${
                    active
                      ? "bg-primary text-on-primary"
                      : "border border-border-strong bg-card text-foreground"
                  }`}
                >
                  {active && (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-on-primary animate-glow-pulse"
                      aria-hidden
                    />
                  )}
                  {s}
                </span>
              );
            })}
          </div>

          <div className="space-y-3 text-left">
            <div className="rounded-xl border border-border-strong bg-card p-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-foreground">
                  {t("landing.hero.flow.taskTitle")}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                  {t("landing.hero.flow.taskId")}
                  <Copy className="size-3" aria-hidden />
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {t("landing.hero.flow.overview")}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-amber-300" aria-hidden />
                  {t("task.high")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-strong">
                  <Hash className="size-3" aria-hidden />5
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">Sep 28</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-500">
                  <Check className="size-3" aria-hidden />
                  {t("board.dodMet")}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-violet-400/25 bg-violet-400/5 p-3.5 animate-float-slow">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400">
                  <Brain className="size-3.5" aria-hidden />
                  {t("landing.hero.flow.aiPlan")}
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">
                  {t("ai.pending")}
                </span>
              </div>
              <p className="mb-2 text-xs leading-relaxed text-foreground">
                {t("landing.hero.flow.aiPlanDesc")}
              </p>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ai.steps")}
              </p>
              <ol className="mb-2 list-inside list-decimal space-y-0.5 text-[11px] leading-snug text-muted-foreground">
                {steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ai.dod")}
              </p>
              <ul role="list" className="space-y-0.5">
                {dod.map((d) => (
                  <li
                    key={d}
                    className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground"
                  >
                    <span className="mt-0.5 shrink-0" aria-hidden>
                      •
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
              <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                ADR-127: No client cache
              </span>
              <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
                {t("knowledge.status.Accepted")}
              </span>
              <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                w 0.94
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
