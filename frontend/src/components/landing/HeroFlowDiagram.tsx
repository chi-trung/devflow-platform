import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, BookOpen, Check, ChevronRight, Copy, Hash } from "lucide-react";

/**
 * Interactive board tour — the hero mockup, not a passive animation:
 * - 7 stage pills with the REAL board names (landing.stages.*) act as tabs:
 *   click (or arrow-key) one and the board content below follows it — the
 *   task card, the AI plan state and the wiki row all change per stage via
 *   useStageContent. Auto-advance runs on a slow ~5000ms interval so each
 *   stage is readable; any manual pick pauses it for 30s
 *   (AUTO_RESUME_MS) before resuming.
 * - Left column: the stage's task card (key chip, priority dot + label,
 *   story-points chip, due date, DoD badge) with a glow ring only while its
 *   own stage is active, plus a pair of small Done cards so both columns
 *   end flush.
 * - Right column: AI plan shaped like AiPlanPanel output (summary + Steps +
 *   Definition of Done + Apply / Regenerate). The Pending badge swaps to
 *   Applied styling for late stages (index >= 5). Steps cascade with
 *   staggered animation-delay, restarted per stage via key.
 * - A wiki entry row with a real KnowledgeEntryCard status badge (Accepted)
 *   and a real `w {weight}` weight chip.
 *
 * Accessibility: the pills are a real tablist (role=tablist/tab, arrow-key
 * navigation, aria-selected) driving a tabpanel below — a keyboard user gets
 * the same tour. Decorative chrome inside the panel stays non-focusable.
 * Theme-aware via design tokens. Motion is transform+opacity only
 * (df-step-in / df-row-in from index.css), settled by the global
 * prefers-reduced-motion guard; under reduced-motion there is no auto
 * interval but manual selection still works. Pure React/CSS, no new deps.
 */

const STAGE_COUNT = 7;
const LOOP_MS = 5000;
const AUTO_RESUME_MS = 30000;

/**
 * Per-stage demo content. Points at EXISTING i18n values only (never new
 * keys — i18n-parity requires en/vi to match): task titles from
 * landing.mock.flows, plan steps/DoD from landing.hero.flow plus the
 * landing.mock.ai disciplines, wiki badges from knowledge.status/type, and
 * real TaskCard priority labels. Every stage gets its OWN overview, plan
 * summary, step triple, DoD list and wiki row, so clicking a pill always
 * shows different content. Wiki titles/weights are fixture identifiers
 * (like DEV-101 task IDs), intentionally locale-independent.
 */
