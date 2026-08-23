import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Key, Plus, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ConfirmDialog";
import {
  createPat,
  deletePat,
  listPats,
} from "../../lib/api";
import type { PatResponse } from "../../types/api";
import { useToast } from "../ui/ToastProvider";

const PAT_SCOPES = [
  { value: "read", labelKey: "pat.scopeReadTasks" },
  { value: "write", labelKey: "pat.scopeWriteTasks" },
  { value: "tasks", labelKey: "pat.scopeWriteTasks" },
  { value: "admin", labelKey: "pat.scopeAdminWorkspace" },
] as const;

export function PATSection() {
  const { t } = useTranslation();
  const { push } = useToast();

  const [pats, setPats] = useState<PatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<Set<string>>(
    () => new Set(["read"]),
  );
  const [newExpires, setNewExpires] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PatResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listPats()
      .then((items) => {
        if (!cancelled) setPats(items);
      })
      .catch(() => {
        if (!cancelled) setPats([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleScope(value: string) {
    setNewScopes((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function handleCreate() {
    if (!newName.trim()) {
      push(t("pat.nameRequired"), "error");
      return;
    }
    if (newScopes.size === 0) {
      push(t("pat.scopeRequired"), "error");
      return;
    }
    if (!newExpires) {
      push(t("pat.expiryRequired"), "error");
      return;
    }

    setCreating(true);
    try {
      const created = await createPat(newName.trim(), [...newScopes], newExpires);
      setCreatedToken(created.token);
      setPats((current) => [
        {
          id: created.id,
          name: newName.trim(),
          scopes: [...newScopes],
          expiresAtUtc: newExpires,
          createdAtUtc: new Date().toISOString(),
          lastUsedAtUtc: null,
        },
        ...current,
      ]);
      setNewName("");
      setNewScopes(new Set(["read"]));
      setNewExpires("");
      setShowCreate(false);
    } catch (err) {
      push(err instanceof Error ? err.message : t("pat.createFailed"), "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deletePat(target.id);
      setPats((current) => current.filter((item) => item.id !== target.id));
      push(t("pat.revoked"));
    } catch {
      push(t("pat.revokeFailed"), "error");
    }
  }

  function formatDate(iso: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  return (
    <section aria-label={t("pat.title")} className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Key className="size-4" aria-hidden />
          </span>
          <h2 className="font-display font-semibold">{t("pat.title")}</h2>
        </div>
        <Button variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" aria-hidden />
          {t("pat.generate")}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 pt-3">
          {[0, 1].map((index) => (
            <div key={index} className="skeleton h-12 w-full" />
          ))}
        </div>
      ) : pats.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("pat.none")}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {pats.map((pat) => (
            <div
              key={pat.id}
              className="flex flex-col gap-1.5 py-3 first:pt-3 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{pat.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {pat.scopes.join(", ")}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("pat.revoke")}
                  title={t("pat.revoke")}
                  onClick={() => setPendingDelete(pat)}
                  className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>{t("pat.expires")}: {formatDate(pat.expiresAtUtc)}</span>
                <span>{t("pat.created")}: {formatDate(pat.createdAtUtc)}</span>
                <span>{t("pat.lastUsed")}: {formatDate(pat.lastUsedAtUtc ?? "")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">{t("pat.createTitle")}</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="pat-name">
                  {t("pat.nameLabel")}
                </label>
                <input
                  id="pat-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  placeholder={t("pat.namePlaceholder")}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">{t("pat.scopesLabel")}</p>
                <div className="flex flex-wrap gap-2">
                  {PAT_SCOPES.map((scope) => (
                    <button
                      key={scope.value}
                      type="button"
                      onClick={() => toggleScope(scope.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                        newScopes.has(scope.value)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-border-strong"
                      }`}
                    >
                      {t(scope.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="pat-expires">
                  {t("pat.expiryLabel")}
                </label>
                <input
                  id="pat-expires"
                  type="date"
                  value={newExpires}
                  onChange={(e) => setNewExpires(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void handleCreate()} disabled={creating}>
                {creating ? t("common.saving") : t("pat.generate")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {createdToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <h3 className="font-display font-semibold">{t("pat.createdTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("pat.createdHint")}</p>
            <code className="mt-3 block break-all rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground">
              {createdToken}
            </code>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(createdToken);
                  push(t("pat.copied"));
                }}
              >
                {t("pat.copy")}
              </Button>
              <Button variant="ghost" onClick={() => setCreatedToken(null)}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={t("pat.revokeTitle")}
          message={t("pat.revokeMsg", { name: pendingDelete.name })}
          confirmLabel={t("pat.revoke")}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}
