import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HelpCircle, X } from "lucide-react";
import { Button } from "../ui/Button";
import { BrandMark } from "../ui/Logo";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const FLAG_KEY = "devflow.onboardingDone";

/** Flag is per-user (suffixed with the user id) so a brand-new account on the
 * same browser still gets the first-login tour. */
const flagKey = (userId: string) => `${FLAG_KEY}.${userId}`;

/** Set once the tour is finished/skipped, so it only runs after first login. */
export function setOnboardingDone(userId: string) {
  try {
    localStorage.setItem(flagKey(userId), "1");
  } catch {
    // storage unavailable — nothing to persist
  }
}

/** True when the tour has already been dismissed on this browser for this user. */
export function isOnboardingDone(userId: string) {
  try {
    return localStorage.getItem(flagKey(userId)) === "1";
  } catch {
    return true;
  }
}

export const ONBOARDING_FLAG_KEY = FLAG_KEY;

/** Ask AppShell to open the mobile hamburger drawer (sidebar tour targets). */
export function requestSidebarDrawer(open: boolean) {
  window.dispatchEvent(
    new CustomEvent(open ? "devflow:open-sidebar" : "devflow:close-sidebar"),
  );
}

/** Ask AppShell to leave AI sidebar mode — nav's `data-tour="sidebar-workspaces"`
 *  is unmounted while modeAi, which used to leave pageReady stuck forever. */
export function requestNavSidebar() {
  window.dispatchEvent(new CustomEvent("devflow:ensure-nav-sidebar"));
}

