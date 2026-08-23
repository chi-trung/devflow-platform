import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  GitBranch,
  KeyRound,
  Link2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  API_BASE,
  createPat,
  deletePat,
  getGitHubIntegration,
  listPats,
  updateGitHubWebhookSecret,
} from "../../lib/api";
import type {
  GitHubIntegrationResponse,
  PatResponse,
} from "../../types/api";
import { useToast } from "../ui/ToastProvider";
import { Button } from "../ui/Button";

const PAT_SCOPES = ["read", "write", "tasks", "admin"] as const;

const BRANCH_RULE_STORAGE = "devflow.githubBranchRules";

interface BranchRules {
  prOpenedToReview: boolean;
  prMergedToDone: boolean;
}

function loadBranchRules(): BranchRules {
  try {
    const raw = localStorage.getItem(BRANCH_RULE_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BranchRules>;
      return {
        prOpenedToReview: parsed.prOpenedToReview ?? true,
        prMergedToDone: parsed.prMergedToDone ?? true,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return { prOpenedToReview: true, prMergedToDone: true };
}

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

  const [pats, setPats] = useState<PatResponse[]>([]);
  const [patName, setPatName] = useState("");
  const [patScopes, setPatScopes] = useState<string[]>(["read"]);
  const [patDays, setPatDays] = useState(30);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [creatingPat, setCreatingPat] = useState(false);
  const [patsLoading, setPatsLoading] = useState(false);

  const [branchRules, setBranchRules] = useState<BranchRules>(loadBranchRules);

  useEffect(() => {
    getGitHubIntegration(workspaceId, projectId)
      .then((integrationData) => setIntegration(integrationData ?? null))
      .catch(() => setIntegration(null));
  }, [workspaceId, projectId]);

  useEffect(() => {
    loadPats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistBranchRules(next: BranchRules) {
    setBranchRules(next);
    localStorage.setItem(BRANCH_RULE_STORAGE, JSON.stringify(next));
  }

  async function loadPats() {
    setPatsLoading(true);
    try {
      const list = await listPats();
      setPats(list);
    } catch {
      setPats([]);
    } finally {
      setPatsLoading(false);
    }
  }

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

  function toggleScope(scope: string) {
    setPatScopes((current) =>
      current.includes(scope)
        ? current.filter((s) => s !== scope)
        : [...current, scope],
    );
  }

  async function handleCreatePat(event: FormEvent) {
    event.preventDefault();
    if (!patName.trim() || patScopes.length === 0) return;
    setCreatingPat(true);
    setCreatedToken(null);
    try {
      const expiresAtUtc =
        patDays > 0
          ? new Date(Date.now() + patDays * 86_400_000).toISOString()
          : new Date(Date.now() + 3650 * 86_400_000).toISOString();
      const created = await createPat(patName.trim(), patScopes, expiresAtUtc);
      setCreatedToken(created.token);
      setPatName("");
      setPatScopes(["read"]);
      await loadPats();
    } catch (err) {
      push(err instanceof Error ? err.message : t("github.patCreateFailed"), "error");
    } finally {
      setCreatingPat(false);
    }
  }

  async function handleRevokePat(pat: PatResponse) {
    try {
      await deletePat(pat.id);
      setPats((current) => current.filter((p) => p.id !== pat.id));
      push(t("github.patRevoked"));
    } catch (err) {
      push(err instanceof Error ? err.message : t("github.patRevokeFailed"), "error");
    }
  }

  async function handleCopyToken() {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      push(t("github.patCopied"));
    } catch {
      push(t("github.clipboardUnavailable"), "error");
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

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <GitBranch className="size-4 text-muted-foreground" aria-hidden />
            {t("github.branchRulesTitle")}
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            {t("github.branchRulesHint")}
          </p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-sm">{t("github.rulePrOpened")}</span>
              <button
                type="button"
                role="switch"
                aria-checked={branchRules.prOpenedToReview}
                onClick={() =>
                  persistBranchRules({
                    ...branchRules,
                    prOpenedToReview: !branchRules.prOpenedToReview,
                  })
                }
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                  branchRules.prOpenedToReview
                    ? "bg-primary"
                    : "border border-border bg-elevated"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-card shadow transition-all duration-200 ${
                    branchRules.prOpenedToReview ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <span className="text-sm">{t("github.rulePrMerged")}</span>
              <button
                type="button"
                role="switch"
                aria-checked={branchRules.prMergedToDone}
                onClick={() =>
                  persistBranchRules({
                    ...branchRules,
                    prMergedToDone: !branchRules.prMergedToDone,
                  })
                }
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                  branchRules.prMergedToDone
                    ? "bg-primary"
                    : "border border-border bg-elevated"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-card shadow transition-all duration-200 ${
                    branchRules.prMergedToDone ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden />
            {t("github.patTitle")}
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            {t("github.patHint")}
          </p>

          <form onSubmit={handleCreatePat} className="flex flex-col gap-2">
            <input
              type="text"
              value={patName}
              onChange={(event) => setPatName(event.target.value)}
              placeholder={t("github.patNamePlaceholder")}
              aria-label={t("github.patNamePlaceholder")}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {PAT_SCOPES.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  aria-pressed={patScopes.includes(scope)}
                  className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors duration-150 ${
                    patScopes.includes(scope)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {t("github.patExpires")}
                <select
                  value={patDays}
                  onChange={(event) => setPatDays(Number(event.target.value))}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  <option value={7}>7 {t("github.days")}</option>
                  <option value={30}>30 {t("github.days")}</option>
                  <option value={90}>90 {t("github.days")}</option>
                  <option value={0}>{t("github.never")}</option>
                </select>
              </label>
              <Button
                type="submit"
                size="sm"
                className="ml-auto"
                disabled={creatingPat || !patName.trim() || patScopes.length === 0}
              >
                <Plus className="size-3.5" aria-hidden />
                {creatingPat ? t("common.saving") : t("github.createPat")}
              </Button>
            </div>
          </form>

          {createdToken && (
            <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-primary">
                <ShieldCheck className="size-3.5" aria-hidden />
                {t("github.patCreatedOnce")}
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded border border-border bg-card px-2 py-1.5 font-mono text-[11px]">
                  {createdToken}
                </code>
                <Button type="button" size="sm" variant="outline" onClick={() => void handleCopyToken()}>
                  <Link2 className="size-3.5" aria-hidden />
                  {t("github.copyToken")}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-col divide-y divide-border/60">
            {patsLoading && pats.length === 0 ? (
              <div className="space-y-2">
                {[0, 1].map((index) => (
                  <div key={index} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : pats.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {t("github.patEmpty")}
              </p>
            ) : (
              pats.map((pat) => (
                <div
                  key={pat.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{pat.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {pat.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded border border-border px-1 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                          {scope}
                        </span>
                      ))}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        · {new Date(pat.expiresAtUtc).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRevokePat(pat)}
                    aria-label={t("github.revokePat", { name: pat.name })}
                    title={t("github.revokePat", { name: pat.name })}
                    className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
