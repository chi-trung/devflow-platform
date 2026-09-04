import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Trash2, Play, Globe, RefreshCw } from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/ToastProvider";
import {
  api,
  createWebhook,
  deleteWebhook,
  getWebhooks,
  getDeadLetterMessages,
  replayDeadLetterMessage,
  replayAllDeadLetterMessages,
  purgeDeadLetterMessages,
  testWebhook,
} from "../lib/api";
import type { WebhookResponse, DeadLetterMessageDto } from "../types/api";
import { useApi } from "../hooks/useApi";
import type { WorkspaceResponse } from "../types/api";

const WEBHOOK_EVENTS = [
  "task.created",
  "task.updated",
  "task.deleted",
  "task.moved",
  "comment.created",
  "sprint.started",
  "sprint.completed",
] as const;

export function WebhooksPage() {
  const { t } = useTranslation();
  const { push } = useToast();
  const { workspaceId = "" } = useParams();
  const [webhooks, setWebhooks] = useState<WebhookResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WebhookResponse | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState("");

  const { data: workspace } = useApi<WorkspaceResponse>(
    () => api(`/workspaces/${workspaceId}`),
    [workspaceId],
  );
  const isAdmin = workspace?.role === "Owner" || workspace?.role === "Admin";

  const [deadLetters, setDeadLetters] = useState<DeadLetterMessageDto[]>([]);
  const [dlqLoading, setDlqLoading] = useState(false);
  const [dlqError, setDlqError] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [replayingAll, setReplayingAll] = useState(false);
  const [purging, setPurging] = useState(false);
  const [pendingPurge, setPendingPurge] = useState(false);

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWebhooks(workspaceId);
      setWebhooks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("webhook.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, t]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  function resetForm() {
    setUrl("");
    setSelectedEvents([]);
    setSecret("");
    setCreating(false);
  }

  function toggleEvent(event: string) {
    setSelectedEvents((current) =>
      current.includes(event)
        ? current.filter((e) => e !== event)
        : [...current, event],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || selectedEvents.length === 0) return;
    setSaving(true);
    try {
      await createWebhook(workspaceId, {
        url: url.trim(),
        events: selectedEvents,
        secret: secret.trim() || undefined,
      });
      resetForm();
      loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("webhook.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(webhookId: string) {
    setTestingId(webhookId);
    try {
      await testWebhook(workspaceId, webhookId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("webhook.testFailed"));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete() {
    const webhook = pendingDelete;
    if (!webhook) return;
    try {
      await deleteWebhook(workspaceId, webhook.id);
      setPendingDelete(null);
      loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("webhook.deleteFailed"));
    }
  }

  async function loadDeadLetters() {
    setDlqLoading(true);
    setDlqError(null);
    try {
      const data = await getDeadLetterMessages(workspaceId);
      setDeadLetters(data);
    } catch (err) {
      setDlqError(err instanceof Error ? err.message : t("outbox.dlqLoadFailed"));
    } finally {
      setDlqLoading(false);
    }
  }

  async function handleReplay(messageId: string) {
    setReplayingId(messageId);
    try {
      await replayDeadLetterMessage(workspaceId, messageId);
      push(t("outbox.replaySuccess"));
      loadDeadLetters();
    } catch {
      push(t("outbox.replayFailed"), "error");
    } finally {
      setReplayingId(null);
    }
  }

  async function handleReplayAll() {
    setReplayingAll(true);
    try {
      const result = await replayAllDeadLetterMessages(workspaceId);
      push(t("outbox.replayAllSuccess", { count: result.requeued }));
      loadDeadLetters();
    } catch {
      push(t("outbox.replayAllFailed"), "error");
    } finally {
      setReplayingAll(false);
    }
  }

  async function handlePurge() {
    setPurging(true);
    try {
      await purgeDeadLetterMessages(workspaceId);
      push(t("outbox.purgeSuccess"));
      setDeadLetters([]);
    } catch {
      push(t("outbox.purgeFailed"), "error");
    } finally {
      setPurging(false);
      setPendingPurge(false);
    }
  }

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            to={`/workspaces/${workspaceId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("webhook.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("webhook.description")}
              </p>
            </div>
            {!creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                {t("webhook.create")}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        {creating && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="mb-4 font-display text-lg font-semibold">
              {t("webhook.createTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  {t("webhook.urlLabel")}
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  {t("webhook.eventsLabel")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <button
                      key={event}
                      type="button"
                      onClick={() => toggleEvent(event)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors duration-150 ${
                        selectedEvents.includes(event)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-border-strong"
                      }`}
                    >
                      {event}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  {t("webhook.secretLabel")}
                </label>
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={t("webhook.secretPlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={saving || !url.trim() || selectedEvents.length === 0}>
                {saving ? t("common.saving") : t("common.create")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                disabled={saving}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <EmptyState
            icon={<Globe className="size-8 text-muted-foreground" aria-hidden />}
            title={t("webhook.emptyTitle")}
            description={t("webhook.emptyDescription")}
            action={
              !creating && (
                <Button className="mt-2" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("webhook.create")}
                </Button>
              )
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {webhooks.map((webhook) => (
              <li
                key={webhook.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong"
              >
                <Globe className="size-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{webhook.url}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex flex-wrap gap-1">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="rounded-md bg-elevated px-1.5 py-0.5 font-mono"
                        >
                          {event}
                        </span>
                      ))}
                    </span>
                    <span>• {formatDate(webhook.createdAtUtc)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleTest(webhook.id)}
                    disabled={testingId === webhook.id}
                    className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-50"
                    title={t("webhook.test")}
                    aria-label={t("webhook.test")}
                  >
                    <Play className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(webhook)}
                    className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                    title={t("webhook.delete")}
                    aria-label={t("webhook.delete")}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {isAdmin && (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  {t("outbox.dlqTitle")}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("outbox.dlqDescription")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={loadDeadLetters}
                  disabled={dlqLoading}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  {t("common.refresh")}
                </Button>
                {deadLetters.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleReplayAll}
                      disabled={replayingAll}
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      {replayingAll ? t("outbox.replaying") : t("outbox.replayAll")}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setPendingPurge(true)}
                      disabled={purging}
                    >
                      {t("outbox.purge")}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {dlqError && (
              <div className="mb-4">
                <div className="rounded-xl border border-border bg-surface p-4 text-sm text-destructive">
                  {dlqError}
                </div>
              </div>
            )}

            {dlqLoading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : deadLetters.length === 0 ? (
              <EmptyState
                icon={<Globe className="size-8 text-muted-foreground" aria-hidden />}
                title={t("outbox.dlqEmpty")}
                description={t("outbox.dlqEmptyDescription")}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {deadLetters.map((msg) => (
                  <li
                    key={msg.id}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong"
                  >
                    <Globe className="size-4 text-muted-foreground shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {msg.type}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{msg.retryCount} {t("outbox.retryCount")}</span>
                        <span>• {formatDate(msg.occurredAtUtc)}</span>
                        <span>• {formatDate(msg.failedPermanentlyAt)}</span>
                      </div>
                      {msg.error && (
                        <p
                          className="mt-1 truncate text-xs text-destructive"
                          title={msg.error}
                        >
                          {msg.error}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleReplay(msg.id)}
                        disabled={replayingId === msg.id}
                      >
                        <RefreshCw className="size-3.5" aria-hidden />
                        {replayingId === msg.id
                          ? t("outbox.replaying")
                          : t("outbox.replay")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {pendingDelete && (
          <ConfirmDialog
            title={t("webhook.deleteTitle")}
            message={t("webhook.deleteMessage", { name: pendingDelete.url })}
            confirmLabel={t("webhook.deleteConfirm")}
            onConfirm={handleDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}

        {pendingPurge && (
          <ConfirmDialog
            title={t("outbox.purge")}
            message={t("outbox.purgeConfirm")}
            confirmLabel={t("outbox.purge")}
            onConfirm={handlePurge}
            onCancel={() => setPendingPurge(false)}
          />
        )}
      </div>
    </AppShell>
  );
}
