import { KanbanSquare, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";

export function HomePage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-on-primary">
              <KanbanSquare className="size-4" aria-hidden />
            </span>
            <span className="font-mono font-semibold">DevFlow</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="mb-2 text-2xl font-semibold">You're in!</h1>
        <p className="text-muted-foreground">
          Workspaces and the kanban board arrive in the next milestone.
        </p>
      </main>
    </div>
  );
}
