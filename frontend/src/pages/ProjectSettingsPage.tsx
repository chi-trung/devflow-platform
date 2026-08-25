import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, X, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/ToastProvider";
import {
  api,
  getProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from "../lib/api";
import type { ProjectMemberResponse, WorkspaceMemberResponse, WorkspaceResponse } from "../types/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";

export function ProjectSettingsPage() {
  const { t } = useTranslation();
  const { push } = useToast();
  const { workspaceId = "", projectId = "" } = useParams();
  const { currentUser } = useAuth();

  const { data: workspace } = useApi<WorkspaceResponse>(
    () => api(`/workspaces/${workspaceId}`),
    [workspaceId],
  );

  const [members, setMembers] = useState<ProjectMemberResponse[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberResponse[]>([]);
  const [workspaceMembersLoading, setWorkspaceMembersLoading] = useState(true);

  const [inviting, setInviting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"Member" | "Manager">("Member");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [changingRoleMemberId, setChangingRoleMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<ProjectMemberResponse | null>(null);

  const canManage = useMemo(() => {
    return workspace?.role === "Owner" || workspace?.role === "Admin";
  }, [workspace?.role]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const data = await getProjectMembers(workspaceId, projectId);
      setMembers(data);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : t("projectMember.loadFailed", { defaultValue: "Failed to load members" }));
    } finally {
      setMembersLoading(false);
    }
  }, [workspaceId, projectId, t]);

  const loadWorkspaceMembers = useCallback(async () => {
    setWorkspaceMembersLoading(true);
    try {
      const data = await api<WorkspaceMemberResponse[]>(`/workspaces/${workspaceId}/members`);
      setWorkspaceMembers(data);
    } catch {
      // non-blocking
    } finally {
      setWorkspaceMembersLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadMembers();
    loadWorkspaceMembers();
  }, [loadMembers, loadWorkspaceMembers]);

  const availableWorkspaceMembers = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.userId));
    return workspaceMembers.filter((wm) => !memberIds.has(wm.userId));
  }, [workspaceMembers, members]);

  async function handleAddMember(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUserId) return;
    setInviteSubmitting(true);
    try {
      await addProjectMember(workspaceId, projectId, selectedUserId, selectedRole);
      push(t("projectMember.addSuccess"));
      setSelectedUserId("");
      setSelectedRole("Member");
      setInviting(false);
      loadMembers();
    } catch {
      push(t("projectMember.addFailed"), "error");
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleRoleChange(member: ProjectMemberResponse, newRole: "Member" | "Manager") {
    if (member.role === newRole) return;
    setChangingRoleMemberId(member.userId);
    try {
      await updateProjectMemberRole(workspaceId, projectId, member.userId, newRole);
      setMembers((current) =>
        current.map((m) => (m.userId === member.userId ? { ...m, role: newRole } : m)),
      );
    } catch {
      push(t("projectMember.removeFailed", { defaultValue: "Failed to update role" }), "error");
    } finally {
      setChangingRoleMemberId(null);
    }
  }

  function handleRequestRemove(member: ProjectMemberResponse) {
    if (member.userId === currentUser?.id) {
      push(t("projectMember.cannotRemoveSelf"), "error");
      return;
    }
    setPendingRemove(member);
  }

  async function handleConfirmRemove() {
    const member = pendingRemove;
    if (!member) return;
    setRemovingMemberId(member.userId);
    try {
      await removeProjectMember(workspaceId, projectId, member.userId);
      setMembers((current) => current.filter((m) => m.userId !== member.userId));
      push(t("projectMember.removeSuccess", { name: member.displayName || member.username }));
      setPendingRemove(null);
    } catch {
      push(t("projectMember.removeFailed"), "error");
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            to={`/workspaces/${workspaceId}/projects/${projectId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("projectMember.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("projectMember.description")}
              </p>
            </div>
            {canManage && !inviting && (
              <Button variant="outline" onClick={() => setInviting(true)} disabled={availableWorkspaceMembers.length === 0}>
                <Plus className="size-4" aria-hidden />
                {t("common.create")}
              </Button>
            )}
          </div>
        </div>

        {inviting && (
          <form
            onSubmit={handleAddMember}
            className="mb-4 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 rise"
            noValidate
          >
            <h2 className="font-display text-lg font-semibold">
              {t("projectMember.addTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_150px]">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("projectMember.addLabel")}
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
                  disabled={workspaceMembersLoading || availableWorkspaceMembers.length === 0}
                >
                  <option value="">
                    {t("projectMember.addPlaceholder")}
                  </option>
                  {availableWorkspaceMembers.map((wm) => (
                    <option key={wm.userId} value={wm.userId}>
                      {wm.displayName || wm.username} ({wm.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("projectMember.roleLabel")}
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as "Member" | "Manager")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
                >
                  <option value="Member">{t("projectMember.member")}</option>
                  <option value="Manager">{t("projectMember.manager")}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={inviteSubmitting || !selectedUserId}>
                {inviteSubmitting ? t("common.saving") : t("common.create")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setInviting(false);
                  setSelectedUserId("");
                }}
                disabled={inviteSubmitting}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        )}

        {membersError ? (
          <div className="mb-4">
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-destructive">
              {membersError}
            </div>
          </div>
        ) : membersLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8 text-muted-foreground" aria-hidden />}
            title={t("projectMember.empty")}
            description={t("projectMember.description")}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => {
              const isSelf = member.userId === currentUser?.id;
              const isChangingRole = changingRoleMemberId === member.userId;
              const isRemoving = removingMemberId === member.userId;
              return (
                <li
                  key={member.userId}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-elevated text-sm font-medium">
                      {(member.displayName || member.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-medium">
                        {member.displayName || member.username}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{member.username}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        disabled={isChangingRole || isSelf}
                        onChange={(e) => handleRoleChange(member, e.target.value as "Member" | "Manager")}
                        className="flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none disabled:opacity-50"
                        aria-label={t("projectMember.roleLabel")}
                      >
                        <option value="Member">{t("projectMember.member")}</option>
                        <option value="Manager">{t("projectMember.manager")}</option>
                      </select>
                      <button
                        type="button"
                        disabled={isRemoving || isSelf}
                        onClick={() => handleRequestRemove(member)}
                        aria-label={t("projectMember.removeAria", {
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

        {pendingRemove && (
          <ConfirmDialog
            title={t("projectMember.removeTitle")}
            message={t("projectMember.removeConfirm", {
              name: pendingRemove.displayName || pendingRemove.username,
            })}
            confirmLabel={t("common.delete")}
            onConfirm={handleConfirmRemove}
            onCancel={() => setPendingRemove(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
