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
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
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

  const menuPosition =
    direction === "up" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="User menu"
        aria-expanded={open}
        className={
          compact
            ? "flex items-center gap-1 rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
            : "flex min-w-0 w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors duration-150 hover:bg-elevated overflow-hidden"
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
            <span className="min-w-0 flex-1 leading-tight">
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
          className={`absolute right-0 z-[80] w-48 overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise ${menuPosition}`}
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
