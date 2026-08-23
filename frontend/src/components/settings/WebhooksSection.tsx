import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cable, Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import {
  api,
  createWebhook,
  deleteWebhook,
  getWebhook,
  getWebhooks,
  pagedItems,
} from "../../lib/api";
import type { WebhookResponse, WorkspaceResponse } from "../../types/api";
import { useToast } from "../ui/ToastProvider";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ConfirmDialog";

const WEBHOOK_EVENTS = [
  { value: "task.created", labelKey: "webhooks.eventTaskCreated" },
  { value: "task.updated", labelKey: "webhooks.eventTaskUpdated" },
  { value: "task.completed", labelKey: "webhooks.eventTaskCompleted" },
  { value: "comment.created", labelKey: "webhooks.eventCommentAdded" },
];

export function WebhooksSection() {
  const { t } = useTranslation();
  const { push } = useToast();

  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string>("");

  const [webhooks, setWebhooks] = useState<WebhookResponse[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);

  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    () => new Set(["task.created"]),
  );
  const [submitting, setSubmitting] = useState(false);

  const [revealedSecrets, setRevealedSecrets] = useState<
    Record<string, string>
  >({});
  const [pendingDelete, setPendingDelete] = useState<WebhookResponse | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void api("/workspaces")
      .then((raw) => {
        if (!cancelled) {
          setWorkspaces(pagedItems<WorkspaceResponse>(raw));
        }
      })
      .catch(() => {
        if (!cancelled) setWorkspaces([]);
      })
      .finally(() => {
        if (!cancelled) setWorkspacesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setWebhooksLoading(true);
    getWebhooks(workspaceId)
      .then((list) => {
        if (!cancelled) setWebhooks(list);
      })
      .catch(() => {
        if (!cancelled) setWebhooks([]);
      })
      .finally(() => {
        if (!cancelled) setWebhooksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function toggleEvent(value: string) {
    setSelectedEvents((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  async function handleCreate() {
    if (!workspaceId) return;
    if (!/^https?:\/\//i.test(url.trim())) {
      push(t("webhooks.invalidUrl"), "error");
      return;
    }
    if (selectedEvents.size === 0) {
      push(t("webhooks.pickEvent"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createWebhook(workspaceId, {
        url: url.trim(),
        events: [...selectedEvents],
        secret: secret.trim() || undefined,
      });
      setWebhooks((current) => [created, ...current]);
      setUrl("");
      setSecret("");
      setSelectedEvents(new Set(["task.created"]));
      push(t("webhooks.registered"));
    } catch (err) {
      push(err instanceof Error ? err.message : t("webhooks.registerFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevealSecret(webhook: WebhookResponse) {
    if (!workspaceId) return;
    if (revealedSecrets[webhook.id]) {
      setRevealedSecrets(({ [webhook.id]: _, ...rest }) => rest);
      return;
    }
    try {
      const full = await getWebhook(workspaceId, webhook.id);
      setRevealedSecrets((current) => ({
        ...current,
        [webhook.id]: full.secret ?? "",
      }));
    } catch {
      push(t("webhooks.secretLoadFailed"), "error");
    }
  }

  async function handleCopySecret(webhookId: string) {
    try {
      await navigator.clipboard.writeText(revealedSecrets[webhookId]);
      push(t("webhooks.secretCopied"));
    } catch {
      push(t("webhooks.clipboardUnavailable"), "error");
    }
  }

  async function handleConfirmDelete() {
    if (!workspaceId || !pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteWebhook(workspaceId, target.id);
      setWebhooks((current) => current.filter((w) => w.id !== target.id));
      push(t("webhooks.removed"));
    } catch {
      push(t("webhooks.removeFailed"), "error");
    }
  }

  return (
    <section
      aria-label={t("webhooks.title")}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Cable className="size-4" aria-hidden />
        </span>
        <h2 className="font-display font-semibold">{t("webhooks.title")}</h2>
      </div>

      {workspacesLoading ? (
        <div className="skeleton h-10 w-full" />
      ) : workspaces.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("webhooks.createWorkspaceFirst")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="webhook-workspace">
              {t("webhooks.workspaceLabel")}
            </label>
            <select
              id="webhook-workspace"
              value={workspaceId}
              onChange={(event) => {
                setWorkspaceId(event.target.value);
                setRevealedSecrets({});
              }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            >
              {!workspaceId && <option value="">{t("webhooks.selectWorkspace")}</option>}
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5">
            <input
              type="url"
              inputMode="url"
              placeholder="https://example.com/hooks/devflow"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
            />
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <button
                  key={event.value}
                  type="button"
                  onClick={() => toggleEvent(event.value)}
                  aria-pressed={selectedEvents.has(event.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    selectedEvents.has(event.value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {t(event.labelKey)}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder={t("webhooks.secretPlaceholder")}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
            />
            <Button onClick={() => void handleCreate()} disabled={submitting}>
              {submitting ? t("webhooks.registering") : t("webhooks.addWebhook")}
            </Button>
          </div>

          <div className="mt-4 flex flex-col divide-y divide-border/60">
            {webhooksLoading && webhooks.length === 0 ? (
              <div className="space-y-2 pt-3">
                {[0, 1].map((index) => (
                  <div key={index} className="skeleton h-12 w-full" />
                ))}
              </div>
            ) : webhooks.length === 0 && workspaceId ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("webhooks.noWebhooks")}
              </p>
            ) : (
              webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex flex-col gap-1.5 py-3 first:pt-3 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-mono text-xs text-foreground">
                      {webhook.url}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={t("webhooks.toggleSecret")}
                        onClick={() => void handleRevealSecret(webhook)}
                        className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                      >
                        {revealedSecrets[webhook.id] !== undefined ? (
                          <EyeOff className="size-3.5" aria-hidden />
                        ) : (
                          <Eye className="size-3.5" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={t("webhooks.removeWebhookAria")}
                        onClick={() => setPendingDelete(webhook)}
                        className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                  {revealedSecrets[webhook.id] !== undefined && (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-2.5 py-1.5">
                      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                        {revealedSecrets[webhook.id] || t("webhooks.noSecretSet")}
                      </code>
                      {revealedSecrets[webhook.id] && (
                        <button
                          type="button"
                          aria-label={t("webhooks.copySecret")}
                          onClick={() => void handleCopySecret(webhook.id)}
                          className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                        >
                          <Copy className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <p className="mt-3 font-mono text-[10px] text-muted-foreground">
            {t("webhooks.hmacHint")}
          </p>
        </>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={t("webhooks.removeTitle")}
          message={t("webhooks.removeMsg", { url: pendingDelete.url })}
          confirmLabel={t("webhooks.removeConfirm")}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}
