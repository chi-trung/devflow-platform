import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, LogOut, Loader2 } from "lucide-react";
import { api, searchWorkspace } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import type {
  ProjectResponse,
  SearchResponse,
  WorkspaceResponse,
} from "../types/api";

interface Command {
  id: string;
  label: string;
  group: string;
  keywords: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  workspaceId?: string;
}

export function CommandPalette({
  open,
  onClose,
  workspaceId,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [remoteResults, setRemoteResults] = useState<SearchResponse | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { data: workspaces } = useApi<WorkspaceResponse[]>(
    () => (open ? api("/workspaces") : Promise.resolve([])),
    [open],
  );
  const { data: projects } = useApi<ProjectResponse[]>(
    () =>
      open && workspaceId
        ? api(`/workspaces/${workspaceId}/projects`)
        : Promise.resolve([]),
    [open, workspaceId],
  );

  useEffect(() => {
    const keyword = query.trim();
    if (!open || !workspaceId || keyword.length < 2) {
      setRemoteResults(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchWorkspace(workspaceId, keyword)
        .then((data) => {
          if (!cancelled) {
            setRemoteResults(data);
            setSearching(false);
          }
        })
        .catch(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, workspaceId]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    for (const workspace of workspaces ?? []) {
      list.push({
        id: `ws-${workspace.id}`,
        label: workspace.name,
        group: "Workspaces",
        keywords: `${workspace.slug} ${workspace.description ?? ""}`,
        run: () => navigate(`/workspaces/${workspace.id}`),
      });
    }

    if (workspaceId) {
      for (const project of projects ?? []) {
        list.push({
          id: `proj-${project.id}`,
          label: `${project.key} · ${project.name}`,
          group: "Projects",
          keywords: project.description ?? "",
          run: () => navigate(`/workspaces/${workspaceId}/projects/${project.id}`),
        });
      }
    }

    list.push({
      id: "signout",
      label: "Sign out",
      group: "Actions",
      keywords: "logout exit",
      run: () => void logout(),
    });

    return list;
  }, [workspaces, projects, workspaceId, navigate, logout]);

  const projectIdByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects ?? []) {
      map.set(project.key.toUpperCase(), project.id);
    }
    return map;
  }, [projects]);

  const results = useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase();
    const localMatches = commands.filter((command) =>
      q
        ? `${command.label} ${command.keywords}`.toLowerCase().includes(q)
        : true,
    );

    if (!q || !remoteResults) {
      return localMatches;
    }

    const taskCommands: Command[] = remoteResults.tasks.flatMap((task) => {
      const projectId = projectIdByKey.get(task.projectKey.toUpperCase());
      if (!projectId || !workspaceId) return [];
      return [
        {
          id: `task-${task.id}`,
          label: `${task.projectKey} · ${task.title}`,
          group: "Tasks",
          keywords: task.status,
          run: () =>
            navigate(
              `/workspaces/${workspaceId}/projects/${projectId}?task=${task.id}`,
            ),
        },
      ];
    });

    const remoteProjects: Command[] = remoteResults.projects.map((project) => ({
      id: `sproj-${project.id}`,
      label: `${project.key} · ${project.name}`,
      group: "Projects",
      keywords: project.status,
      run: () =>
        navigate(`/workspaces/${workspaceId}/projects/${project.id}`),
    }));

    const others = localMatches.filter((command) => command.group !== "Projects");

    return [...remoteProjects, ...taskCommands, ...others];
  }, [commands, query, remoteResults, projectIdByKey, workspaceId, navigate]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    setSelected((index) => Math.min(index, Math.max(0, results.length - 1)));
  }, [results]);

  useEffect(() => {
    const item = listRef.current?.children[selected] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  function execute(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute(results[selected]);
    } else if (event.key === "Escape") {
      onClose();
    }
  }

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Command palette">
      <button
        type="button"
        aria-label="Close palette"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />

      <div
        className="absolute left-1/2 top-24 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border-strong bg-card shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search workspaces, projects, tasks…"
            className="w-full bg-transparent py-3.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && !searching && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </li>
          )}
          {searching && (
            <li className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Searching tasks & projects…
            </li>
          )}
          {results.map((command, index) => {
            const showGroup = command.group !== lastGroup;
            lastGroup = command.group;
            return (
              <li key={command.id}>
                {showGroup && (
                  <p className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {command.group}
                  </p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => execute(command)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-100 ${
                    index === selected
                      ? "bg-elevated text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className="truncate">{command.label}</span>
                  {index === selected && (
                    <CornerDownLeft className="size-3.5 shrink-0" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="flex items-center gap-3 border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto flex items-center gap-1">
            <LogOut className="size-3" aria-hidden />
            sign out is in Actions
          </span>
        </footer>
      </div>
    </div>
  );
}
