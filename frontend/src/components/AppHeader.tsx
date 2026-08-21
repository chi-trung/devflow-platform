import { KanbanSquare, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./ui/Button";

export function AppHeader({ children }: { children?: ReactNode }) {
  const { logout } = useAuth();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-on-primary">
            <KanbanSquare className="size-4" aria-hidden />
          </span>
          <span className="font-mono font-semibold">DevFlow</span>
        </Link>
        <div className="flex-1">{children}</div>
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </div>
    </header>
  );
}
