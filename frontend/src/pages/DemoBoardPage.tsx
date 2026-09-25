import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Brain, BookOpen, Check } from "lucide-react";
import { Column } from "../components/board/Column";
import type { TaskItemResponse } from "../types/api";

/**
 * Demo board for the marketing dashboard screenshot (npm run
 * screenshot:dashboard). Renders the REAL Column + TaskCard components with
 * static fixtures — no backend, no auth, no API calls, pure props.
 * Registered ONLY when import.meta.env.DEV is true, so the production
 * bundle never ships it.
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

export function DemoBoardPage() {
  const { t } = useTranslation();

  const byStatus = useMemo(() => {
    const map = new Map<TaskItemResponse["status"], TaskItemResponse[]>();
    for (const s of ORDER) map.set(s, []);
    for (const f of FIXTURES) map.get(f.status)?.push(toTask(f));
    return map;
  }, []);

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

  // Fixed viewport height: the headless screenshot captures exactly one
  // viewport (1869x842), so the page fills it with no trailing blank band.
  // The board row is flex-1 and columns stretch — empty column space reads
  // as a natural board, not a blank page.
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          DevFlow
        </p>
        <h1 className="font-display text-xl font-bold">Project board</h1>
        <span className="ml-auto hidden items-center gap-4 font-mono text-xs text-muted-foreground sm:flex">
          <span className="rounded-md bg-elevated px-2 py-1">Sprint 12 · 6d left</span>
          <span className="rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary-strong">
            {points} pts shipped
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" aria-hidden />3 online
          </span>
        </span>
      </header>

      {/* Stat strip so the 1869x842 screenshot frame reads as a dashboard. */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-6 pt-4">
        <span className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
          {t("dashboard.totalTasks")}: {total}
        </span>
        <span className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
          {t("dashboard.inProgress")}: {inProgress}
        </span>
        <span className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
          {t("dashboard.completed")}: {doneCount}
        </span>
        <span className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
          {t("board.dodMet")}: {doneCount}
        </span>
      </div>

      <main className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-6 py-4">
        {ORDER.map((status) => (
          <div key={status} className="flex w-60 shrink-0 flex-col [&>section]:flex-1">
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
      </main>

      {/* AI plan + wiki panels fill the lower part of the screenshot frame. */}
      {/* items-stretch so the single-row wiki panel fills the AI panel's
          height — items-start left a black hole under it in the screenshot. */}
      <div className="grid shrink-0 grid-cols-2 items-stretch gap-4 px-6 pb-5 text-left">
        <div className="rounded-xl border border-violet-400/25 bg-violet-400/5 p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400">
              <Brain className="size-3.5" aria-hidden />
              {t("landing.hero.flow.aiPlan")}
            </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
              {t("ai.applied")}
            </span>
          </div>
          <p className="mb-2 text-xs leading-relaxed text-foreground">
            {t("landing.hero.flow.aiPlanDesc")}
          </p>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("ai.steps")}
          </p>
          <ol role="list" className="list-inside list-decimal space-y-0.5 text-[11px] leading-snug text-muted-foreground">
            {planSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>

        <div className="flex items-center gap-2 self-stretch rounded-xl border border-border bg-card px-3.5 py-2.5">
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

      <footer className="flex shrink-0 items-center gap-2 border-t border-border px-6 py-3 font-mono text-[11px] text-muted-foreground">
        <Check className="size-3.5 text-primary" aria-hidden />
        {t("landing.showcase.subtitle")}
      </footer>
    </div>
  );
}
