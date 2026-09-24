import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, CircleUserRound, LogOut, Settings, UserRound } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../ui/Avatar";

interface UserMenuProps {
  direction?: "up" | "down";
  compact?: boolean;
  /** Extra classes on the trigger (e.g. matching rail hit-area). */
  triggerClassName?: string;
  /** Optional trigger content for the compact (icon-only) form. */
  icon?: React.ReactNode;
}

export function UserMenu({
  direction = "down",
  compact = false,
  triggerClassName = "",
  icon,
}: UserMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  // A pointer click on the trigger should leave focus on the button, but
  // keyboard activation must move it into the menu. React batches both
  // onClick paths identically, so record the input modality here and let the
  // open effect below read it.
  const openedByPointer = useRef(false);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inside =
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target);
      if (!inside) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (dropdownRef.current?.contains(document.activeElement)) {
          // Focus is inside the portal; returning it to the trigger keeps the
          // keyboard user on the widget they opened.
          triggerRef.current?.focus();
        }
        setOpen(false);
      }
    }
    function onScroll() {
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
  }, []);

  // Menu-button pattern: after keyboard activation, put focus on the first
  // menuitem so arrows/Enter work immediately instead of Tab-ing through the
  // rest of the page (the portal items are the next tab stop anyway, but only
  // after unrelated body content, since the menu is appended to <body>).
  useEffect(() => {
    if (open && !openedByPointer.current) {
      dropdownRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
    openedByPointer.current = false;
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      // Menu-button behavior: Tab leaves the menu and closes it, so a
      // keyboard user does not have to walk back through the open list.
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [...(dropdownRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "ArrowDown") next = current + 1 >= items.length ? 0 : current + 1;
    else next = current - 1 < 0 ? items.length - 1 : current - 1;
    items[next]?.focus();
  }

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/login");
  }

  // Same split as Avatar — axe label-content-name-mismatch treats the
  // initials glyph as visible text even when the span is aria-hidden.
  const visibleUsername = currentUser?.username ?? t("auth.displayName");
  const triggerInitials =
    visibleUsername
      .split(/[\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";

  function goTo(path: string) {
    setOpen(false);
    navigate(path);
  }

  function getDropdownStyle(): React.CSSProperties {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 224; // w-56
    const alignRight = rect.right + dropdownWidth > window.innerWidth;
    const left = alignRight ? rect.right - dropdownWidth : rect.left;
    if (direction === "up") {
      return { position: "fixed" as const, left, bottom: window.innerHeight - rect.top + 8, zIndex: 80 };
    }
    return { position: "fixed" as const, left, top: rect.bottom + 8, zIndex: 80 };
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onPointerDown={() => {
          openedByPointer.current = true;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            // Open with the keyboard; the open effect moves focus to the
            // first item once the menu renders.
            event.preventDefault();
            setOpen(true);
          }
        }}
        // Label in Name (2.5.3): expanded trigger's visible text is initials
        // + username (axe reads both even when the initials span is aria-hidden).
        // Compact (rail) has no text — keep the generic name.
        aria-label={
          compact
            ? t("ui.userMenuAria")
            : `${t("ui.userMenuAria")}: ${triggerInitials} ${visibleUsername}`
        }
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          compact
            ? `flex items-center gap-1 rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground ${triggerClassName}`
            : `flex min-w-0 items-center gap-3 rounded-lg px-1.5 py-1 text-left transition-colors duration-150 hover:bg-elevated ${triggerClassName}`
        }
      >
        {compact ? (
          icon ?? <CircleUserRound className="size-4" aria-hidden />
        ) : (
          <>
            <Avatar
              name={currentUser?.username ?? "?"}
              id={currentUser?.id}
              src={currentUser?.avatarUrl}
            />
            {/* WCAG 1.4.4: the sidebar is fixed-width, so at 200% root
                font-size this line ellipsizes (e.g. the username clips at
                ~9 chars). The truncated string has no other on-screen
                source, so it carries a title to expose the full text on
                hover — the standard remedy for chrome that must truncate.
                Email is intentionally NOT shown here (long Gmail addresses
                overflowed the navbar); view it in Profile/Settings. */}
            <span className="min-w-0 flex-1 leading-tight">
              <span
                className="block truncate text-sm font-medium"
                title={currentUser?.username}
              >
                {currentUser?.username ?? t("auth.displayName")}
              </span>
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </>
        )}
      </button>

      {open &&
        createPortal(
        <div
          ref={dropdownRef}
          role="menu"
          onKeyDown={onMenuKeyDown}
          style={getDropdownStyle()}
          className="w-56 overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise"
        >
          <MenuItem
            icon={<UserRound className="size-4" aria-hidden />}
            label={t("userMenu.profile")}
            onClick={() => goTo("/profile")}
          />
          <MenuItem
            icon={<Settings className="size-4" aria-hidden />}
            label={t("userMenu.settings")}
            onClick={() => goTo("/settings")}
          />
          <div className="my-1 border-t border-border/60" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive transition-colors duration-150 hover:bg-destructive/10"
          >
            <LogOut className="size-4" aria-hidden />
            {t("userMenu.logout")}
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-elevated"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  );
}
