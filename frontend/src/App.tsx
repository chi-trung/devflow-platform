import { KanbanSquare, ArrowRight } from "lucide-react";

export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <main className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary text-on-primary">
            <KanbanSquare className="size-5" aria-hidden />
          </span>
          <h1 className="font-mono text-2xl font-semibold">DevFlow</h1>
        </div>

        <p className="mb-6 text-muted-foreground">
          Project management for software teams — workspaces, sprints and
          kanban boards. Design system tokens are live.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-accent px-4 py-2 font-medium text-on-accent hover:opacity-90"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-md border border-border px-4 py-2 font-medium hover:bg-muted"
          >
            Sign in
          </button>
        </div>
      </main>
    </div>
  );
}
