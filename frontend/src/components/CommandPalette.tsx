import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  CornerDownLeft,
  LogOut,
  Loader2,
  BookmarkPlus,
  X,
} from "lucide-react";
import {
  api,
  createSavedSearch,
  deleteSavedSearch,
  getSavedSearches,
  pagedItems,
  searchWorkspace,
} from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "./ui/ToastProvider";
import type {
  ProjectResponse,
  SavedSearchResponse,
  SearchResponse,
  WorkspaceResponse,
} from "../types/api";

interface Command {
  id: string;
  label: string;
  group: string;
  keywords: string;
  run: () => void;
  onDelete?: () => void;
}

interface SavedFilters {
  priority?: string;
  due?: string;
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [remoteResults, setRemoteResults] = useState<SearchResponse | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [saveMode, setSaveMode] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const hasActiveFilters = Boolean(
    query.trim() || statusFilter || priorityFilter || dueFilter,
  );

  const { data: savedRaw, reload: reloadSaved } = useApi<SavedSearchResponse[]>(
    () => (open ? getSavedSearches() : Promise.resolve([])),
    [open],
  );
  const savedSearches = useMemo(
    () =>
      (savedRaw ?? []).filter(
        (saved) => !workspaceId || saved.workspaceId === workspaceId,
      ),
    [savedRaw, workspaceId],
  );

  const { data: workspacesRaw } = useApi<unknown>(
    () => (open ? api("/workspaces") : Promise.resolve([])),
    [open],
  );
  const workspaces = useMemo(
    () => pagedItems<WorkspaceResponse>(workspacesRaw),
    [workspacesRaw],
  );
  const { data: projectsRaw } = useApi<unknown>(
    () =>
      open && workspaceId
        ? api(`/workspaces/${workspaceId}/projects`)
        : Promise.resolve([]),
    [open, workspaceId],
  );
  const projects = useMemo(
    () => pagedItems<ProjectResponse>(projectsRaw),
    [projectsRaw],
  );

  const dueRange = useMemo((): { dueAfter?: string; dueBefore?: string } => {
    if (!dueFilter) return {};
    const now = new Date();
    if (dueFilter === "overdue") return { dueBefore: now.toISOString() };
    if (dueFilter === "today") {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { dueBefore: end.toISOString() };
    }
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { dueBefore: week.toISOString() };
  }, [dueFilter]);

  useEffect(() => {
    const keyword = query.trim();
    if (
      !open ||
      !workspaceId ||
      (keyword.length < 2 && !statusFilter && !priorityFilter && !dueFilter)
    ) {
      setRemoteResults(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchWorkspace(workspaceId, keyword, {
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        ...dueRange,
      })
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
  }, [open, query, workspaceId, statusFilter, priorityFilter, dueRange]);

  function savedSearchTargetPath(): string {
    try {
      const last = localStorage.getItem("devflow.lastBoardPath");
      if (last && last.startsWith(`/workspaces/${workspaceId}/`)) return last;
    } catch {}
    if (projects && projects.length > 0) {
      return `/workspaces/${workspaceId}/projects/${projects[0].id}`;
    }
    return `/workspaces/${workspaceId}`;
  }

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    for (const saved of savedSearches) {
      let filters: SavedFilters = {};
      try {
        filters = saved.filtersJson
          ? (JSON.parse(saved.filtersJson) as SavedFilters)
          : {};
      } catch {}

      const fs = encodeURIComponent(
        JSON.stringify({
          q: saved.query ?? "",
          priority: filters.priority ?? "",
          due: filters.due ?? "",
        }),
      );

      list.push({
        id: `saved-${saved.id}`,
        label: saved.name,
        group: t("commandPalette.savedGroup"),
        keywords: `${saved.query ?? ""} ${filters.priority ?? ""}`,
        run: () =>
          navigate(`${savedSearchTargetPath()}?fs=${fs}`),
        onDelete: () => {
          void deleteSavedSearch(saved.id)
            .then(() => {
              push(t("commandPalette.savedSearchDeleted"));
              reloadSaved();
            })
            .catch(() => push(t("commandPalette.savedSearchDeleteFailed"), "error"));
        },
      });
    }

    for (const workspace of workspaces ?? []) {
      list.push({
        id: `ws-${workspace.id}`,
        label: workspace.name,
        group: t("nav.workspaces"),
        keywords: `${workspace.slug} ${workspace.description ?? ""}`,
        run: () => navigate(`/workspaces/${workspace.id}`),
      });
    }

    if (workspaceId) {
      for (const project of projects ?? []) {
        list.push({
          id: `proj-${project.id}`,
          label: `${project.key} · ${project.name}`,
          group: t("nav.projects"),
          keywords: project.description ?? "",
          run: () => navigate(`/workspaces/${workspaceId}/projects/${project.id}`),
        });
      }
    }

    list.push({
      id: "signout",
      label: t("userMenu.logout"),
      group: t("commandPalette.actionsGroup"),
      keywords: "logout exit",
      run: () => void logout(),
    });

    return list;
  }, [
    savedSearches,
    workspaces,
    projects,
    workspaceId,
    navigate,
    logout,
    t,
    push,
    reloadSaved,
  ]);

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

    if (!q && !statusFilter && !priorityFilter && !dueFilter) {
      return localMatches;
    }
    if (!remoteResults) {
      return localMatches;
    }