interface TourStep {
  /** Resolves the element to highlight. Null → centered (welcome) step. */
  target: () => HTMLElement | null;
  /** i18n keys resolved at render time. */
  titleKey: string;
  descriptionKey: string;
  /** Show the tooltip card to the left of the target instead of below/above.
   * For right-column targets (e.g. sprint health) where a below card reads
   * awkwardly. Falls back to below/above when there isn't room. */
  placeLeft?: boolean;
  /** Live inside the mobile sidebar drawer — open it before scrolling. */
  needsSidebar?: boolean;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_W = 320;
/** AppShell hides the sidebar below lg (64rem / 1024px). */
const SIDEBAR_BP = 1024;
/** Drawer slide is duration-300; wait for it before scrollIntoView. */
const DRAWER_SETTLE_MS = 320;
/** Fail-open: if the target never becomes measurable, still show the card.
 *  Exported so tests can assert the freeze path (missing data-tour) unblocks. */
export const CARD_FALLBACK_MS = 1200;

/**
 * True when a meaningful slice of `el` intersects the viewport.
 *
 * A fully-contained check is wrong for the dashboard's `overflow-x-auto`
 * action row: a select can sit halfway off the right edge (or need a
 * horizontal nudge) while still being "visible enough" to spotlight. Requiring
 * the whole box inside ±16px made those steps drop the highlight and show a
 * bare instruction card — the mobile bug users hit.
 */
export function isOnScreen(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (r.width <= 0 || r.height <= 0) return false;
  const visW = Math.min(r.right, vw) - Math.max(r.left, 0);
  const visH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
  // Need a real slice on both axes — a zero-area touch at the corner is not
  // "on screen" (and a translated-off drawer still has layout size at x<0).
  return visW >= Math.min(16, r.width) && visH >= Math.min(16, r.height);
}

/** Closed mobile drawer: translated off-canvas (layout size, not visible). */
function isInClosedMobileDrawer(el: HTMLElement): boolean {
  if (window.innerWidth >= SIDEBAR_BP) return false;
  const aside = el.closest("aside");
  if (!aside) return false;
  const r = aside.getBoundingClientRect();
  return r.right <= 0 || aside.classList.contains("-translate-x-full");
}

/** Card horizontal clamp: never place the left edge past the right gutter. */
function clampCardLeft(vw: number, desired: number): number {
  const cardW = Math.min(TOOLTIP_W, Math.max(160, vw - 32));
  return Math.min(Math.max(16, desired), Math.max(16, vw - cardW - 16));
}

/**
 * First-login onboarding tour — a step-driven spotlight that highlights real
 * dashboard elements with a teal box and walks the user through them.
 *
 * Built from scratch (no tour library). A fixed overlay at z-[80] sits above
 * dialogs (z-[70]) and the sidebar (z-[60]); each step measures the target via
 * getBoundingClientRect and positions the highlight box + tooltip card.
 *
 * Mobile contract (the bug this tour used to ship):
 * 1. Always `scrollIntoView` the target (both axes) before spotlighting —
 *    the old code only scrolled when the target was *already* on screen.
 * 2. Sidebar steps open the hamburger drawer, then scroll + highlight.
 * 3. The instruction card waits for the highlight rect (or a short timeout)
 *    so users see the border first, then the guidance — not a floating tip
 *    with no target.
 *
 * Controlled: the parent (DashboardPage) decides when to open (first login /
 * ?tour=1 / "Hướng dẫn" button) and passes `open` + `onClose`. The tour itself
 * only measures, highlights, and advances.
 *
 * Portaled to `document.body` so AppShell's `inert={drawerOpen}` on <main>
 * cannot freeze the card while the mobile sidebar is open for steps 4–5.
 */
export function OnboardingTour({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [pageReady, setPageReady] = useState(false);
  /** Gate the instruction card until the spotlight is up (or fallback fires). */
  const [cardReady, setCardReady] = useState(false);
  const rafRef = useRef<number | null>(null);
  // The card is a real modal (aria-modal, click-catcher overlay), so keyboard
  // focus has to stay inside it: the trap pulls focus to the first control on
  // open and returns it to whatever opened the tour on close.
  const { ref: cardRef, onKeyDown: trapTab } = useFocusTrap<HTMLDivElement>(open);

  const finish = useCallback(() => {
    setOnboardingDone(userId);
    requestSidebarDrawer(false);
    onClose();
  }, [userId, onClose]);

  // Unblock the first target measurement once the current step's element exists.
  useEffect(() => {
    if (!open) return;
    if (step === 0) {
      setPageReady(true);
      return;
    }
    setPageReady(false);
    const id = window.setInterval(() => {
      const target = STEPS[step].target();
      if (target) {
        setPageReady(true);
        window.clearInterval(id);
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [open, step]);

  // Sidebar steps on mobile: open the hamburger drawer so the target exists
  // in a visible box; other steps close it so the dashboard isn't covered.
  // On open, force nav mode — AI mode unmounts sidebar-workspaces, so
  // pageReady would never flip and the click-catcher would freeze the page.
  useEffect(() => {
    if (!open) {
      requestSidebarDrawer(false);
      return;
    }
    requestNavSidebar();
    if (step === 0) return;
    const wantsDrawer =
      STEPS[step].needsSidebar === true && window.innerWidth < SIDEBAR_BP;
    requestSidebarDrawer(wantsDrawer);
  }, [open, step]);

  // Jump to the target (both axes) as soon as it is in the DOM. The old gate
  // — scroll only when already on screen — left overflow-x targets stuck
  // off the right edge with no highlight. Wait for the drawer slide first
  // when the step lives in the mobile sidebar.
  useEffect(() => {
    if (!open || step === 0 || !pageReady) return;
    const needsDrawer =
      STEPS[step].needsSidebar === true && window.innerWidth < SIDEBAR_BP;
    const delay = needsDrawer ? DRAWER_SETTLE_MS : 40;
    const id = window.setTimeout(() => {
      const el = STEPS[step].target();
      if (!el || isInClosedMobileDrawer(el)) return;
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, delay);
    return () => window.clearTimeout(id);
  }, [open, step, pageReady]);

  // Border first, then the card: wait for a measurable rect, with a timeout so
  // a never-visible target cannot strand the user on a blank overlay.
  // The timeout starts even while pageReady is still false — a missing
  // data-tour never clears pageReady, and gating on it used to leave only
  // the full-screen click-catcher up (no Skip/X/Next → frozen screen).
  useEffect(() => {
    if (!open) return;
    setCardReady(welcomeStep(step));
    if (welcomeStep(step)) return;
    const id = window.setTimeout(() => setCardReady(true), CARD_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    if (rect || welcomeStep(step)) setCardReady(true);
  }, [open, rect, step]);

  const measure = useCallback(() => {
    if (!open) return;
    const target = STEPS[step].target();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < SIDEBAR_BP;

    // Identity bail-outs: the rAF loop runs every frame — minting a fresh
    // object each tick re-rendered the whole portal and felt frozen on
    // slower machines even when nothing had moved.
    if (target) {
      // Still scrolling, or in a closed drawer: leave rect null so the card
      // stays hidden (cardReady fallback still unblocks after ~1.2s).
      if (!isOnScreen(target)) {
        setRect((prev) => (prev ? null : prev));
        const fallbackPos = { top: 60, left: clampCardLeft(vw, 16) };
        setCardPos((prev) =>
          prev &&
          prev.top === fallbackPos.top &&
          prev.left === fallbackPos.left
            ? prev
            : fallbackPos,
        );
        return;
      }

      const r = target.getBoundingClientRect();
      setRect((prev) =>
        prev &&
        prev.top === r.top &&
        prev.left === r.left &&
        prev.width === r.width &&
        prev.height === r.height
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      );

      const spaceBelow = vh - r.bottom;
      const spaceAbove = r.top;
      const placeBelow = spaceBelow > 220 || spaceBelow >= spaceAbove;
      const roomLeft = r.left - 16 >= TOOLTIP_W + 12;

      let nextPos: { top: number; left: number };
      if (STEPS[step].placeLeft && roomLeft && !isMobile) {
        nextPos = {
          top: Math.min(
            Math.max(12, r.top + r.height / 2 - 110),
            vh - 40,
          ),
          left: clampCardLeft(vw, r.left - TOOLTIP_W - 12),
        };
      } else if (placeBelow) {
        nextPos = {
          top: Math.min(r.bottom + 12, vh - 40),
          left: clampCardLeft(vw, r.left),
        };
      } else {
        nextPos = {
          top: Math.max(12, r.top - 280),
          left: clampCardLeft(vw, r.left),
        };
      }
      setCardPos((prev) =>
        prev &&
        prev.top === nextPos.top &&
        prev.left === nextPos.left
          ? prev
          : nextPos,
      );
    } else {
      setRect((prev) => (prev ? null : prev));
      const centerPos = {
        top: vh / 2 - 140,
        left: clampCardLeft(vw, vw / 2 - TOOLTIP_W / 2),
      };
      setCardPos((prev) =>
        prev &&
        prev.top === centerPos.top &&
        prev.left === centerPos.left
          ? prev
          : centerPos,
      );
    }
  }, [open, step]);

  // Track position on scroll/resize so the box follows the element.
  useEffect(() => {
    if (!open) return;
    measure();
    function loop() {
      measure();
      rafRef.current = window.requestAnimationFrame(loop);
    }
    rafRef.current = window.requestAnimationFrame(loop);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [open, measure]);

  // Keyboard: Esc closes the tour.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, finish]);

  // Reset step state when the tour reopens (Help button / ?tour=1 after close).
  useEffect(() => {
    if (open) return;
    setStep(0);
    setRect(null);
    setPageReady(false);
    setCardReady(false);
  }, [open]);

  if (!open) return null;

  const total = STEPS.length;
  const isLast = step === total - 1;
  const current = STEPS[step];
  const welcome = step === 0;

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    setPageReady(false);
    setCardReady(false);
    setRect(null);
    setStep((s) => s + 1);
  };

  const title = welcome ? t("onboarding.welcome.title") : t(current.titleKey);
  const description = welcome
    ? t("onboarding.welcome.desc")
    : t(current.descriptionKey);

  // Instruction card only once the spotlight is up (or the fail-open timeout).
  const showCard = welcome || cardReady;

  const highlight = pageReady && rect ? (
    <>
      {/* Spotlight halo — a huge box-shadow dims everything *around* the target
          while the element inside stays fully legible (no dark overlay or blur
          sitting on top of it). Sits 8px out so the ring's edge meets the halo. */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-[80] rounded-lg transition-all duration-300"
        style={{
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
        }}
      />
      {/* Teal border + ring on its own element so Tailwind's ring box-shadow
          isn't overridden by the halo's shadow. */}
      <div
        aria-hidden
        data-tour-highlight
        className="pointer-events-none fixed z-[80] rounded-lg border-2 border-primary ring-4 ring-primary/30 transition-all duration-300"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />
    </>
  ) : null;

  const overlay = (
    <>
      {/* Click-catcher: transparent on targeted steps (the halo provides the
          dimming), a solid dim on the welcome step which has no target. Keeps
          clicks trapped in the tour. */}
      <div
        className={
          welcome
            ? "fixed inset-0 z-[80] bg-black/50"
            : "fixed inset-0 z-[80]"
        }
        aria-hidden="true"
      />

      {highlight}

      {showCard && (
        <div
          ref={cardRef}
          id="devflow-tour-root"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onKeyDown={trapTab}
          className="fixed z-[90] w-[calc(100vw-2rem)] max-w-sm touch-manipulation rounded-xl border border-border bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise"
          style={{
            top: cardPos?.top ?? 16,
            left: cardPos?.left ?? 16,
          }}
        >
          <button
            type="button"
            onClick={finish}
            aria-label={t("onboarding.close")}
            className="absolute right-3 top-3 cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>

          <div className="mb-3 flex items-center gap-2">
            <BrandMark size="sm" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
              {t("onboarding.stepOf", { current: step + 1, total })}
            </span>
          </div>

          <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>

          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={finish}>
              {t("onboarding.skip")}
            </Button>
            <Button size="sm" onClick={goNext}>
              {isLast ? t("onboarding.done") : t("onboarding.next")}
            </Button>
          </div>
        </div>
      )}
    </>
  );

  // Portal out of AppShell <main inert={drawerOpen}> so opening the mobile
  // sidebar for steps 4–5 does not freeze the tour card.
  return createPortal(overlay, document.body);
}

function welcomeStep(step: number): boolean {
  return step === 0;
}

/** Button to re-open the tour from the dashboard.
 *  shrink-0 + whitespace-nowrap: inside a flex/overflow row the label used to
 *  wrap to ~3 characters per line on mobile and read as clipped text. */
export function TourReopenButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-primary"
    >
      <HelpCircle className="size-4" aria-hidden />
      {t("onboarding.helpButton")}
    </button>
  );
}

// ─── Step targets ───────────────────────────────────────────────────────────
// Resolved lazily each render so they re-query the DOM for freshly rendered
// elements. Targets use `data-tour` attributes added to the dashboard/shell
// (not aria-labels, which vary by locale).

const byDataTour = (name: string) => (): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-tour="${name}"]`);

const STEPS: TourStep[] = [
  // step 0 — welcome (no target)
  {
    target: () => null,
    titleKey: "onboarding.welcome.title",
    descriptionKey: "onboarding.welcome.desc",
  },
  // step 1 — workspace select (overflow-x action row on mobile)
  {
    target: byDataTour("workspace-select"),
    titleKey: "onboarding.step1.title",
    descriptionKey: "onboarding.step1.desc",
  },
  // step 2 — project select (overflow-x action row on mobile)
  {
    target: byDataTour("project-select"),
    titleKey: "onboarding.step2.title",
    descriptionKey: "onboarding.step2.desc",
  },
  // step 3 — "New workspace" button (overflow-x action row on mobile)
  {
    target: byDataTour("new-workspace"),
    titleKey: "onboarding.step3.title",
    descriptionKey: "onboarding.step3.desc",
  },
  // step 4 — sidebar workspaces section (mobile: open drawer first)
  {
    target: byDataTour("sidebar-workspaces"),
    titleKey: "onboarding.step4.title",
    descriptionKey: "onboarding.step4.desc",
    needsSidebar: true,
  },
  // step 5 — sidebar bottom (user menu / settings row)
  {
    target: byDataTour("sidebar-bottom"),
    titleKey: "onboarding.step5.title",
    descriptionKey: "onboarding.step5.desc",
    needsSidebar: true,
  },
  // step 6 — sprint health card (right column → tooltip to the LEFT)
  {
    target: byDataTour("sprint-health"),
    titleKey: "onboarding.step6.title",
    descriptionKey: "onboarding.step6.desc",
    placeLeft: true,
  },
  // step 7 — stats row
  {
    target: byDataTour("stats"),
    titleKey: "onboarding.step7.title",
    descriptionKey: "onboarding.step7.desc",
  },
];
