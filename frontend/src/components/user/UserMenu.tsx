import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, CircleUserRound, LogOut, Settings, UserRound } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../ui/Avatar";

interface UserMenuProps {
  direction?: "up" | "down";
  compact?: boolean;
}

export function UserMenu({ direction = "down", compact = false }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
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

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/login");
  }

  function goTo(path: string) {
    setOpen(false);
    navigate(path);
  }

  const triggerRef = useRef<HTMLButtonElement>(null);

  function getDropdownStyle(): React.CSSProperties {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    if (direction === "up") {
      return { position: "fixed" as const, left: rect.left, bottom: window.innerHeight - rect.top + 8, zIndex: 80 };
    }
    return { position: "fixed" as const, left: rect.left, top: rect.bottom + 8, zIndex: 80 };
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="User menu"
        aria-expanded={open}
        className={
          compact
            ? "flex items-center gap-1 rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
            : "flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors duration-150 hover:bg-elevated"
        }
      >
        {compact ? (
          <CircleUserRound className="size-4" aria-hidden />
        ) : (
          <>
            <Avatar
              name={currentUser?.username ?? "?"}
              id={currentUser?.id}
            />
            <span className="min-w-0 max-w-[120px] flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">
                {currentUser?.username ?? "Account"}
              </span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                {currentUser?.email}
              </span>
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={getDropdownStyle()}
          className="w-56 overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise"
        >
          <MenuItem
            icon={<UserRound className="size-4" aria-hidden />}
            label="Profile"
            onClick={() => goTo("/profile")}
          />
          <MenuItem
            icon={<Settings className="size-4" aria-hidden />}
            label="Settings"
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
            Logout
          </button>
        </div>
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