    const taskCommands: Command[] = remoteResults.tasks.flatMap((task) => {
      const projectId = projectIdByKey.get(task.projectKey.toUpperCase());
      if (!projectId || !workspaceId) return [];
      return [
        {
          id: `task-${task.id}`,
          label: `${task.projectKey} · ${task.title}`,
          group: t("commandPalette.tasksGroup"),
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
      group: t("nav.projects"),
      keywords: project.status,
      run: () =>
        navigate(`/workspaces/${workspaceId}/projects/${project.id}`),
    }));

    const others = localMatches.filter((command) => command.group !== t("nav.projects"));

    return [...remoteProjects, ...taskCommands, ...others];
  }, [
    commands,
    query,
    remoteResults,
    projectIdByKey,
    workspaceId,
    navigate,
    t,
    statusFilter,
    priorityFilter,
    dueFilter,
  ]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setStatusFilter("");
      setPriorityFilter("");
      setDueFilter("");
      setSaveMode(false);
      setSavedName("");
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

  async function handleSaveSearch() {
    if (!workspaceId || !hasActiveFilters) return;
    const name = savedName.trim();
    if (!name || savingSearch) return;
    setSavingSearch(true);
    try {
      await createSavedSearch({
        name,
        workspaceId,
        query: query.trim(),
        filtersJson: JSON.stringify({
          priority: priorityFilter,
          due: dueFilter,
        }),
      });
      push(t("commandPalette.savedSearchSaved"));
      setSaveMode(false);
      setSavedName("");
      reloadSaved();
    } catch (err) {
      push(
        err instanceof Error
          ? err.message
          : t("commandPalette.savedSearchSaveFailed"),
        "error",
      );
    } finally {
      setSavingSearch(false);
    }
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
    <div className="fixed inset-0 z-50" role="dialog" aria-label={t("commandPalette.paletteAria")}>
      <button
        type="button"
        aria-label={t("commandPalette.closePalette")}
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
            placeholder={t("commandPalette.placeholder")}
            className="w-full bg-transparent py-3.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        {workspaceId && (
          <div
            className="flex items-center gap-1.5 border-b border-border px-3 py-2"
            role="group"
            aria-label={t("commandPalette.filters")}
          >
            <select
              aria-label={t("commandPalette.statusFilter")}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-md border border-border bg-surface px-1.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:border-border-strong focus:outline-none"
            >
              <option value="">{t("commandPalette.anyStatus")}</option>
              <option value="Backlog">{t("task.backlogStatus")}</option>
              <option value="InProgress">{t("board.inProgress")}</option>
              <option value="InReview">{t("board.inReview")}</option>
              <option value="Done">{t("board.done")}</option>
            </select>
            <select
              aria-label={t("commandPalette.priorityFilter")}
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="rounded-md border border-border bg-surface px-1.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:border-border-strong focus:outline-none"
            >
              <option value="">{t("commandPalette.anyPriority")}</option>
              <option value="Low">{t("task.low")}</option>
              <option value="Medium">{t("task.medium")}</option>
              <option value="High">{t("task.high")}</option>
              <option value="Critical">{t("task.critical")}</option>
            </select>
            <select
              aria-label={t("commandPalette.dueFilter")}
              value={dueFilter}
              onChange={(event) => setDueFilter(event.target.value)}
              className="rounded-md border border-border bg-surface px-1.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:border-border-strong focus:outline-none"
            >
              <option value="">{t("commandPalette.anyDue")}</option>
              <option value="overdue">{t("commandPalette.dueOverdue")}</option>
              <option value="today">{t("commandPalette.dueToday")}</option>
              <option value="week">{t("commandPalette.dueWeek")}</option>
            </select>
          </div>
        )}

        {workspaceId && hasActiveFilters && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            {saveMode ? (
              <>
                <BookmarkPlus className="size-3.5 shrink-0 text-primary" aria-hidden />
                <input
                  value={savedName}
                  autoFocus
                  onChange={(event) => setSavedName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveSearch();
                    } else if (event.key === "Escape") {
                      event.stopPropagation();
                      setSaveMode(false);
                      setSavedName("");
                    }
                  }}
                  placeholder={t("commandPalette.savedNamePlaceholder")}
                  maxLength={60}
                  aria-label={t("commandPalette.saveThisSearch")}
                  className="w-full bg-transparent py-0.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveSearch()}
                  disabled={!savedName.trim() || savingSearch}
                  aria-label={t("commandPalette.saveThisSearch")}
                  className="shrink-0 rounded-md border border-primary bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-medium text-primary disabled:opacity-40"
                >
                  {savingSearch ? t("common.loading") : t("filter.save")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSaveMode(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:text-primary"
              >
                <BookmarkPlus className="size-3.5" aria-hidden />
                {t("commandPalette.saveThisSearch")}
              </button>
            )}
          </div>
        )}

        <ul ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && !searching && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("commandPalette.noResults")}
            </li>
          )}
          {searching && (
            <li className="flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              {t("common.loading")}
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
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.onDelete && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={t("commandPalette.deleteSavedAria", {
                        name: command.label,
                      })}
                      onClick={(event) => {
                        event.stopPropagation();
                        command.onDelete?.();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          command.onDelete?.();
                        }
                      }}
                      className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                    >
                      <X className="size-3.5" aria-hidden />
                    </span>
                  )}
                  {index === selected && !command.onDelete && (
                    <CornerDownLeft className="size-3.5 shrink-0" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="flex items-center gap-3 border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">
          <span>{t("commandPalette.navigateHint")}</span>
          <span>{t("commandPalette.openHint")}</span>
          <span className="ml-auto flex items-center gap-1">
            <LogOut className="size-3" aria-hidden />
            {t("userMenu.logout")}
          </span>
        </footer>
      </div>
    </div>
  );
}
