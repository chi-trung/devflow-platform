import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { AiAssistantPanel } from "./AiAssistantPanel";
import type { AiPageContext } from "./AiSuggestedPrompts";

const OPEN_KEY = "devflow.aiPanelOpen";
/** Slide duration — must match the transitionDuration below. */
const SLIDE_MS = 250;

interface AiDockProps {
  workspaceId: string;
  projectId?: string;
  sprintId?: string | null;
  epicId?: string | null;
  context?: AiPageContext;
  /** Called after AI actions execute so the current page can refresh. */
  onTaskChanged?: () => void;
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Right-edge AI assistant dock (replaces the old bottom-right FAB).
 *
 * - Closed: a slim vertical edge tab (AI + Sparkles) on the right rail.
 * - Open: a full-height panel slides in from the right as an overlay
 *   (not push — board layout stays stable).
 *
 * The panel node stays mounted while toggling so `translate-x` can animate
 * both directions ("dẹp ra dẹp vô"). Reduced-motion users get an instant
 * toggle (duration-0, one-shot — never an infinite animation, which strobes).
 */
export function AiDock({
  workspaceId,
  projectId,
  sprintId,
  epicId,
  context = "workspace",
  onTaskChanged,
}: AiDockProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(readOpen);
  const [reduced, setReduced] = useState(false);
  const tabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  // Persist preference across reloads so the dock doesn't surprise-open
  // on a cold load (default = closed).
  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      // Private mode / quota — preference is best-effort only.
    }
  }, [open]);

  // Focus management: open → focus the composer; close → return focus to the
  // edge tab so keyboard users don't fall to <body>.
  useEffect(() => {
    if (wasOpen.current === open) return;
    const closing = wasOpen.current && !open;
    wasOpen.current = open;
    if (closing) {
      tabRef.current?.focus();
      return;
    }
    requestAnimationFrame(() => {
      const panel = document.getElementById("ai-dock-panel");
      const composer = panel?.querySelector("textarea");
      if (composer instanceof HTMLTextAreaElement) composer.focus();
    });
  }, [open]);

  // Esc closes the dock — but if focus is in a text field, blur first so a
  // half-typed draft isn't lost to an immediate unmount-style close.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable)
      ) {
        target.blur();
        event.preventDefault();
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  // Slide duration: 0 under reduced-motion (instant, no strobe risk).
  const durationMs = reduced ? 0 : SLIDE_MS;

  return (
    <div
      className="pointer-events-none fixed inset-y-0 right-0 z-[45] flex"
      data-testid="ai-dock"
    >
      {/* Edge tab — always mounted; slides left when open so it tucks under
          the panel edge instead of sitting on top of the header. */}
      <button
        ref={tabRef}
        type="button"
        aria-label={open ? t("ai.assistantClose") : t("ai.assistantOpen")}
        aria-expanded={open}
        aria-controls="ai-dock-panel"
        onClick={toggle}
        className="pointer-events-auto flex w-8 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 border-l border-border bg-elevated/80 text-muted-foreground transition-[transform,background-color,color] duration-200 ease-out hover:bg-elevated hover:text-primary-strong motion-reduce:transition-none"
        style={{
          transform: open ? "translateX(-100%)" : "translateX(0)",
          transitionDuration: reduced ? "0ms" : undefined,
        }}
      >
        <Sparkles className="size-4" aria-hidden />
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ writingMode: "vertical-rl" }}
        >
          AI
        </span>
      </button>

      {/* Panel container — keeps the node mounted; only transform/visibility
          change. visibility is delayed on close so the exit slide is visible,
          then the node leaves the tab order. */}
      <div
        id="ai-dock-panel"
        role="region"
        aria-label={t("ai.assistant")}
        aria-hidden={!open}
        className="pointer-events-auto w-[min(100vw,26rem)] overflow-hidden"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          visibility: open ? "visible" : "hidden",
          transitionProperty: "transform, visibility",
          transitionDuration: `${durationMs}ms, 0ms`,
          transitionDelay: open ? "0ms, 0ms" : `0ms, ${durationMs}ms`,
          // Cancel any inherited easing so the delay math above is exact.
          transitionTimingFunction: "ease-out, step-end",
        }}
      >
        <AiAssistantPanel
          open={open}
          onClose={() => setOpen(false)}
          workspaceId={workspaceId}
          projectId={projectId}
          sprintId={sprintId}
          epicId={epicId}
          context={context}
          variant="dock"
          onTaskChanged={onTaskChanged}
        />
      </div>
    </div>
  );
}
