import { useTranslation } from "react-i18next";
import { Brain, BookOpen, Check } from "lucide-react";
import { BrowserFrame } from "./BrowserFrame";
import { Column } from "../board/Column";
import type { TaskItemResponse } from "../../types/api";

/**
 * "Your pipeline, live on one screen" — the dashboard section rebuilt as a
 * real component instead of a static screenshot (landing-opt.png deleted).
 * Renders the REAL Column component with static fixtures (pure props: no
 * backend, no auth, no API calls), so the marketing board can never drift
 * from the product board — column chrome, TaskCard fields, priority dots
 * and DoD badges all come from the real code.
 *
 * Layout mirrors the real board (BoardPage): columns flow in a wrapping row
 * with a min-width floor on desktop, so 7 stages collapse from 4 → 2 columns
 * instead of squeezing into 7 unreadable slivers. On mobile they stack full
 * width. The AI plan + wiki panels wrap the same way. Everything is HTML/CSS
 * from design tokens — no external images, so no recapture step and no
 * black-hole gaps. Decorative (aria-hidden): the copy block above carries
 * the message; inner controls are non-focusable so the hidden tree can't
 * trap focus (axe aria-hidden-focus).
 */

interface Fixture {
  id: string;
  key: string;
  title: string;
  status: TaskItemResponse["status"];
  priority: TaskItemResponse["priority"];
  storyPoints: number | null;
  definitionOfDone?: string | null;
  dueDateUtc: string | null;
}

const FIXTURES: Fixture[] = [
  { id: "demo-1", key: "DEV-101", title: "OAuth refresh flow", status: "Idea", priority: "High", storyPoints: 5, definitionOfDone: "- [x] Silent refresh on 401\n- [x] Rotate tokens", dueDateUtc: "2026-09-28T00:00:00Z" },
  { id: "demo-2", key: "DEV-112", title: "API rate limit", status: "Planning", priority: "Medium", storyPoints: 3, dueDateUtc: "2026-10-02T00:00:00Z" },
  { id: "demo-3", key: "DEV-118", title: "Approval gate for plans", status: "Approval", priority: "High", storyPoints: 2, dueDateUtc: null },
  { id: "demo-4", key: "DEV-121", title: "User avatar upload", status: "Ready", priority: "Medium", storyPoints: 3, dueDateUtc: "2026-10-05T00:00:00Z" },
  { id: "demo-5", key: "DEV-132", title: "OAuth refresh interceptor", status: "InProgress", priority: "High", storyPoints: 5, definitionOfDone: "- [x] Interceptor on 401\n- [ ] Backoff retry", dueDateUtc: "2026-09-28T00:00:00Z" },
  { id: "demo-6", key: "DEV-135", title: "Dark mode toggle", status: "InProgress", priority: "Low", storyPoints: 1, dueDateUtc: null },
  { id: "demo-7", key: "DEV-140", title: "Search indexing", status: "Review", priority: "Medium", storyPoints: 8, dueDateUtc: "2026-10-01T00:00:00Z" },
  { id: "demo-8", key: "DEV-144", title: "Webhook retry", status: "Done", priority: "Critical", storyPoints: 3, definitionOfDone: "- [x] Retry with backoff\n- [x] Dead-letter queue", dueDateUtc: "2026-09-20T00:00:00Z" },
  { id: "demo-9", key: "DEV-105", title: "Redis edge cache spike", status: "Idea", priority: "Low", storyPoints: 2, dueDateUtc: null },
  { id: "demo-10", key: "DEV-115", title: "Sprint capacity meter", status: "Planning", priority: "Medium", storyPoints: 5, dueDateUtc: "2026-10-08T00:00:00Z" },
  { id: "demo-11", key: "DEV-119", title: "Auto-apply AI plans", status: "Approval", priority: "Critical", storyPoints: 8, dueDateUtc: "2026-10-03T00:00:00Z" },
  { id: "demo-12", key: "DEV-124", title: "Burndown export CSV", status: "Ready", priority: "Low", storyPoints: 1, dueDateUtc: null },
  { id: "demo-13", key: "DEV-141", title: "Rate limiter review", status: "Review", priority: "High", storyPoints: 3, definitionOfDone: "- [x] 100 req/min\n- [ ] Bypass for webhooks", dueDateUtc: "2026-09-30T00:00:00Z" },
  { id: "demo-14", key: "DEV-149", title: "Avatar upload shipped", status: "Done", priority: "Medium", storyPoints: 2, definitionOfDone: "- [x] Resize to 256px\n- [x] AVIF plus WebP", dueDateUtc: "2026-09-18T00:00:00Z" },
];

