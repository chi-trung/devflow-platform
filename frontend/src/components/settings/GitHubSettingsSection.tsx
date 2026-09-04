import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, ShieldCheck } from "lucide-react";
import {
  API_BASE,
  getGitHubIntegration,
  updateGitHubWebhookSecret,
} from "../../lib/api";
import type { GitHubIntegrationResponse } from "../../types/api";
import { useToast } from "../ui/ToastProvider";
import { Button } from "../ui/Button";

interface GitHubSettingsSectionProps {
  workspaceId: string;
  projectId: string;
}

export function GitHubSettingsSection({
  workspaceId,
  projectId,
}: GitHubSettingsSectionProps) {
  const { t } = useTranslation();
  const { push } = useToast();

  const [integration, setIntegration] = useState<GitHubIntegrationResponse | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [savingSecret, setSavingSecret] = useState(false);

  useEffect(() => {
    getGitHubIntegration(workspaceId, projectId)
      .then((integrationData) => setIntegration(integrationData ?? null))
      .catch(() => setIntegration(null));
  }, [workspaceId, projectId]);

  async function handleSaveSecret(event: FormEvent) {
    event.preventDefault();
    const secret = secretInput.trim();
    if (!secret) return;
    setSavingSecret(true);
    try {
      await updateGitHubWebhookSecret(workspaceId, projectId, secret);
      setSecretInput("");
      setIntegration((current) =>
        current ? { ...current, hasWebhookSecret: true } : current,
      );
      push(t("github.secretSaved"));
    } catch (err) {
      push(err instanceof Error ? err.message : t("github.secretSaveFailed"), "error");
    } finally {
      setSavingSecret(false);
    }
  }

  return (
    <section
      aria-label={t("github.settingsTitle")}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GitBranch className="size-4" aria-hidden />
        </span>
        <h2 className="font-display font-semibold">{t("github.settingsTitle")}</h2>
      </div>

      <div className="flex flex-col gap-5">
        {integration && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
              {t("github.webhookSecretTitle")}
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">
              {t("github.webhookSecretHint")}{" "}
              <code className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px]">
                {API_BASE}/api/v1/webhooks/github
              </code>
            </p>
            <form onSubmit={handleSaveSecret} className="flex items-end gap-1.5">
              <input
                type="text"
                value={secretInput}
                onChange={(event) => setSecretInput(event.target.value)}
                placeholder={
                  integration.hasWebhookSecret
                    ? t("github.secretReplacePlaceholder")
                    : t("github.secretPlaceholder")
                }
                aria-label={t("github.webhookSecretTitle")}
                className="min-w-0 flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-xs placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
              />
              <Button
                type="submit"
                size="sm"
                disabled={savingSecret || !secretInput.trim()}
              >
                {savingSecret ? t("common.saving") : t("github.saveSecret")}
              </Button>
            </form>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {integration.hasWebhookSecret
                ? t("github.secretConfigured")
                : t("github.secretNotConfigured")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
