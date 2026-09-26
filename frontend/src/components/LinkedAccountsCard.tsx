import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Github, Link2, ShieldCheck, Trash2 } from "lucide-react";
import { useToast } from "./ui/ToastProvider";
import { Button } from "./ui/Button";
import { ErrorAlert } from "./ui/ErrorAlert";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { useSocialProviders } from "../hooks/useSocialProviders";
import type { LinkedAccountsResponse } from "../types/api";

/** Provider names are proper nouns the backend owns, so they are branded here
 *  rather than translated — a translated provider name would be
 *  unrecognisable next to the consent screen it was just granted on. */
const PROVIDER_META: Record<string, { label: string; Icon: typeof Github }> = {
  google: { label: "Google", Icon: ShieldCheck },
  github: { label: "GitHub", Icon: Github },
};

function providerMeta(provider: string) {
  return PROVIDER_META[provider] ?? { label: provider, Icon: Link2 };
}

/**
 * Lists the external identities this account can be signed in with, and lets
 * each one be removed.
 *
 * Removal is not free, and the UI says so before the request rather than after
 * it. The server refuses to drop the last provider on an account with no
 * address — that would leave the password as the permanent sole key to the
 * account — and the 409 it returns is surfaced verbatim, because it is the only
 * party that knows which case this is. Telling someone "linked accounts
 * updated" over a refusal would be a lie about their own security.
 */
export function LinkedAccountsCard() {
  const { t } = useTranslation();
  const { push } = useToast();
  const providers = useSocialProviders();

  const { data, loading, error, reload } = useApi<LinkedAccountsResponse>(
    () => api<LinkedAccountsResponse>("/auth/linked-accounts"),
    [],
  );

  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const linked = data?.providers ?? [];

  const unlink = async (provider: string) => {
    setRemoving(provider);
    setActionError(null);
    try {
      await api<LinkedAccountsResponse>(`/auth/linked-accounts/${provider}`, {
        method: "DELETE",
      });
      setConfirming(null);
      push(t("account.unlinkDone", { provider: providerMeta(provider).label }), "success");
      reload();
    } catch (err: unknown) {
      // The server's own words. A 409 here means removing this would strand the
      // account, and flattening that into "something went wrong" would hide the
      // one fact the person needs to decide what to do next.
      setActionError(err instanceof Error ? err.message : t("account.unlinkFailed"));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section
      aria-label={t("account.linkedAccountsTitle")}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
          <Link2 className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display font-semibold">{t("account.linkedAccountsTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("account.linkedAccountsBody")}</p>
        </div>
      </div>

      {error && data === null && <ErrorAlert message={error} />}

      {!loading && !error && linked.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {providers.any ? t("account.noLinkedAccounts") : t("account.linkingUnavailable")}
        </p>
      )}

      {linked.length > 0 && (
        <ul role="list" className="flex flex-col gap-2">
          {linked.map((provider) => {
            const { label, Icon } = providerMeta(provider);
            const isConfirming = confirming === provider;
            return (
              <li
                key={provider}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border px-3 py-2.5"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
                {isConfirming ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {t("account.unlinkConfirm", { provider: label })}
                    </span>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={removing === provider}
                      onClick={() => void unlink(provider)}
                    >
                      {removing === provider ? t("account.unlinking") : t("account.unlinkYes")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={removing === provider}
                      onClick={() => setConfirming(null)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setActionError(null);
                      setConfirming(provider);
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    {t("account.unlink")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {actionError && (
        <div className="mt-3">
          <ErrorAlert message={actionError} />
        </div>
      )}
    </section>
  );
}