function toTask(f: Fixture): TaskItemResponse {
  return {
    id: f.id,
    projectId: "demo-project",
    key: f.key,
    number: Number(f.key.split("-")[1] ?? 0),
    title: f.title,
    description: null,
    definitionOfDone: f.definitionOfDone ?? null,
    status: f.status,
    priority: f.priority,
    assigneeId: null,
    sprintId: null,
    epicId: null,
    parentTaskId: null,
    dueDateUtc: f.dueDateUtc,
    completedAtUtc: f.status === "Done" ? "2026-09-20T00:00:00Z" : null,
    storyPoints: f.storyPoints,
  };
}

const ORDER: TaskItemResponse["status"][] = [
  "Idea",
  "Planning",
  "Approval",
  "Ready",
  "InProgress",
  "Review",
  "Done",
];

export function LiveBoardShowcase() {
  const { t } = useTranslation();

  const byStatus = new Map<TaskItemResponse["status"], TaskItemResponse[]>();
  for (const s of ORDER) byStatus.set(s, []);
  for (const f of FIXTURES) byStatus.get(f.status)?.push(toTask(f));

  const noop = () => {};
  const titles: Record<TaskItemResponse["status"], string> = {
    Idea: t("board.idea"),
    Planning: t("board.planning"),
    Approval: t("board.approval"),
    Ready: t("board.ready"),
    InProgress: t("board.inProgress"),
    Review: t("board.review"),
    Done: t("board.done"),
  };

  const total = FIXTURES.length;
  const inProgress = (byStatus.get("InProgress") ?? []).length;
  const doneCount = (byStatus.get("Done") ?? []).length;
  const points = FIXTURES.reduce((sum, f) => sum + (f.storyPoints ?? 0), 0);
  const planSteps = [
    t("landing.hero.flow.checklistTitle"),
    t("landing.hero.flow.checklistPassed"),
    t("landing.hero.flow.version"),
  ];

  return (
    <section className="border-b border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {t("landing.showcase.eyebrow")}
          </p>
          <h2 className="mb-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("landing.showcase.title")}
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            {t("landing.showcase.subtitle")}
          </p>
        </div>

        <BrowserFrame className="mx-auto max-w-5xl">
          {/* Decorative product mockup: the heading above carries the message.
              aria-hidden keeps the reading order unambiguous and guarantees no
              focusable element hides inside (axe aria-hidden-focus) — every
              Column button/link is removed from the tab order here. */}
          <div aria-hidden="true" className="[&_a]:pointer-events-none [&_button]:pointer-events-none">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                {t("dashboard.totalTasks")}: {total}
              </span>
              <span className="rounded-lg border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                {t("dashboard.inProgress")}: {inProgress}
              </span>
              <span className="rounded-lg border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                {t("dashboard.completed")}: {doneCount}
              </span>
              <span className="ml-auto hidden items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-primary-strong sm:inline-flex">
                {points} pts shipped
              </span>
            </div>

            {/* Board columns, same pattern as BoardPage: wrapping row with a
                min-width floor (2 per row on sm, 4 per row on lg), stacked
                full width on mobile — never 7 squeezed slivers. */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-stretch">
              {ORDER.map((status) => (
                <div key={status} className="flex min-w-0 flex-1 flex-col sm:min-w-[220px] sm:basis-[calc(50%-0.3125rem)] lg:basis-[calc(25%-0.625rem)] [&>section]:h-full">
                  <Column
                    title={titles[status]}
                    status={status}
                    tasks={byStatus.get(status) ?? []}
                    members={[]}
                    onDropTask={noop}
                    onDelete={noop}
                    onSelect={noop}
                    workspaceId="demo-workspace"
                    projectId="demo-project"
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-2.5 text-left sm:flex-row sm:flex-wrap sm:items-stretch">
              <div className="min-w-0 flex-1 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3 sm:min-w-[280px] sm:basis-[calc(60%-0.3125rem)]">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400">
                    <Brain className="size-3.5" aria-hidden />
                    {t("landing.hero.flow.aiPlan")}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
                    {t("ai.applied")}
                  </span>
                </div>
                <ol role="list" className="list-inside list-decimal space-y-0.5 text-[11px] leading-snug text-muted-foreground">
                  {planSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-xl border border-border bg-card px-3 py-2.5 sm:min-w-[220px] sm:basis-[calc(40%-0.3125rem)]">
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

            <p className="mt-3 flex items-center gap-2 border-t border-border pt-2.5 font-mono text-[11px] text-muted-foreground">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
              {t("landing.showcase.subtitle")}
            </p>
          </div>
        </BrowserFrame>
      </div>
    </section>
  );
}
