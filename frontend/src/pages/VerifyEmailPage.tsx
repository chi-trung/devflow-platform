import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { api } from "../lib/api";
import { usePageMeta } from "../lib/seo";
import { useAuth } from "../auth/AuthContext";
import type { LoginResponse } from "../types/api";

type Phase = "verifying" | "success" | "failed";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  usePageMeta("auth.verifyingEmail", "auth.verifyingEmailSubtitle");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSessionFromTokens } = useAuth();

  const [phase, setPhase] = useState<Phase>("verifying");
  // React 18 StrictMode double-invokes effects in development, which would
  // POST the same verification token twice. Harmless server-side (the
  // endpoint is idempotent) but it mints two sessions and races the
  // navigation, so the exchange runs exactly once.
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const token = params.get("token");
    if (!token) {
      setPhase("failed");
      return;
    }

    let cancelled = false;

    async function exchange() {
      try {
        const data = await api<LoginResponse>("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });

        if (cancelled) return;

        // The link is a completed sign-in: the visitor just proved they own
        // the address, so they get a session and no second password prompt.
        setSessionFromTokens(data.accessToken, data.refreshToken);
        setPhase("success");
        // A beat on the confirmation, then in. Navigating instantly would
        // flash the dashboard before the token is readable.
        setTimeout(() => navigate("/", { replace: true }), 900);
      } catch {
        if (!cancelled) setPhase("failed");
      }
    }

    void exchange();

    return () => {
      cancelled = true;
    };
  }, [params, navigate, setSessionFromTokens]);

  return (
    <AuthLayout
      title={t("auth.verifyingEmail")}
      subtitle={t("auth.verifyingEmailSubtitle")}
      footerText={t("auth.alreadyVerified")}
      footerLinkTo="/login"
      footerLinkLabel={t("auth.signIn")}
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {phase === "verifying" && (
          <>
            <Loader2
              aria-hidden
              className="size-8 animate-spin text-primary"
            />
            <p className="text-sm text-muted-foreground">{t("auth.verifyingEmailWait")}</p>
          </>
        )}

        {phase === "success" && (
          <>
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <CheckCircle2 className="size-6" />
            </span>
            <p role="status" className="text-sm font-semibold text-foreground">
              {t("auth.emailVerified")}
            </p>
            <p className="text-xs text-muted-foreground">{t("auth.takingYouIn")}</p>
          </>
        )}

        {phase === "failed" && (
          <>
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            >
              <XCircle className="size-6" />
            </span>
            <div className="space-y-1">
              <p role="alert" className="text-sm font-semibold text-foreground">
                {t("auth.linkInvalid")}
              </p>
              <p className="text-xs text-muted-foreground">{t("auth.linkInvalidSubtitle")}</p>
            </div>
            {/* A dead link is recoverable as long as the address is known,
                so point at the one screen that can produce a fresh link. */}
            <Button onClick={() => navigate("/check-email")} className="mt-2">
              {t("auth.sendNewLink")}
            </Button>
          </>
        )}

        {phase !== "verifying" && (
          <Link
            to="/login"
            className="text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary-strong"
          >
            {t("auth.backToSignIn")}
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}
