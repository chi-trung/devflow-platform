import { useTranslation } from "react-i18next";
import { BookOpen, Brain } from "lucide-react";
import { BrowserFrame } from "../landing/BrowserFrame";
import { Column } from "../board/Column";
import type { TaskItemResponse } from "../../types/api";

/**
 * The marketing scene inside the left panel of /login and /register.
 *
 * Same principle as LiveBoardShowcase: render the REAL Column component with
 * static fixtures (pure props — no backend, no auth, no API calls) instead of
 * the old hand-drawn AuthHeroIllustration SVG, so the panel can never drift
 * from the product board. Column chrome, TaskCard fields, priority dots and DoD
 * badges all come from the real code.
 *
 * The panel is ~835px wide at `lg` (58% of 1440) but ~658px after the frame
 * padding, which fits exactly two columns at the 260px min-width floor and
 * nothing more — a third column needs ~100px that isn't there, and squeezing
 * TaskCard below 250px wraps every meta chip onto its own line. Three and two
 * tasks respectively keep both columns the same height, so neither ends in a
 * hollow 288px box, the exact "ô to đùng trống lỗng" this redesign exists to
 * remove.
 *
 * Every string comes from EXISTING i18n values (landing.mock.flows,
 * landing.hero.flow, board.*, dashboard.*, ai.*, knowledge.*) — no new keys,
 * because i18n-parity requires en/vi to match. Task keys (DEV-xxx) are
 * fixture IDs, intentionally locale-independent, same as the landing page.
 *
 * Decorative (aria-hidden): the panel's heading carries the message, and
 * every Column button/link is removed from the tab order here, so the hidden
 * tree can't trap focus (axe aria-hidden-focus).
 */

interface Fixture {
  key: string;
  titleKey: string;
  status: TaskItemResponse["status"];
  priority: TaskItemResponse["priority"];
  storyPoints: number | null;
  definitionOfDone?: string;
  dueDateUtc: string | null;
}

const FIXTURES: Fixture[] = [
  { key: "DEV-101", titleKey: "landing.mock.flows.card1", status: "InProgress", priority: "High", storyPoints: 5, definitionOfDone: "- [x] Silent refresh on 401\n- [x] Rotate tokens", dueDateUtc: "2026-09-28T00:00:00Z" },
  { key: "DEV-112", titleKey: "landing.mock.flows.card2", status: "InProgress", priority: "Medium", storyPoints: 3, dueDateUtc: "2026-10-02T00:00:00Z" },
  { key: "DEV-121", titleKey: "landing.mock.flows.card4", status: "InProgress", priority: "Low", storyPoints: 2, definitionOfDone: "- [x] Respect prefers-color-scheme", dueDateUtc: "2026-10-06T00:00:00Z" },
  { key: "DEV-149", titleKey: "landing.mock.flows.doneCard", status: "Done", priority: "Critical", storyPoints: 3, definitionOfDone: "- [x] Resize to 256px\n- [x] AVIF plus WebP", dueDateUtc: "2026-09-18T00:00:00Z" },
  { key: "DEV-140", titleKey: "landing.mock.flows.card5", status: "Done", priority: "High", storyPoints: 8, definitionOfDone: "- [x] 100 req/min\n- [x] Retry with exponential backoff", dueDateUtc: "2026-10-01T00:00:00Z" },
];

// Two columns, not three. TaskCard's meta row is `flex items-center gap-2`
// with NO wrap, so below ~250px the chips get squeezed and their own text
// wraps — "DoD met" and "Sep 28" each break onto two lines, and the column
// header's "pts" chip breaks too. The real board never renders that narrow
// (LiveBoardShowcase holds 250px per column); two columns here land at ~324px,
// which is where the component actually looks like itself. Render order is
// board order, not fixture order, and Done closes the row as the payoff.
const ORDER: TaskItemResponse["status"][] = ["InProgress", "Done"];

export function AuthScene({ className = "" }: { className?: string }) {
  const { t } = useTranslation();

  const byStatus = new Map<TaskItemResponse["status"], TaskItemResponse[]>();
  for (const s of ORDER) byStatus.set(s, []);
  for (const [i, f] of FIXTURES.entries()) {
    byStatus.get(f.status)?.push({
      id: `auth-scene-${i}`,
      projectId: "demo-project",
      key: f.key,
      number: Number(f.key.split("-")[1] ?? 0),
      title: t(f.titleKey),
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
    });
  }

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

  const inProgress = (byStatus.get("InProgress") ?? []).length;
  const doneCount = (byStatus.get("Done") ?? []).length;
  const planSteps = [
    t("landing.hero.flow.checklistTitle"),
    t("landing.hero.flow.checklistPassed"),
    t("landing.hero.flow.version"),
  ];

  return (
    <BrowserFrame className={className}>
      <div aria-hidden="true" className="[&_a]:pointer-events-none [&_button]:pointer-events-none">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
            {t("dashboard.inProgress")}: {inProgress}
          </span>
          <span className="rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
            {t("dashboard.completed")}: {doneCount}
          </span>
          <span className="ml-auto hidden items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-primary-strong sm:inline-flex">
            {t("ai.applied")}
          </span>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-stretch">
          {ORDER.map((status) => (
            // No `basis` here on purpose: the row is `flex-wrap`, so a
            // percentage basis that fails to account for BOTH gaps pushes a
            // column onto a second line and doubles the row's height. The
            // `min-w` floor is the wrap guard and `flex-1` shares the rest.
            <div
              key={status}
              className="flex min-w-0 flex-1 flex-col sm:min-w-[260px] [&>section]:h-full"
            >
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

        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
          <div className="min-w-0 flex-1 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3 sm:min-w-[300px]">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400">
                <Brain className="size-3.5" aria-hidden />
                {t("landing.hero.flow.aiPlan")}
              </span>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
                {t("ai.applied")}
              </span>
            </div>
            <ol
              role="list"
              className="list-inside list-decimal space-y-0.5 text-[11px] leading-snug text-muted-foreground"
            >
              {planSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-xl border border-border bg-surface px-3 py-2.5 sm:basis-[calc(40%-0.3125rem)]">
            <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
              ADR-127: No client cache
            </span>
            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
              {t("knowledge.status.Accepted")}
            </span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
