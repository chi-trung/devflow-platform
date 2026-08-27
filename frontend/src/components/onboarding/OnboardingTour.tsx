import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle, X } from "lucide-react";
import { Button } from "../ui/Button";
import { BrandMark } from "../ui/Logo";

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
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_W = 320;

/** True when `el`'s box intersects the current viewport. A translated-off-screen
 * element (the mobile sidebar drawer) reports its layout size but sits outside
 * these bounds, so this is the reliable way to tell "visible" from "hidden". */
function isOnScreen(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.left >= -16 &&
    r.right <= vw + 16 &&
    r.top >= -16 &&
    r.bottom <= vh + 16
  );
}

/**
 * First-login onboarding tour — a step-driven spotlight that highlights real
 * dashboard elements with a teal box and walks the user through them.
 *
 * Built from scratch (no tour library). A fixed overlay at z-[80] sits above
 * dialogs (z-[70]) and the sidebar (z-[60]); each step measures the target via
 * getBoundingClientRect and positions the highlight box + tooltip card.
 *
 * Controlled: the parent (DashboardPage) decides when to open (first login /
 * ?tour=1 / "Hướng dẫn" button) and passes `open` + `onClose`. The tour itself
 * only measures, highlights, and advances.
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
  const rafRef = useRef<number | null>(null);

  const finish = useCallback(() => {
    setOnboardingDone(userId);
    onClose();
  }, [userId, onClose]);

  // Unblock the first target measurement once the current step's element exists.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      const target = STEPS[step].target();
      if (target || step === 0) {
        setPageReady(true);
        window.clearInterval(id);
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [open, step]);

  // Scroll the target into view before measuring so the box lands on screen.
  // Skipped for off-screen targets (the mobile sidebar drawer): smooth-scrolling
  // toward a translated-out element just yanks the window for no benefit.
  useEffect(() => {
    if (!open || step === 0) return;
    const el = STEPS[step].target();
    if (el && isOnScreen(el)) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const measure = useCallback(() => {
    if (!open) return;
    const target = STEPS[step].target();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // AppShell hides its sidebar below lg (1024px), so tour steps that anchor
    // to sidebar elements (workspaces section, user menu) have no visible spot
    // on mobile. Render those as centered text-only cards instead of chasing an
    // off-screen element with a spotlight box.
    const isMobile = vw < 1024;

    if (target) {
      const r = target.getBoundingClientRect();
      // A translated-off-screen element (the mobile sidebar) still reports its
      // layout size, so offsetWidth/offsetParent don't reveal it — check the
      // rect against the viewport instead.
      if (!isOnScreen(target)) {
        // Hidden (mobile sidebar) or still scrolling into view: drop the
        // highlight and float the card centered just below the top edge.
        setRect(null);
        setCardPos({ top: 60, left: 16 });
        return;
      }

      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });

      const spaceBelow = vh - r.bottom;
      const spaceAbove = r.top;
      const placeBelow = spaceBelow > 220 || spaceBelow >= spaceAbove;
      const roomLeft = r.left - 16 >= TOOLTIP_W + 12;

      if (STEPS[step].placeLeft && roomLeft && !isMobile) {
        // Right-column target: put the card to the LEFT, vertically centered
        // on the highlight box, so it reads against empty margin instead of
        // squatting under a half-visible card below. Clamped to the viewport
        // so a very narrow screen can't push it off the left edge.
        setCardPos({
          top: Math.min(
            Math.max(12, r.top + r.height / 2 - 110),
            vh - 40,
          ),
          left: Math.max(
            16,
            Math.min(r.left - TOOLTIP_W - 12, vw - TOOLTIP_W - 16),
          ),
        });
      } else if (placeBelow) {
        setCardPos({
          top: Math.min(r.bottom + 12, vh - 40),
          left: Math.min(Math.max(16, r.left), vw - TOOLTIP_W - 16),
        });
      } else {
        setCardPos({
          top: Math.max(12, r.top - 280),
          left: Math.min(Math.max(16, r.left), vw - TOOLTIP_W - 16),
        });
      }
    } else {
      setRect(null);
      setCardPos({
        top: vh / 2 - 140,
        left: Math.max(16, vw / 2 - TOOLTIP_W / 2),
      });
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
    setStep((s) => s + 1);
  };

  const title = welcome ? t("onboarding.welcome.title") : t(current.titleKey);
  const description = welcome
    ? t("onboarding.welcome.desc")
    : t(current.descriptionKey);

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

  return (
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

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
    </>
  );
}

/** Button to re-open the tour from the dashboard. */
export function TourReopenButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-primary"
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
  // step 1 — workspace select
  {
    target: byDataTour("workspace-select"),
    titleKey: "onboarding.step1.title",
    descriptionKey: "onboarding.step1.desc",
  },
  // step 2 — project select
  {
    target: byDataTour("project-select"),
    titleKey: "onboarding.step2.title",
    descriptionKey: "onboarding.step2.desc",
  },
  // step 3 — "New workspace" button
  {
    target: byDataTour("new-workspace"),
    titleKey: "onboarding.step3.title",
    descriptionKey: "onboarding.step3.desc",
  },
  // step 4 — sidebar workspaces section
  {
    target: byDataTour("sidebar-workspaces"),
    titleKey: "onboarding.step4.title",
    descriptionKey: "onboarding.step4.desc",
  },
  // step 5 — sidebar bottom (user menu / settings row)
  {
    target: byDataTour("sidebar-bottom"),
    titleKey: "onboarding.step5.title",
    descriptionKey: "onboarding.step5.desc",
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
