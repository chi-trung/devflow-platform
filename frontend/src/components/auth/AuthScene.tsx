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
 * The panel is ~835px wide at `lg` (58% of 1440) but ~700px after the frame
 * padding, which fits exactly two columns at the 260px min-width floor and
 * nothing more — a third column needs ~100px that isn't there, and squeezing
 * TaskCard below 250px wraps every meta chip onto its own line. In Progress
 * carries three tasks and Done two, so the taller column sets the height and
 * Done ends ~85px short of its own box. That tail is deliberate and left in
 * place: equal-height columns are what a kanban board looks like, and the only
 * way to close the gap is a third Done task, which costs ~85px of scene height.
 * At 1280x720 the panel has 655px for 548px of content, so that task would
 * leave ~11px of slack — the void it removes is worth less than the scrollbar
 * it risks on a short viewport, which is the whole reason this page exists.
 *
 * Sized to FIT, never to scroll. The whole panel has to live inside the
 * viewport minus the 64px header with no vertical scrollbar, and the split
 * gives the form side roughly 500px of unused height — so the scene carries
 * only what does not already appear elsewhere on the page:
 *   - the count chips row is gone, it repeated the column headers verbatim
 *     ("In Progress 3" / "Done 2") for 40px of height;
 *   - the AI Planner and ADR tiles are one line each, side by side, instead of
 *     a 3-item checklist above a 100px tile. Two tiles with identical padding
 *     and `items-center` are the same height by construction, which is what
 *     the old percentage `basis` split was trying and failing to achieve.
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

  return (
    <BrowserFrame className={className}>
      <div aria-hidden="true" className="[&_a]:pointer-events-none [&_button]:pointer-events-none">
        {/* `grid-cols-2` with `minmax(0, 1fr)`, NOT a `flex-wrap` row with a
            `min-w` floor. Measured: at 1024px the aside is 594px and the
            scene's inner width is 503px, which is 7px less than the 2x260px
            floors plus the 10px gap — so both columns wrapped onto a second
            line, the row doubled from 302px to 600px, and the panel then
            overflowed its 735px column by 80px. Two grid tracks always fit,
            and `minmax(0, 1fr)` lets them shrink below their content instead
            of pushing the row over a line. `lg:min-w-[260px]` is the floor
            TaskCard wants; grid ignores it while the container is narrower.
            That is safe only because TaskCard's meta row is `flex-wrap` with
            `whitespace-nowrap` chips (see TaskCard) — a squeezed chip breaking
            its own text onto two lines looked like a broken card at 1024px,
            and letting the row step to a second line did not. */}
        <div className="grid grid-cols-2 items-stretch gap-2.5">
          {ORDER.map((status) => (
            <div key={status} className="flex min-w-0 flex-col [&>section]:h-full lg:min-w-[260px]">
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

        <div className="mt-3 grid grid-cols-2 items-stretch gap-2.5">
          {/* Both tiles are one line with the same `py`, so they are the same
              height by construction — the old 3-item checklist over a `basis`
              split gave the ADR tile a 100px box with a single centred line
              in it. */}
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/5 px-3 py-2.5">
            <Brain className="size-4 shrink-0 text-violet-400" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-violet-400">
              {t("landing.hero.flow.aiPlan")}
            </span>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary-strong">
              {t("ai.applied")}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
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
