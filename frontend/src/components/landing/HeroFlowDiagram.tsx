import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain,
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  Copy,
  Hash,
  Users,
  Rocket,
  ShieldCheck,
  SquareKanban,
} from "lucide-react";

/**
 * Interactive board tour — the hero mockup, not a passive animation:
 * - 7 stage pills with the REAL board names (landing.stages.*) act as tabs:
 *   click (or arrow-key) one and the board content below follows it — a
 *   different SCENE per stage, not the same template with swapped text.
 *   Auto-advance runs on a slow ~5000ms interval so each stage is readable;
 *   any manual pick pauses it for 30s (AUTO_RESUME_MS) before resuming.
 * - Idea: a 3-card backlog stack fanned with rotation, like a fresh inbox.
 * - Planning: a 3-lane kanban strip (Idea / In Progress / Done) with member
 *   avatars, echoing the real board.
 * - Approval: an approval gate card — checklist with real check states plus
 *   Apply / Regenerate actions.
 * - Ready: a Pending AI plan beside the stage's task card (key chip, priority
 *   dot + label, story-points chip, due date, DoD badge) over a pair of Done
 *   minis — the same [scene | task + minis] shape every other stage uses.
 * - In Progress: the same split, with the left column on a subtask breakdown
 *   (counter, progress bar, done/doing/todo rows) instead of Done minis — the
 *   stage has no finished pair yet, and a lone `flex-1` card left a hollow box.
 * - Review: the AI plan with an Applied badge and a weight-scored wiki row.
 * - Done: release + knowledge scene — a v1.2.0 release card with a progress
 *   bar and flow rows, plus the wiki row. Both Done minis stay visible so
 *   the column never collapses.
 * - A wiki entry row with real KnowledgeEntryCard status badges and real
 *   `w {weight}` weight chips sits under the desktop panel (hidden on
 *   Review/Done where the wiki lives inside the scene).
 *
 * Content comes from EXISTING i18n values only (never new keys — i18n-parity
 * requires en/vi to match): landing.mock.flows/kanban/ai/wiki/orgs/releases,
 * the flow strings, knowledge.status/type, ai.* and task.* labels.
 * Identifiers (DEV-101, ADR titles, w weights, member initials) are fixture
 * IDs, intentionally locale-independent.
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
 * landing.mock.flows/kanban, plan steps/DoD from landing.hero.flow plus the
 * landing.mock.ai disciplines, releases rows, org member names, wiki badges
 * from knowledge.status/type, and real TaskCard priority labels. Identifiers
 * (DEV-xxx, ADR titles, w weights, member initials) are locale-independent.
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
  // Idea backlog stack: three cards fanned with rotation.
  const stackTitles = [
    t("landing.mock.flows.card1"),
    t("landing.mock.flows.card2"),
    t("landing.mock.flows.card4"),
  ];
  const stackIds = ["DEV-101", "DEV-112", "DEV-121"];
  const stackDots = ["bg-amber-300", "bg-primary", "bg-primary"];
  const stackLabels = [t("task.high"), t("task.medium"), t("task.medium")];
  const stackPoints = [5, 3, 3];
  const stackDates = ["Sep 28", "Oct 2", "Oct 5"];
  // Planning lanes: 3 mini columns with a card + avatar each.
  const laneCards = [
    t("landing.mock.flows.card1"),
    t("landing.mock.flows.card2"),
    t("landing.mock.flows.card6"),
  ];
  const laneIds = ["DEV-101", "DEV-112", "DEV-144"];
  const laneAvatars = [
    t("landing.mock.kanban.assignee1"),
    t("landing.mock.kanban.assignee2"),
    t("landing.mock.kanban.assignee3"),
  ];
  // Approval gate checklist: [label, checked].
  const gateSteps: [string, boolean][] = [
    [t("landing.hero.flow.checklistTitle"), true],
    [t("landing.hero.flow.checklistPassed"), true],
    [t("landing.hero.flow.version"), false],
  ];
  // Release scene rows.
  const releaseFlows = [
    t("landing.mock.releases.flow1"),
    t("landing.mock.releases.flow2"),
    t("landing.mock.releases.flow3"),
  ];
  /**
   * Done minis, one pair per stage — the work that has already shipped behind
   * the stage's own card. Two rules keep them honest: a stage never lists its
   * own card as finished, and no two stages show the same pair twice. Titles
   * reuse the existing landing.mock.flows/kanban cards; keys, points and dates
   * are locale-independent fixture data.
   */
  const doneCards: { title: string; id: string; points: number; date: string; wiki: string }[][] = [
    [
      { title: t("landing.mock.flows.card5"), id: "DEV-140", points: 8, date: "Oct 1", wiki: t("knowledge.type.Adr") },
      { title: t("landing.mock.flows.card6"), id: "DEV-144", points: 3, date: "Sep 20", wiki: t("knowledge.type.Runbook") },
    ],
    [
      { title: t("landing.mock.kanban.card1"), id: "DEV-109", points: 5, date: "Sep 26", wiki: t("knowledge.status.Accepted") },
      { title: t("landing.mock.flows.card4"), id: "DEV-121", points: 3, date: "Oct 5", wiki: t("knowledge.type.Pattern") },
    ],
    [
      { title: t("landing.mock.flows.card2"), id: "DEV-112", points: 3, date: "Oct 2", wiki: t("knowledge.status.Proposed") },
      { title: t("landing.mock.kanban.card4"), id: "DEV-116", points: 2, date: "Sep 30", wiki: t("knowledge.type.Pattern") },
    ],
    [
      { title: t("landing.mock.flows.card5"), id: "DEV-140", points: 8, date: "Oct 1", wiki: t("knowledge.status.Superseded") },
      { title: t("landing.mock.flows.card6"), id: "DEV-144", points: 3, date: "Sep 20", wiki: t("knowledge.type.Runbook") },
    ],
    [
      { title: t("landing.mock.flows.card4"), id: "DEV-121", points: 3, date: "Oct 5", wiki: t("knowledge.type.Adr") },
      { title: t("landing.mock.flows.card3"), id: "DEV-118", points: 2, date: "Oct 3", wiki: t("knowledge.type.Pattern") },
    ],
    [
      { title: t("landing.mock.kanban.card6"), id: "DEV-149", points: 2, date: "Sep 18", wiki: t("knowledge.status.Accepted") },
      { title: t("landing.mock.flows.card4"), id: "DEV-121", points: 3, date: "Oct 5", wiki: t("knowledge.type.Runbook") },
    ],
    [
      { title: t("landing.mock.flows.card6"), id: "DEV-144", points: 3, date: "Sep 20", wiki: t("knowledge.status.Accepted") },
      { title: t("landing.mock.flows.card5"), id: "DEV-140", points: 8, date: "Sep 19", wiki: t("knowledge.autoCaptured") },
    ],
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
  // In-Progress / Review plan bodies (also reused for the wiki footer copy
  // on other stages via overview).
  const progressSummary = t("landing.hero.flow.aiPlanDesc");
  const progressSteps = [
    t("landing.hero.flow.checklistTitle"),
    t("landing.hero.flow.checklistPassed"),
    t("landing.mock.ai.approved"),
  ];
  const progressDod = [
    t("landing.hero.flow.approved"),
    t("landing.hero.flow.applied"),
  ];
  /**
   * Stage 4's breakdown — the task card alone left the column a hollow box, so
   * the scene shows the work behind it. Titles reuse existing strings and the
   * 2/3 split stays honest: the strip shows every row, so the counter's total
   * is the row count and the bar is the completed fraction of it.
   */
  const progressSubtasks: { title: string; state: "done" | "doing" | "todo" }[] = [
    { title: t("landing.mock.kanban.card1"), state: "done" },
    { title: t("landing.hero.flow.approved"), state: "done" },
    { title: t("landing.mock.ai.discipline3"), state: "doing" },
  ];
  const reviewSummary = t("landing.mock.ai.review");
  const reviewSteps = [
    t("landing.mock.ai.approved"),
    t("landing.hero.flow.checklistPassed"),
    t("landing.hero.flow.version"),
  ];
  const reviewDod = [
    t("landing.hero.flow.applied"),
    t("landing.hero.flow.version"),
  ];
  const overview = t("landing.hero.flow.overview");
  return {
    titles, priorities, dates, points, dodMet, ids,
    stackTitles, stackIds, stackDots, stackLabels, stackPoints, stackDates,
    laneCards, laneIds, laneAvatars, gateSteps,
    releaseFlows, wiki, doneCards,
    progressSummary, progressSteps, progressDod, progressSubtasks,
    reviewSummary, reviewSteps, reviewDod, overview,
  };
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

  // ─── Shared bits (one definition, reused by every scene) ───

  const renderChips = (index: number) => {
    const p = content.priorities[index];
    return (
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className={`size-1.5 rounded-full ${p.dot}`} aria-hidden />
          {p.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-strong">
          <Hash className="size-3" aria-hidden />
          {content.points[index]}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {content.dates[index]}
        </span>
        {content.dodMet[index] && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-500">
            <Check className="size-3" aria-hidden />
            {t("board.dodMet")}
          </span>
        )}
      </div>
    );
  };

  /**
   * The stage's task card. `flex` defaults to true because the right-hand
   * columns stack it above a `flex-1` mini grid and the two must SHARE the
   * column height. Pass false where the scene lays its parts out itself
   * (stage 3) and a growing card would swallow the centring space.
   */
  const renderTaskCard = (flex = true) => {
    const index = activeIndex;
    return (
      <div
        key={`task-${index}`}
        className={`df-row-in flex flex-col justify-center gap-2.5 rounded-xl border border-primary bg-card p-3.5 shadow-[0_0_0_2px_var(--color-primary),0_24px_60px_-24px_rgba(0,0,0,0.5)] ${flex ? "flex-1" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-foreground">
            {content.titles[index]}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {content.ids[index]}
            <Copy className="size-3" aria-hidden />
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {content.overview}
        </p>
        {renderChips(index)}
      </div>
    );
  };

  /**
   * A finished card, filled like a real TaskCard instead of a one-line stub:
   * check + title on top, key/points/date in the meta row, a Done badge and
   * the knowledge entry it produced. The pair is per-stage, so the tour never
   * repeats the same two boxes.
   */
  const renderDoneMini = (cardIndex: number) => {
    const card = content.doneCards[activeIndex][cardIndex];
    return (
      <div
        key={`done-${activeIndex}-${cardIndex}`}
        className="df-row-in flex h-full min-w-0 flex-col justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
        style={{ animationDelay: `${cardIndex * 120}ms` }}
      >
        <div className="flex min-w-0 items-start gap-1.5">
          <span className="mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
            <Check className="size-2.5 text-emerald-500" aria-hidden />
          </span>
          <span className="line-clamp-2 min-w-0 flex-1 text-[11px] font-medium leading-snug text-foreground">
            {card.title}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 pl-5.5 font-mono text-[10px] text-muted-foreground">
          <span className="rounded bg-elevated px-1 py-0.5 font-semibold">{card.id}</span>
          <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1 py-0.5 font-semibold text-primary-strong">
            <Hash className="size-2.5" aria-hidden />
            {card.points}
          </span>
          <span className="shrink-0">{card.date}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 pl-5.5">
          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
            {t("landing.stages.done")}
          </span>
          <span className="min-w-0 truncate rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {card.wiki}
          </span>
        </div>
      </div>
    );
  };

  /**
   * Stage 4's work breakdown, under the task card. In Progress has no finished
   * pair to show, so the column fills with the subtasks the card is being
   * broken into instead of one tall empty box. Every row is listed, so the
   * `subtask.progress` counter and the bar both read off the same array —
   * there is nothing hidden behind the fraction.
   */
  const renderSubtaskStrip = () => {
    const rows = content.progressSubtasks;
    const doneCount = rows.filter((r) => r.state === "done").length;
    const donePct = `${Math.round((doneCount / rows.length) * 100)}%`;
    return (
      <div
        key={`subtasks-${activeIndex}`}
        className="df-row-in flex min-h-0 flex-col justify-center gap-2 rounded-xl border border-border bg-card px-3.5 py-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("subtask.subtasks")}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {t("subtask.progress", { done: doneCount, total: rows.length })}
          </span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-elevated"
          role="img"
          aria-label={t("subtask.progress", { done: doneCount, total: rows.length })}
        >
          <div className="df-step-in h-full rounded-full bg-primary" style={{ width: donePct }} aria-hidden />
        </div>
        <ul role="list" className="space-y-1">
          {rows.map((row, i) => (
            <li
              key={row.title}
              className="df-step-in flex items-center gap-1.5 text-[11px] leading-snug"
              style={{ animationDelay: `${i * 140}ms` }}
            >
              {row.state === "done" ? (
                <Check className="size-3 shrink-0 text-emerald-500" aria-hidden />
              ) : row.state === "doing" ? (
                <CircleDot className="size-3 shrink-0 text-primary" aria-hidden />
              ) : (
                <Circle className="size-3 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
              <span
                className={`min-w-0 flex-1 truncate ${
                  row.state === "done"
                    ? "text-muted-foreground line-through decoration-muted-foreground/40"
                    : "text-foreground"
                }`}
              >
                {row.title}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderAiPlanCard = (
    badge: React.ReactNode,
    summary: string,
    steps: string[],
    dod: string[],
    withActions: boolean,
  ) => (
    <div className="flex h-full flex-col rounded-xl border border-violet-400/25 bg-violet-400/5 p-3.5 animate-float-slow">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400">
          <Brain className="size-3.5" aria-hidden />
          {t("landing.hero.flow.aiPlan")}
        </span>
        {badge}
      </div>
      <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-foreground">
        {summary}
      </p>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("ai.steps")}
      </p>
      <ol
        role="list"
        className="mb-2 list-inside list-decimal space-y-0.5 text-[11px] leading-snug text-muted-foreground"
      >
        {steps.map((s, i) => (
          <li key={s} className="df-step-in" style={{ animationDelay: `${i * 160}ms` }}>
            {s}
          </li>
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

  const renderWikiRow = (index: number, full: boolean) => (
    <div
      className="flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-left border-border"
    >
      <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
        {content.wiki[index].title}
      </span>
      {full && (
        <span className="shrink-0 rounded-md border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {content.wiki[index].type}
        </span>
      )}
      <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
        {content.wiki[index].status}
      </span>
      {content.wiki[index].weight && (
        <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {content.wiki[index].weight}
        </span>
      )}
    </div>
  );

  // ─── Scenes: one layout per stage, same outer size ───
  // All seven scenes set the SAME desktop floor — `md:min-h-[19.5rem]` (312px) —
  // so the panel never changes height when the tour advances; the tighter scenes
  // centre themselves in the leftover space (justify-center) and the
  // `items-stretch` grids make both columns end flush. 312px is the tallest
  // scene (Review) plus a few px of headroom for longer locales (vi) that wrap
  // and grow. `md:` only, so the stacked mobile panel hugs its content.

  // Stage 0 Idea: backlog inbox — 3 cards fanned with rotation over a hint.
  // The shared desktop floor (see above) keeps the auto tour from changing the
  // panel size when the back cards fade in — the OCD rule, same as every scene.
  // Sized min-h so longer locales (vi) wrap inside the same box height.
  // Back cards reserve their own vertical slots (relative flow, small
  // negative overlap) instead of absolute positioning — absolute cards can
  // slide out of the container and overlap the right column. The overlap is
  // small (-mt-2, 8px) because the back cards carry only a title row (46px);
  // the earlier -mt-9 (36px) buried their titles under the card in front, and
  // the back cards step DOWN the z-axis (z-20 / z-10 / z-0) so the fan paints
  // front-to-back instead of the last sibling landing on top.
  const renderIdeaScene = (withHint: boolean) => (
    <div className="flex flex-col justify-center gap-2.5 md:min-h-[19.5rem]">
      <div key={`idea-${activeIndex}`} className="df-row-in mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-0">
        {content.stackTitles.map((title, i) => (
          <div
            key={title}
            className={`df-step-in rounded-xl border bg-card px-3.5 py-3 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.5)] ${
              i === 0
                ? "relative z-20 rotate-[-1.5deg] border-primary/60"
                : i === 1
                  ? "relative z-10 mx-6 -mt-2 rotate-[2deg] border-border opacity-80"
                  : "relative z-0 mx-10 -mt-2 rotate-[-2deg] border-border opacity-50"
            }`}
            style={{ animationDelay: `${i * 140}ms` }}
            aria-hidden={i > 0}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {title}
              </span>
              <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                {content.stackIds[i]}
              </span>
            </div>
            {i === 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-1.5 rounded-full ${content.stackDots[i]}`} aria-hidden />
                  {content.stackLabels[i]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-strong">
                  <Hash className="size-3" aria-hidden />
                  {content.stackPoints[i]}
                </span>
                <span>{content.stackDates[i]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {withHint && (
        <p className="flex items-center justify-center gap-1.5 text-center font-mono text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          {t("board.dragHint")}
        </p>
      )}
    </div>
  );

  // Stage 1 Planning: 3-lane kanban strip with member avatars.
  // min-h matches the tallest desktop scene so the tour never jumps height.
  const renderPlanningScene = () => {
    const lanes = [
      t("landing.mock.kanban.todo"),
      t("landing.mock.kanban.doing"),
      t("landing.mock.kanban.done"),
    ];
    const laneMembers = [
      t("landing.mock.orgs.member1"),
      t("landing.mock.orgs.member2"),
      t("landing.mock.orgs.member3"),
    ];
    return (
      <div key={`planning-${activeIndex}`} className="df-row-in flex flex-col justify-center gap-2.5 md:min-h-[19.5rem]">
        <div className="grid flex-1 grid-cols-3 items-stretch gap-2.5">
          {lanes.map((lane, i) => (
            <div
              key={lane}
              className="df-step-in flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5"
              style={{ animationDelay: `${i * 140}ms` }}
            >
              <p className="flex items-center gap-1.5 px-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <SquareKanban className="size-3 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{lane}</span>
              </p>
              <div className="flex flex-1 flex-col justify-center rounded-lg border border-border bg-card px-2.5 py-2">
                <p className="truncate text-xs font-medium text-foreground">
                  {content.laneCards[i]}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-1.5">
                  <span className="rounded bg-elevated px-1 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                    {content.laneIds[i]}
                  </span>
                  <span
                    className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 font-mono text-[9px] font-bold text-primary-strong"
                    aria-hidden
                  >
                    {content.laneAvatars[i]}
                  </span>
                </div>
              </div>
              <p className="truncate px-1 font-mono text-[10px] text-muted-foreground">
                {laneMembers[i]}
              </p>
            </div>
          ))}
        </div>
        <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Users className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">
            {t("landing.mock.orgs.member2")} · {t("landing.mock.orgs.member2Role")}
          </span>
          <span className="ml-auto shrink-0 rounded-lg border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {t("landing.mock.orgs.inviteBtn")}
          </span>
        </p>
      </div>
    );
  };

  // Stage 2 Approval: gate card with real check states + actions.
  const renderApprovalScene = (withActions: boolean) => (
    <div key={`approval-${activeIndex}`} className="df-row-in flex flex-col justify-center gap-2.5 md:min-h-[19.5rem]">
      <div className="flex flex-1 flex-col justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
          <ShieldCheck className="size-3.5" aria-hidden />
          {t("landing.mock.ai.gateLabel")}
        </p>
        <ul role="list" className="space-y-1.5">
          {content.gateSteps.map(([label, checked], i) => (
            <li
              key={label}
              className="df-step-in flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground"
              style={{ animationDelay: `${i * 140}ms` }}
            >
              <span
                className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${
                  checked ? "bg-emerald-500/15" : "border border-border-strong"
                }`}
                aria-hidden
              >
                {checked && <Check className="size-2.5 text-emerald-500" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </li>
          ))}
        </ul>
        {withActions && (
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary">
              {t("landing.mock.ai.gateApproved")}
            </span>
            <span className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {t("landing.mock.ai.gateReview")}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  // Stage 4 In Progress: the task card over its subtask breakdown, beside the
  // drafting AI plan. The left column is two definite parts rather than one
  // `flex-1` card, so the card hugs its content instead of stretching to 312px
  // around ~120px of text (the hollow-box defect).
  const renderProgressScene = () => (
    <div className="grid grid-cols-2 items-stretch gap-4 text-left md:min-h-[19.5rem]">
      <div className="flex min-h-0 flex-col justify-center gap-3">
        {renderTaskCard(false)}
        {renderSubtaskStrip()}
      </div>
      <div key={`plan-${activeIndex}`} className="df-row-in">
        {renderAiPlanCard(
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">
            <span className="size-1.5 rounded-full bg-amber-500 animate-glow-pulse" aria-hidden />
            {t("ai.pending")}
          </span>,
          content.progressSummary,
          content.progressSteps,
          content.progressDod,
          true,
        )}
      </div>
    </div>
  );

  // Stage 5 Review: applied AI plan + weight-scored wiki inside the panel.
  // `justify-center` is what the shared rule above asks for — the AI plan card
  // inside is `h-full`, so it stretches and the pair still ends flush; without
  // it the wiki row drops to the floor and the column reads short.
  const renderReviewScene = (full: boolean) => (
    <div
      key={`review-${activeIndex}`}
      className="df-row-in flex flex-col justify-center gap-2.5 md:min-h-[19.5rem]"
    >
      <div className="flex-none">
        {renderAiPlanCard(
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
            {t("ai.applied")}
          </span>,
          content.reviewSummary,
          content.reviewSteps,
          content.reviewDod,
          true,
        )}
      </div>
      {renderWikiRow(5, full)}
    </div>
  );

  // Stage 6 Done: release card + wiki, with Done minis staying visible.
  // Nothing here stretches, so without `justify-center` the 203px of content
  // pins to the top of the 312px column and leaves ~109px of dead space under
  // it — the other half of "done thì không bằng tab bên kia". Centring splits
  // the slack evenly against the wiki row, which is what the other six do.
  const renderDoneScene = (full: boolean) => (
    <div
      key={`done-${activeIndex}`}
      className="df-row-in flex flex-col justify-center gap-2.5 md:min-h-[19.5rem]"
    >
      <div className="flex flex-none flex-col gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
          <Rocket className="size-3.5" aria-hidden />
          {t("landing.mock.releases.version")}
          <span className="ml-auto rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
            {t("knowledge.autoCaptured")}
          </span>
        </p>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-elevated"
          role="img"
          aria-label={t("landing.mock.releases.progress")}
        >
          <div className="df-step-in h-full w-4/5 rounded-full bg-emerald-500" aria-hidden />
        </div>
        <ul role="list" className="space-y-1">
          {content.releaseFlows.map((flow, i) => (
            <li
              key={flow}
              className="df-step-in flex items-center gap-1.5 text-[11px] text-muted-foreground"
              style={{ animationDelay: `${i * 140}ms` }}
            >
              <Check className="size-3 shrink-0 text-emerald-500" aria-hidden />
              <span className="truncate">{flow}</span>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[10px] text-muted-foreground">
          {t("landing.mock.releases.target")}
        </p>
      </div>
      {renderWikiRow(6, full)}
    </div>
  );

  // Desktop pairs every full-width scene with the Done minis so the right
  // column never collapses — both columns end flush (the OCD rule). The floor
  // rides on the grid, not just the scene: Ready hands us a bare AI plan with
  // no `md:min-h` of its own, and without it here the tour drops 40px on that
  // one stage. `flex-1` on the mini grid is what shares the height with the
  // task card above it — do not "simplify" it away.
  const renderSceneWithMinis = (scene: React.ReactNode) => (
    <div className="grid grid-cols-2 items-stretch gap-4 text-left md:min-h-[19.5rem]">
      <div className="flex min-h-0 flex-col self-stretch">{scene}</div>
      <div className="flex flex-col gap-3 self-stretch">
        {renderTaskCard()}
        <div className="grid flex-1 grid-cols-2 items-stretch gap-3">
          {renderDoneMini(0)}
          {renderDoneMini(1)}
        </div>
      </div>
    </div>
  );

  const renderDesktopPanel = () => {
    switch (activeIndex) {
      case 0:
      case 1:
      case 2:
        return renderSceneWithMinis(
          activeIndex === 0
            ? renderIdeaScene(true)
            : activeIndex === 1
              ? renderPlanningScene()
              : renderApprovalScene(true),
        );
      case 3:
        return renderSceneWithMinis(
          <div key={`plan-${activeIndex}`} className="df-row-in">
            {renderAiPlanCard(
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">
                {t("ai.pending")}
              </span>,
              content.progressSummary,
              content.progressSteps,
              content.progressDod,
              true,
            )}
          </div>,
        );
      case 4:
        return renderProgressScene();
      default:
        return renderSceneWithMinis(
          activeIndex === 5 ? renderReviewScene(true) : renderDoneScene(true),
        );
    }
  };

  const renderMobilePanel = () => {
    switch (activeIndex) {
      case 0:
        return renderIdeaScene(false);
      case 1:
        return renderPlanningScene();
      case 2:
        return renderApprovalScene(false);
      case 3:
        return (
          <div className="space-y-3">
            {renderTaskCard()}
            <div className="grid grid-cols-2 gap-2">
              {renderDoneMini(0)}
              {renderDoneMini(1)}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-3">
            {renderTaskCard()}
            {renderSubtaskStrip()}
            <div key={`plan-${activeIndex}`} className="df-row-in">
              {renderAiPlanCard(
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">
                  {t("ai.pending")}
                </span>,
                content.progressSummary,
                content.progressSteps,
                content.progressDod,
                false,
              )}
            </div>
          </div>
        );
      case 5:
        return renderReviewScene(false);
      default:
        return renderDoneScene(false);
    }
  };

  return (
    <div className={className}>
      {/* ─── Desktop ─── */}
      <div className="hidden w-full md:block">
        {renderPills()}

        <div role="tabpanel" aria-label={label} className="text-left">
          {renderDesktopPanel()}
        </div>

        {activeIndex < 5 && (
          <div key={`wiki-${activeIndex}`} className="df-row-in mt-4">
            {renderWikiRow(activeIndex, true)}
          </div>
        )}
        <p className="mt-3 flex items-center justify-center gap-1 text-center font-mono text-[11px] text-muted-foreground">
          {paused ? t("landing.hero.tourPaused") : t("landing.hero.tourHint")}
          <ChevronRight className="size-3" aria-hidden />
        </p>
      </div>

      {/* ─── Mobile (stacked) ─── */}
      <div className="w-full md:hidden">
        {renderPills(true)}

        <div role="tabpanel" aria-label={label} className="text-left">
          {renderMobilePanel()}
        </div>
      </div>
    </div>
  );
}
