import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, FolderKanban, Users, Trash2, X, RotateCcw, Pencil } from "lucide-react";
import { api, pagedItems, removeWorkspaceMember, updateMemberRole, restoreProject as restoreProjectApi, updateProject, updateWorkspace } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Dialog } from "../components/ui/Dialog";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Avatar } from "../components/ui/Avatar";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { useAuth } from "../auth/AuthContext";
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
  const { currentUser } = useAuth();

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
  const projects = useMemo(
    () => pagedItems<ProjectResponse>(projectsRaw),
    [projectsRaw],
  );

  const [stats, setStats] = useState<Record<string, { total: number; done: number }>>({});

  useEffect(() => {
    if (!projectsRaw) return;
    const projectList = pagedItems<ProjectResponse>(projectsRaw);
    if (projectList.length === 0) {
      setStats({});
      return;
    }
    let cancelled = false;

    Promise.all(
      projectList.map(async (project) => {
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
  }, [projectsRaw, workspaceId]);

  const withStats: ProjectWithStats[] | null = useMemo(
    () =>
      projects?.map((p) => ({
        ...p,
        total: stats[p.id]?.total ?? 0,
        done: stats[p.id]?.done ?? 0,
      })) ?? null,
    [projects, stats],
  );

  const activeProjects = useMemo(
    () => withStats?.filter((p) => p.status === "Active") ?? null,
    [withStats],
  );

  const archivedProjects = useMemo(
    () => withStats?.filter((p) => p.status === "Archived") ?? null,
    [withStats],
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
  const [pendingRemoveMember, setPendingRemoveMember] = useState<WorkspaceMemberResponse | null>(null);
  const [changingRoleMemberId, setChangingRoleMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [restoringProjectId, setRestoringProjectId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [wsEditName, setWsEditName] = useState("");
  const [wsEditDesc, setWsEditDesc] = useState("");
  const [wsEditSubmitting, setWsEditSubmitting] = useState(false);
  const [wsEditError, setWsEditError] = useState<string | null>(null);

  const currentUserId = currentUser?.id;

  async function deleteWorkspace() {
    try {
      await api(`/workspaces/${workspaceId}`, { method: "DELETE" });
      push(t("workspace.deleted"));
      navigate("/");
    } catch (err) {
      push(err instanceof Error ? err.message : t("workspace.deleteFailed"), "error");
    }
  }

  async function deleteProject(project: ProjectResponse) {
    try {
      await api(`/workspaces/${workspaceId}/projects/${project.id}`, { method: "DELETE" });
      push(t("workspace.archivedNamed", { name: project.name }));
      reload();
    } catch (err) {
      push(err instanceof Error ? err.message : t("workspace.archiveFailed"), "error");
    }
  }

  async function restoreProject(project: ProjectResponse) {
    setRestoringProjectId(project.id);
    try {
      await restoreProjectApi(workspaceId, project.id);
      push(t("workspace.restoredNamed", { name: project.name }));
      reload();
    } catch (err) {
      push(err instanceof Error ? err.message : t("workspace.restoreFailed"), "error");
    } finally {
      setRestoringProjectId(null);
    }
  }

  function openEditProject(project: ProjectResponse) {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description ?? "");
    setEditError(null);
  }

  async function saveEditProject() {
    if (!editingProject) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await updateProject(workspaceId, editingProject.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      push(t("workspace.updatedNamed", { name: editName.trim() }));
      setEditingProject(null);
      reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t("workspace.editFailed"));
    } finally {
      setEditSubmitting(false);
    }
  }

  const canManageMembers =
    workspace?.role === "Owner" || workspace?.role === "Admin";

  const canManageProjects =
    workspace?.role === "Owner" || workspace?.role === "Admin";

  function openEditWorkspace() {
    if (!workspace) return;
    setEditingWorkspace(true);
    setWsEditName(workspace.name);
    setWsEditDesc(workspace.description ?? "");
    setWsEditError(null);
  }

  async function saveEditWorkspace() {
    setWsEditSubmitting(true);
    setWsEditError(null);
    try {
      await updateWorkspace(workspaceId, {
        name: wsEditName.trim(),
        description: wsEditDesc.trim() || null,
      });
      push(t("workspace.updatedNamed", { name: wsEditName.trim() }));
      setEditingWorkspace(false);
      reload();
    } catch (err) {
      setWsEditError(err instanceof Error ? err.message : t("workspace.editFailed"));
    } finally {
      setWsEditSubmitting(false);
    }
  }

  async function handleRemoveMember(member: WorkspaceMemberResponse) {
    if (member.userId === currentUserId) {
      push(t("workspace.cannotRemoveSelf"), "error");
      return;
    }
    setPendingRemoveMember(member);
  }

  async function confirmRemoveMember() {
    const member = pendingRemoveMember;
    if (!member) return;
    setRemovingMemberId(member.userId);
    try {
      await removeWorkspaceMember(workspaceId, member.userId);
      push(
        t("workspace.removeMemberSuccess", {
          name: member.displayName || member.username,
        }),
      );
      setPendingRemoveMember(null);
      reloadMembers();
    } catch (err) {
      push(
        err instanceof Error ? err.message : t("workspace.removeMemberFailed"),
        "error",
      );
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleRoleChange(
    member: WorkspaceMemberResponse,
    newRole: string,
  ) {
    if (member.userId === currentUserId) {
      push(t("workspace.cannotChangeOwnRole"), "error");
      return;
    }
    if (newRole === member.role) return;
    setChangingRoleMemberId(member.userId);
    try {
      await updateMemberRole(
        workspaceId,
        member.userId,
        newRole as "Owner" | "Admin" | "Member",
      );
      push(
        t("workspace.roleChangedSuccess", {
          name: member.displayName || member.username,
          role: newRole,
        }),
      );
      reloadMembers();
    } catch (err) {
      push(
        err instanceof Error ? err.message : t("workspace.roleChangeFailed"),
        "error",
      );
    } finally {
      setChangingRoleMemberId(null);
    }
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setInviteError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError(t("workspace.inviteInvalidEmail"));
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
      push(t("workspace.inviteSentTo", { email: inviteEmail.trim() }));
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : t("workspace.inviteFailed"));
    } finally {
      setInviteSubmitting(false);
    }
  }

  const autoKey = useMemo(() => key || deriveKey(name), [key, name]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError(t("workspace.projectNameRequired"));
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
      setFormError(err instanceof Error ? err.message : t("workspace.createFailed"));
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
          <ErrorAlert message={wsError ?? t("workspace.notFound")} />
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
                  {canManageProjects && (
                    <button
                      type="button"
                      onClick={openEditWorkspace}
                      aria-label={t("workspace.editNamedAria", { name: workspace.name })}
                      className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-primary"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  )}
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
                  {t("workspace.createProject")}
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
                  <Field label={t("workspace.projName")} htmlFor="proj-name">
                    <Input
                      id="proj-name"
                      placeholder="Website Ban Hang"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoFocus
                    />
                  </Field>
                  <Field label={t("workspace.projKey")} htmlFor="proj-key" hint={autoKey}>
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
                <Field label={t("workspace.projDescription")} htmlFor="proj-desc">
                  <Input
                    id="proj-desc"
                    placeholder={t("workspace.projDescPlaceholder")}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting
                      ? t("workspace.creatingProject")
                      : t("workspace.createProjectBtn")}
                  </Button>
                  <Button variant="ghost" onClick={() => setCreating(false)}>
                    {t("common.cancel")}
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
              <div className="rise">
                <EmptyState
                  icon={<FolderKanban className="size-8 text-primary" aria-hidden />}
                  title={t("workspace.noProjectsYet")}
                  description={t("workspace.noProjectsDesc")}
                  action={
                    <Button className="mt-3" onClick={() => setCreating(true)}>
                      <Plus className="size-4" aria-hidden />
                      {t("workspace.newProject")}
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                {activeProjects && activeProjects.length > 0 && (
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {activeProjects.map((project, index) => {
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
                            {canManageProjects && (
                              <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openEditProject(project);
                                  }}
                                  aria-label={t("workspace.editNamedAria", {
                                    name: project.name,
                                  })}
                                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-primary group-hover:opacity-100"
                                >
                                  <Pencil className="size-3.5" aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPendingDeleteProject(project);
                                  }}
                                  aria-label={t("workspace.archiveNamedAria", {
                                    name: project.name,
                                  })}
                                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-destructive group-hover:opacity-100"
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                </button>
                              </div>
                            )}
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
                                  {t("workspace.progressDone", {
                                    done: project.done,
                                    total: project.total,
                                  })}
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

                {archivedProjects && archivedProjects.length > 0 && (
                  <section className="mt-10">
                    <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">
                      {t("workspace.archivedProjects")}
                    </h2>
                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {archivedProjects.map((project, index) => {
                        return (
                          <li
                            key={project.id}
                            className="rise"
                            style={{ animationDelay: `${index * 60}ms` }}
                          >
                            <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5 opacity-75">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <Badge tone="neutral">{project.key}</Badge>
                                <Badge tone="neutral">{project.status}</Badge>
                              </div>
                              <h2 className="font-display font-semibold">
                                {project.name}
                              </h2>
                              {project.description && (
                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                  {project.description}
                                </p>
                              )}
                              {canManageProjects && (
                                <div className="mt-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void restoreProject(project)}
                                    disabled={restoringProjectId === project.id}
                                    className="w-full"
                                  >
                                    <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
                                    {restoringProjectId === project.id
                                      ? t("workspace.restoring")
                                      : t("workspace.restore")}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </>
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
                    <Field label={t("workspace.emailLabel")} htmlFor="invite-email">
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="teammate@company.dev"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        autoFocus
                      />
                    </Field>
                    <Field label={t("workspace.roleLabel")} htmlFor="invite-role">
                      <select
                        id="invite-role"
                        value={inviteRole}
                        onChange={(event) => setInviteRole(event.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
                      >
                        <option value="Member">{t("common.member")}</option>
                        <option value="Admin">{t("common.admin")}</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={inviteSubmitting}>
                      {inviteSubmitting
                        ? t("workspace.inviting")
                        : t("workspace.sendInvite")}
                    </Button>
                    <Button variant="ghost" onClick={() => setInviting(false)}>
                      {t("common.cancel")}
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
                  {members.map((member) => {
                    const isSelf = member.userId === currentUserId;
                    const isChangingRole = changingRoleMemberId === member.userId;
                    const isRemoving = removingMemberId === member.userId;
                    return (
                      <li
                        key={member.userId}
                        className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
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
                        </div>
                        {canManageMembers && (
                          <div className="flex items-center gap-2">
                            <select
                              value={member.role}
                              disabled={isChangingRole || isSelf}
                              onChange={(e) => handleRoleChange(member, e.target.value)}
                              className="flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none disabled:opacity-50"
                              aria-label={t("workspace.roleLabel")}
                            >
                              <option value="Member">{t("common.member")}</option>
                              <option value="Admin">{t("common.admin")}</option>
                              <option value="Owner">{t("common.owner")}</option>
                            </select>
                            <button
                              type="button"
                              disabled={isRemoving || isSelf}
                              onClick={() => handleRemoveMember(member)}
                              aria-label={t("workspace.removeMemberNamedAria", {
                                name: member.displayName || member.username,
                              })}
                              className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            >
                              <X className="size-4" aria-hidden />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {pendingDeleteWorkspace && (
        <ConfirmDialog
          title={t("workspace.deleteWorkspaceTitle")}
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
          title={t("workspace.archiveProjectTitle")}
          message={t("workspace.archiveProjectMsg", {
            name: pendingDeleteProject.name,
          })}
          onConfirm={() => {
            const project = pendingDeleteProject;
            setPendingDeleteProject(null);
            void deleteProject(project);
          }}
          onCancel={() => setPendingDeleteProject(null)}
        />
      )}

      {pendingRemoveMember && (
        <ConfirmDialog
          title={t("workspace.removeMemberTitle")}
          message={t("workspace.removeMemberConfirm", {
            name: pendingRemoveMember.displayName || pendingRemoveMember.username,
          })}
          confirmLabel={t("common.delete")}
          onConfirm={() => void confirmRemoveMember()}
          onCancel={() => setPendingRemoveMember(null)}
        />
      )}

      {editingProject && (
        <Dialog
          open
          onClose={() => setEditingProject(null)}
          title={t("workspace.editProject")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditingProject(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void saveEditProject()} disabled={editSubmitting}>
                {editSubmitting ? t("workspace.saving") : t("workspace.save")}
              </Button>
            </>
          }
        >
          {editError && (
            <div className="mb-3">
              <ErrorAlert message={editError} />
            </div>
          )}
          <Field label={t("workspace.projectName")} htmlFor="edit-proj-name">
            <Input
              id="edit-proj-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="mt-3">
            <Field label={t("workspace.projectDescription")} htmlFor="edit-proj-desc">
              <Input
                id="edit-proj-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </Field>
          </div>
        </Dialog>
      )}

      {editingWorkspace && (
        <Dialog
          open
          onClose={() => setEditingWorkspace(false)}
          title={t("workspace.editWorkspaceTitle")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditingWorkspace(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void saveEditWorkspace()} disabled={wsEditSubmitting}>
                {wsEditSubmitting ? t("workspace.saving") : t("workspace.save")}
              </Button>
            </>
          }
        >
          {wsEditError && (
            <div className="mb-3">
              <ErrorAlert message={wsEditError} />
            </div>
          )}
          <Field label={t("workspace.wsNameLabel")} htmlFor="edit-ws-name">
            <Input
              id="edit-ws-name"
              value={wsEditName}
              onChange={(e) => setWsEditName(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="mt-3">
            <Field label={t("workspace.wsDescriptionLabel")} htmlFor="edit-ws-desc">
              <Input
                id="edit-ws-desc"
                value={wsEditDesc}
                onChange={(e) => setWsEditDesc(e.target.value)}
              />
            </Field>
          </div>
        </Dialog>
      )}
    </AppShell>
  );
}