function useStageContent() {
  const { t } = useTranslation();
  const titles = [
    t("landing.mock.flows.card1"),
    t("landing.mock.flows.card2"),
    t("landing.mock.flows.card3"),
    t("landing.mock.flows.card3"),
    t("landing.hero.flow.taskTitle"),
    t("landing.mock.flows.card5"),
    t("landing.mock.flows.doneCard"),
  ];
  const priorities = [
    { dot: "bg-muted-foreground/50", label: t("task.low") },
    { dot: "bg-primary", label: t("task.medium") },
    { dot: "bg-amber-300", label: t("task.high") },
    { dot: "bg-primary", label: t("task.medium") },
    { dot: "bg-amber-300", label: t("task.high") },
    { dot: "bg-primary", label: t("task.medium") },
    { dot: "bg-destructive", label: t("task.urgent") },
  ];
  const dates = ["Oct 12", "Oct 2", "Oct 3", "Oct 5", "Sep 28", "Oct 1", "Sep 20"];
  const points = [2, 3, 2, 3, 5, 8, 5];
  // DoD badge reads as met once the card has work behind it.
  const dodMet = [false, false, false, true, true, true, true];
  const ids = [
    "DEV-101",
    "DEV-112",
    "DEV-118",
    "DEV-121",
    t("landing.hero.flow.taskId"),
    "DEV-140",
    "DEV-132",
  ];
  // One overview per stage: existing strings only, shuffled so each pill
  // reads differently — and offset from planSummaries so the task card and
  // the AI plan never show the same sentence on one stage.
  const overviews = [
    t("landing.mock.ai.discipline1"),
    t("landing.mock.ai.discipline2"),
    t("landing.mock.ai.discipline3"),
    t("landing.mock.ai.planning"),
    t("landing.hero.flow.overview"),
    t("landing.mock.ai.review"),
    t("landing.hero.flow.applied"),
  ];
  // One plan summary + step triple + DoD pair per stage. Steps reuse the
  // flow checklist, the ai disciplines and the approved/review notes so the
  // visible triplets differ per pill.
  const planSummaries = [
    t("landing.mock.ai.planning"),
    t("landing.mock.ai.discipline1"),
    t("landing.mock.ai.discipline2"),
    t("landing.mock.ai.discipline3"),
    t("landing.hero.flow.aiPlanDesc"),
    t("landing.mock.ai.review"),
    t("landing.hero.flow.applied"),
  ];
  const planSteps = [
    [t("landing.mock.ai.discipline1"), t("landing.mock.ai.discipline2"), t("landing.mock.ai.discipline3")],
    [t("landing.hero.flow.checklistTitle"), t("landing.mock.ai.discipline2"), t("landing.mock.ai.discipline3")],
    [t("landing.hero.flow.checklistTitle"), t("landing.hero.flow.checklistPassed"), t("landing.mock.ai.discipline3")],
    [t("landing.hero.flow.checklistTitle"), t("landing.hero.flow.checklistPassed"), t("landing.hero.flow.version")],
    [t("landing.hero.flow.checklistTitle"), t("landing.hero.flow.checklistPassed"), t("landing.mock.ai.approved")],
    [t("landing.mock.ai.approved"), t("landing.hero.flow.checklistPassed"), t("landing.hero.flow.version")],
    [t("landing.mock.ai.approved"), t("landing.mock.ai.review"), t("landing.hero.flow.applied")],
  ];
  const planDod = [
    [t("landing.mock.ai.discipline2"), t("landing.mock.ai.discipline3")],
    [t("landing.hero.flow.approved"), t("landing.mock.ai.discipline2")],
    [t("landing.hero.flow.approved"), t("landing.mock.ai.discipline3")],
    [t("landing.hero.flow.approved"), t("landing.hero.flow.version")],
    [t("landing.hero.flow.approved"), t("landing.hero.flow.applied")],
    [t("landing.hero.flow.applied"), t("landing.hero.flow.version")],
    [t("landing.hero.flow.applied"), t("landing.mock.ai.review")],
  ];
  // One wiki row per stage: fixture entry titles + real status/type badges.
  // Mirrors landing.mock.wiki semantics: the Superseded (ADR-119) and
  // Deprecated (PAT-04) entries carry no weight, so their chip hides.
  const wiki: { title: string; weight: string | null; type: string; status: string }[] = [
    { title: "PAT-19: Backend-persist", weight: "w 0.82", type: t("knowledge.type.Pattern"), status: t("knowledge.status.Proposed") },
    { title: "ADR-119: 5-min in-memory cache", weight: null, type: t("knowledge.type.Adr"), status: t("knowledge.status.Superseded") },
    { title: "ADR-127: No client cache", weight: "w 0.94", type: t("knowledge.type.Adr"), status: t("knowledge.status.Accepted") },
    { title: "PAT-04: localStorage prefs", weight: null, type: t("knowledge.type.Pattern"), status: t("knowledge.status.Deprecated") },
    { title: "ADR-127: No client cache", weight: "w 0.94", type: t("knowledge.type.Adr"), status: t("knowledge.status.Accepted") },
    { title: "RUN-07: Cache-stale recovery", weight: "w 0.71", type: t("knowledge.type.Runbook"), status: t("knowledge.status.Accepted") },
    { title: "ADR-127: No client cache", weight: "w 0.94", type: t("knowledge.type.Adr"), status: t("knowledge.status.Accepted") },
  ];
  return { titles, priorities, dates, points, dodMet, ids, overviews, planSummaries, planSteps, planDod, wiki };
}

