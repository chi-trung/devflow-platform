import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, FolderKanban, Users, Trash2 } from "lucide-react";
import { api, pagedItems } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Avatar } from "../components/ui/Avatar";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import type {
  ProjectResponse,
  TaskItemResponse,
  WorkspaceMemberResponse,
  WorkspaceResponse,
} from "../types/api";

function deriveKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 5);
  }
  return name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
}

interface ProjectWithStats extends ProjectResponse {
  total: number;
  done: number;
}

export function WorkspacePage() {
  const { t } = useTranslation();
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();

  const {
    data: workspace,
    error: wsError,
    loading: wsLoading,
  } = useApi<WorkspaceResponse>(
    () => api(`/workspaces/${workspaceId}`),
    [workspaceId],
  );

  const {
    data: projectsRaw,
    error: projError,
    loading: projLoading,
    reload,
  } = useApi<unknown>(
    () => api(`/workspaces/${workspaceId}/projects`),
    [workspaceId],
  );
  const projects = pagedItems<ProjectResponse>(projectsRaw);

  const [stats, setStats] = useState<Record<string, { total: number; done: number }>>({});

  useEffect(() => {
    if (!projects) return;
    let cancelled = false;

    Promise.all(
      projects.map(async (project) => {
        const tasksRaw = await api<unknown>(
          `/workspaces/${workspaceId}/projects/${project.id}/tasks`,
        );
        const tasks = pagedItems<TaskItemResponse>(tasksRaw);
        return [
          project.id,
          {
            total: tasks.length,
            done: tasks.filter((t) => t.status === "Done").length,
          },
        ] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) setStats(Object.fromEntries(entries));
      })
      .catch(() => {
        // stats are decorative — board still works without them
      });

    return () => {
      cancelled = true;
    };
  }, [projects, workspaceId]);

  const withStats: ProjectWithStats[] | null = useMemo(
    () =>
      projects?.map((p) => ({
        ...p,
        total: stats[p.id]?.total ?? 0,
        done: stats[p.id]?.done ?? 0,
      })) ?? null,
    [projects, stats],
  );

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    data: members,
    error: membersError,
    reload: reloadMembers,
  } = useApi<WorkspaceMemberResponse[]>(
    () => api(`/workspaces/${workspaceId}/members`),
    [workspaceId],
  );

  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const { push } = useToast();
  const [pendingDeleteWorkspace, setPendingDeleteWorkspace] = useState(false);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<ProjectResponse | null>(null);

  async function deleteWorkspace() {
    try {
      await api(`/workspaces/${workspaceId}`, { method: "DELETE" });
      push("Workspace deleted");
      navigate("/");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to delete workspace", "error");
    }
  }

  async function deleteProject(project: ProjectResponse) {
    try {
      await api(`/workspaces/${workspaceId}/projects/${project.id}`, { method: "DELETE" });
      push(`"${project.name}" archived`);
      reload();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to archive project", "error");
    }
  }

  const canManageMembers =
    workspace?.role === "Owner" || workspace?.role === "Admin";

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setInviteError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError("Enter a valid email address.");
      return;
    }

    setInviteSubmitting(true);
    try {
      await api(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      setInviteEmail("");
      setInviteRole("Member");
      setInviting(false);
      reloadMembers();
      push(`Invitation sent to ${inviteEmail.trim()}`);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite.");
    } finally {
      setInviteSubmitting(false);
    }
  }

  const autoKey = useMemo(() => key || deriveKey(name), [key, name]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Project name is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api<{ id: string }>(`/workspaces/${workspaceId}/projects`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          key: autoKey,
          description: description.trim() || null,
        }),
      });
      setName("");
      setKey("");
      setDescription("");
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("nav.allWorkspaces")}
        </Link>

        {wsLoading ? (
          <Skeleton className="h-20" />
        ) : wsError || !workspace ? (
          <ErrorAlert message={wsError ?? "Workspace not found."} />
        ) : (
          <>
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-3xl font-semibold tracking-tight">
                    {workspace.name}
                  </h1>
                  <Badge tone={workspace.role === "Member" ? "neutral" : "teal"}>
                    {workspace.role}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  /{workspace.slug}
                  {workspace.description && ` — ${workspace.description}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!creating && (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden />
                    {t("common.create")} project
                  </Button>
                )}
                {workspace.role === "Owner" && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingDeleteWorkspace(true)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </div>
            </div>

            {creating && (
              <form
                onSubmit={handleCreate}
                className="mb-8 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 rise"
                noValidate
              >
                {formError && <ErrorAlert message={formError} />}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
                  <Field label="Name" htmlFor="proj-name">
                    <Input
                      id="proj-name"
                      placeholder="Website Ban Hang"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoFocus
                    />
                  </Field>
                  <Field label="Key" htmlFor="proj-key" hint={autoKey}>
                    <Input
                      id="proj-key"
                      placeholder="WBH"
                      value={key}
                      onChange={(event) =>
                        setKey(event.target.value.toUpperCase().slice(0, 5))
                      }
                    />
                  </Field>
                </div>
                <Field label="Description" htmlFor="proj-desc">
                  <Input
                    id="proj-desc"
                    placeholder="What does this project deliver?"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creating…" : "Create project"}
                  </Button>
                  <Button variant="ghost" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {projLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-40" />
                ))}
              </div>
            ) : projError ? (
              <ErrorAlert message={projError} />
            ) : !withStats || withStats.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-8 py-16 text-center rise">
                <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FolderKanban className="size-6" aria-hidden />
                </span>
                <p className="font-display text-lg font-semibold">
                  No projects yet
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Projects hold your boards and tasks. Create the first one in
                  this workspace.
                </p>
                <Button className="mt-5" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  New project
                </Button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {withStats.map((project, index) => {
                  const percent =
                    project.total > 0
                      ? Math.round((project.done / project.total) * 100)
                      : 0;
                  return (
                    <li
                      key={project.id}
                      className="rise"
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <Link
                        to={`/workspaces/${workspaceId}/projects/${project.id}`}
                        className="group relative flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPendingDeleteProject(project);
                          }}
                          aria-label={`Archive ${project.name}`}
                          className="absolute right-2 top-2 z-10 rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <Badge tone="teal">{project.key}</Badge>
                          <Badge
                            tone={project.status === "Active" ? "teal" : "neutral"}
                          >
                            {project.status}
                          </Badge>
                        </div>
                        <h2 className="font-display font-semibold">
                          {project.name}
                        </h2>
                        {project.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {project.description}
                          </p>
                        )}
                        <div className="mt-auto pt-4">
                          <div className="mb-1.5 flex justify-between font-mono text-[11px] text-muted-foreground">
                            <span>
                              {project.done}/{project.total} done
                            </span>
                            <span>{percent}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <section className="mt-12">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {t("reports.team")}
                  </p>
                  <h2 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
                    <Users className="size-5 text-primary" aria-hidden />
                    {t("reports.team")}
                  </h2>
                </div>
                {canManageMembers && !inviting && (
                  <Button variant="outline" onClick={() => setInviting(true)}>
                    <Plus className="size-4" aria-hidden />
                    {t("common.create")}
                  </Button>
                )}
              </div>

              {inviting && (
                <form
                  onSubmit={handleInvite}
                  className="mb-4 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 rise"
                  noValidate
                >
                  {inviteError && <ErrorAlert message={inviteError} />}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_150px]">
                    <Field label="Email" htmlFor="invite-email">
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="teammate@company.dev"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        autoFocus
                      />
                    </Field>
                    <Field label="Role" htmlFor="invite-role">
                      <select
                        id="invite-role"
                        value={inviteRole}
                        onChange={(event) => setInviteRole(event.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
                      >
                        <option>Member</option>
                        <option>Admin</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={inviteSubmitting}>
                      {inviteSubmitting ? "Inviting…" : "Send invite"}
                    </Button>
                    <Button variant="ghost" onClick={() => setInviting(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {membersError ? (
                <ErrorAlert message={membersError} />
              ) : !members ? (
                <Skeleton className="h-16" />
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((member) => (
                    <li
                      key={member.userId}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <Avatar name={member.displayName || member.username} id={member.userId} size="md" />
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-medium">
                          {member.displayName || member.username}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                      <Badge tone={member.role === "Member" ? "neutral" : "teal"}>
                        {member.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {pendingDeleteWorkspace && (
        <ConfirmDialog
          title={t("task.delete") + " workspace?"}
          message={t("task.deleteConfirm")}
          onConfirm={() => {
            setPendingDeleteWorkspace(false);
            void deleteWorkspace();
          }}
          onCancel={() => setPendingDeleteWorkspace(false)}
        />
      )}

      {pendingDeleteProject && (
        <ConfirmDialog
          title={t("task.delete") + " project?"}
          message={`\"${pendingDeleteProject.name}\" will be archived and hidden from the board.`}
          onConfirm={() => {
            const project = pendingDeleteProject;
            setPendingDeleteProject(null);
            void deleteProject(project);
          }}
          onCancel={() => setPendingDeleteProject(null)}
        />
      )}
    </AppShell>
  );
}
