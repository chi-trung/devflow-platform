import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, NavLink } from "react-router-dom";
import { ChevronDown, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ProjectToolsItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface ProjectToolsGroup {
  id: string;
  title: string;
  /** The `to` paths belonging to this group. */
  itemKeys: string[];
}

interface ProjectToolsPopoverProps {
  items: ProjectToolsItem[];
  groups: ProjectToolsGroup[];
  /** Current location.pathname — used to highlight the active tool and show
   *  the current group name on the trigger. */
  activeTo?: string;
  triggerLabel: string;
}

const HOVER_OPEN_DELAY = 150;
const HOVER_CLOSE_GRACE = 200;
const POPUP_WIDTH = 288; // w-72

/**
 * Hover + click project-tools menu. On desktop hovering the trigger opens the
 * grouped tool list; clicking also toggles it (needed for touch/keyboard and
 * for pinning it open after the pointer leaves). The open flag and the hover
 * flag are kept separate so a click-open survives the pointer leaving.
 *
 * Rendered through a portal (position: fixed) so it never gets clipped by the
 * board header's overflow — same pattern as UserMenu.
 */
export function ProjectToolsPopover({
  items,
  groups,
  activeTo,
  triggerLabel,
}: ProjectToolsPopoverProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Where the pointer currently is. Kept in a ref (not state) because the close
  // timer reads it asynchronously — a state value in the closure would be stale
  // by the time the timer fires. Only used by the close logic, never rendered.
  const hovering = useRef<"trigger" | "menu" | null>(null);
  const closeTimer = useRef<number | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Which group is active? Drives the trigger subtitle (e.g. "· Manage").
  const activeSectionLabel = useMemo(() => {
    if (!activeTo) return "";
    return groups.find((group) => group.itemKeys.includes(activeTo))?.title ?? "";
  }, [groups, activeTo]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inside =
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target);
      if (!inside) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onScroll(event: Event) {
      // Ignore scroll events originating from inside the popup (overflow-y-auto)
      // so scrolling the tool list doesn't close it.
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  function openOnHover() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_DELAY);
  }

  function scheduleClose() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      // Only close if the pointer isn't over either surface. Checking the ref
      // (not `open`) means a click-open stays pinned while the pointer stays on
      // the trigger or the popup.
      if (hovering.current === null) setOpen(false);
    }, HOVER_CLOSE_GRACE);
  }

  // Which hover surface the pointer is currently over — trigger, the popup, or
  // neither. Each rect is padded by a few px so the tiny gap between them is
  // part of the hot zone: the pointer never "leaves" mid-travel. Tracking this
  // via a global pointermove (instead of onMouseEnter/onMouseLeave on the DOM
  // nodes) also avoids the mount-under-pointer race where the popup appears
  // under the cursor and its mouseenter never fires.
  function hotZone(x: number, y: number, pad = 6): "trigger" | "menu" | null {
    const rect = (el: HTMLElement | null) => el?.getBoundingClientRect();
    const t = rect(triggerRef.current);
    const d = rect(dropdownRef.current);
    const inside = (r: DOMRect | undefined) =>
      r && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    if (t && inside(t)) return "trigger";
    if (d && inside(d)) return "menu";
    return null;
  }

  // The keep-open/close driver. Runs for every pointer move while the popup is
  // open; sets the hover ref (which the close timer reads) and cancels or arms
  // the close timer based on where the pointer actually is.
  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const zone = hotZone(event.clientX, event.clientY);
      if (zone) {
        hovering.current = zone;
        if (closeTimer.current) window.clearTimeout(closeTimer.current);
      } else {
        hovering.current = null;
        scheduleClose();
      }
    }
    window.addEventListener("pointermove", onPointerMove, true);
    return () => window.removeEventListener("pointermove", onPointerMove, true);
    // scheduleClose/hotZone are stable per render; only `open` gates this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleTriggerClick() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setOpen((value) => !value);
  }

  function handleNavigate(to: string) {
    setOpen(false);
    navigate(to);
  }

  function getDropdownStyle(): React.CSSProperties {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const alignRight = rect.left + POPUP_WIDTH > window.innerWidth - 8;
    const left = alignRight ? rect.right - POPUP_WIDTH : rect.left;
    return {
      position: "fixed",
      left,
      // Sits just below the trigger; the invisible bridge in the wrapper spans
      // the tiny gap so the pointer never leaves the hot zone mid-travel.
      top: rect.bottom + 4,
      zIndex: 80,
    };
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={triggerLabel}
        onClick={handleTriggerClick}
        onMouseEnter={() => {
          hovering.current = "trigger";
          openOnHover();
        }}
        // No onMouseLeave here: closing is driven by the global pointermove hot-zone
        // tracker (armed while open), which survives the trigger→popup gap.
        className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-2 text-sm transition-all duration-200 active:scale-[0.98] sm:px-2.5 sm:py-1.5 ${
          open || activeSectionLabel
            ? "border-border-strong bg-elevated text-foreground"
            : "border-border text-foreground hover:border-border-strong hover:bg-elevated"
        }`}
      >
        <Wrench className="size-4 shrink-0" aria-hidden />
        <span className="hidden xs:inline sm:inline">{triggerLabel}</span>
        {activeSectionLabel && (
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            · {activeSectionLabel}
          </span>
        )}
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            aria-label={triggerLabel}
            onMouseEnter={() => {
              hovering.current = "menu";
              if (closeTimer.current) window.clearTimeout(closeTimer.current);
            }}
            // No onMouseLeave: the global pointermove hot-zone tracker owns closing.
            style={getDropdownStyle()}
            className="rise max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
          >
            {groups.map((group) => {
              const groupItems = items.filter((item) =>
                group.itemKeys.includes(item.to),
              );
              if (groupItems.length === 0) return null;
              return (
                <div key={group.id}>
                  <h3 className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </h3>
                  {groupItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      role="menuitem"
                      onClick={() => handleNavigate(to)}
                      className={({ isActive }) =>
                        `flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-100 ${
                          isActive
                            ? "bg-elevated font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                        }`
                      }
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