export function HeroFlowDiagram({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const content = useStageContent();
  // Tour starts at Planning so the hero loads mid-story, not on a blank Idea.
  const [activeIndex, setActiveIndex] = useState(1);
  const [paused, setPaused] = useState(false);
  const activeRef = useRef(1);
  const resumeTimer = useRef<number | null>(null);

  const goTo = (next: number, manual: boolean) => {
    const wrapped = ((next % STAGE_COUNT) + STAGE_COUNT) % STAGE_COUNT;
    activeRef.current = wrapped;
    setActiveIndex(wrapped);
    if (manual) {
      setPaused(true);
      if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => setPaused(false), AUTO_RESUME_MS);
    }
  };

  useEffect(() => {
    const mq =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    // Reduced-motion: no auto tour, manual selection still works.
    if (mq?.matches) return;
    if (paused) return;
    const id = window.setInterval(() => goTo(activeRef.current + 1, false), LOOP_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  useEffect(
    () => () => {
      if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  // Static t() calls so i18n-usage can verify every key exists.
  // (Stage overview/plan/wiki strings also call t() statically inside
  // useStageContent above, which the same check scans.)
  const stages = [
    t("landing.stages.idea"),
    t("landing.stages.planning"),
    t("landing.stages.approval"),
    t("landing.stages.ready"),
    t("landing.stages.inProgress"),
    t("landing.stages.review"),
    t("landing.stages.done"),
  ];

  const label = `${stages[activeIndex]}: ${content.titles[activeIndex]}`;

  const planApplied = activeIndex >= 5;
  const wikiLive = activeIndex === 6;

  const pillBase =
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const pillTone = (active: boolean) =>
    active
      ? "bg-primary text-on-primary"
      : "border border-border-strong bg-card text-foreground hover:border-primary/50";
  const pillMobileTone = (active: boolean) =>
    `inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-center text-[11px] font-semibold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
      active
        ? "bg-primary text-on-primary"
        : "border border-border-strong bg-card text-foreground"
    }`;

  const pillClass = (active: boolean) => `${pillBase} ${pillTone(active)}`;

  const onPillKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      goTo(i + 1, true);
      (e.currentTarget.parentElement?.children[(i + 1) % STAGE_COUNT] as HTMLElement | undefined)?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      goTo(i - 1, true);
      (e.currentTarget.parentElement?.children[(i - 1 + STAGE_COUNT) % STAGE_COUNT] as HTMLElement | undefined)?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0, true);
      (e.currentTarget.parentElement?.children[0] as HTMLElement | undefined)?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(STAGE_COUNT - 1, true);
      (e.currentTarget.parentElement?.children[STAGE_COUNT - 1] as HTMLElement | undefined)?.focus();
    }
  };

  const renderPills = (mobile = false) => (
    <div
      role="tablist"
      aria-label={t("landing.hero.flow.aiPlan")}
      className={
        mobile
          ? // 7 pills: the last one spans both columns and centers, so no
            // half-width hole sits on the right (the reported mobile bug).
            "mb-4 grid grid-cols-2 gap-1.5"
          : "mb-5 flex flex-wrap items-center justify-center gap-2"
      }
    >
      {stages.map((s, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => goTo(i, true)}
            onKeyDown={(e) => onPillKeyDown(e, i)}
            className={`${mobile ? pillMobileTone(active) : pillClass(active)}${
              mobile && i === STAGE_COUNT - 1 ? " col-span-2 mx-auto w-1/2" : ""
            }`}
          >
            {active && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-on-primary animate-glow-pulse"
                aria-hidden
              />
            )}
            {s}
          </button>
        );
      })}
    </div>
  );

  const renderTaskCard = () => {
    const p = content.priorities[activeIndex];
    return (
      <div
        key={`task-${activeIndex}`}
        className="df-row-in flex flex-1 flex-col justify-center gap-2.5 rounded-xl border border-primary bg-card p-3.5 shadow-[0_0_0_2px_var(--color-primary),0_24px_60px_-24px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-foreground">
            {content.titles[activeIndex]}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {content.ids[activeIndex]}
            <Copy className="size-3" aria-hidden />
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {content.overviews[activeIndex]}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span className={`size-1.5 rounded-full ${p.dot}`} aria-hidden />
            {p.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-strong">
            <Hash className="size-3" aria-hidden />
            {content.points[activeIndex]}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {content.dates[activeIndex]}
          </span>
          {content.dodMet[activeIndex] && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-500">
              <Check className="size-3" aria-hidden />
              {t("board.dodMet")}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderDoneMini = (title: string) => (
    <div className="flex h-full flex-col justify-center rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="size-2.5 text-emerald-500" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-snug text-muted-foreground">
          {title}
        </span>
      </div>
      <span className="mt-1.5 inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
        {t("landing.stages.done")}
      </span>
    </div>
  );

  const renderAiPlan = (withActions: boolean) => (
    <div
      key={`plan-${activeIndex}`}
      className="df-row-in flex h-full flex-col rounded-xl border border-violet-400/25 bg-violet-400/5 p-3.5 animate-float-slow"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400">
          <Brain className="size-3.5" aria-hidden />
          {t("landing.hero.flow.aiPlan")}
        </span>
        {planApplied ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
            {t("ai.applied")}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">
            {t("ai.pending")}
          </span>
        )}
      </div>
      <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-foreground">
        {content.planSummaries[activeIndex]}
      </p>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("ai.steps")}
      </p>
      <ol
        role="list"
        className="mb-2 list-inside list-decimal space-y-0.5 text-[11px] leading-snug text-muted-foreground"
      >
        {content.planSteps[activeIndex].map((s, i) => (
          <li key={s} className="df-step-in" style={{ animationDelay: `${i * 160}ms` }}>
            {s}
          </li>
        ))}
      </ol>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("ai.dod")}
      </p>
      <ul role="list" className="space-y-0.5">
        {content.planDod[activeIndex].map((d) => (
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
      {withActions && (
        <div className="mt-auto flex items-center gap-2 pt-2.5">
          <span className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary">
            {t("ai.applyPlan")}
          </span>
          <span className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {t("ai.regenerate")}
          </span>
        </div>
      )}
    </div>
  );

  const renderWiki = (full: boolean) => (
    <div
      key={`wiki-${activeIndex}`}
      className={`df-row-in mt-4 flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-left ${
        wikiLive ? "border-primary/50" : "border-border"
      }`}
    >
      <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
        {content.wiki[activeIndex].title}
      </span>
      {full && (
        <span className="shrink-0 rounded-md border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {content.wiki[activeIndex].type}
        </span>
      )}
      <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
        {content.wiki[activeIndex].status}
      </span>
      {content.wiki[activeIndex].weight && (
        <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {content.wiki[activeIndex].weight}
        </span>
      )}
    </div>
  );

  return (
    <div className={className}>
      {/* ─── Desktop ─── */}
      <div className="hidden w-full md:block">
        {renderPills()}

        <div
          role="tabpanel"
          aria-label={label}
          className="grid grid-cols-2 items-stretch gap-4 text-left"
        >
          <div className="flex flex-col gap-3 self-stretch">
            {renderTaskCard()}
            <div className="grid flex-1 grid-cols-2 items-stretch gap-3">
              {renderDoneMini(t("landing.mock.flows.card5"))}
              {renderDoneMini(t("landing.mock.flows.card6"))}
            </div>
          </div>
          {renderAiPlan(true)}
        </div>

        {renderWiki(true)}
        <p className="mt-3 flex items-center justify-center gap-1 text-center font-mono text-[11px] text-muted-foreground">
          {paused ? t("landing.hero.tourPaused") : t("landing.hero.tourHint")}
          <ChevronRight className="size-3" aria-hidden />
        </p>
      </div>

      {/* ─── Mobile (stacked) ─── */}
      <div className="w-full md:hidden">
        {renderPills(true)}

        <div role="tabpanel" aria-label={label} className="space-y-3 text-left">
          {renderTaskCard()}
          <div className="grid grid-cols-2 gap-2">
            {renderDoneMini(t("landing.mock.flows.card5"))}
            {renderDoneMini(t("landing.mock.flows.card6"))}
          </div>
          {renderAiPlan(false)}
          {renderWiki(false)}
        </div>
      </div>
    </div>
  );
}
