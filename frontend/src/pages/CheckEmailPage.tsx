import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { api } from "../lib/api";
import { usePageMeta } from "../lib/seo";

/** Matches the server's 60s per-address cooldown in ResendVerificationCommandHandler. */
const RESEND_COOLDOWN_SECONDS = 60;

interface CheckEmailLocationState {
  email?: string;
}

export function CheckEmailPage() {
  const { t } = useTranslation();
  usePageMeta("auth.checkYourEmail", "auth.checkYourEmailSubtitle");
  const location = useLocation();
  const state = location.state as CheckEmailLocationState | null;

  // The address survives a reload in the query string: a user who lands on
  // this screen, opens their mail app to find the link, and comes back to a
  // reloaded tab should still see which inbox to check — and the resend
  // button still needs it. Registration navigates with router state, which
  // does not, so the query string is the source of truth and router state is
  // only the faster first read.
  const email = state?.email ?? new URLSearchParams(location.search).get("email") ?? "";

  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Auto-dismiss the confirmation so it does not sit there looking like
  // permanent state after the cooldown has long passed.
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), 6000);
    return () => clearTimeout(timer);
  }, [sent]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Mirror the address into the URL once, so a refresh (or a link pasted
  // from support) still lands on the right inbox. `replaceState`, not
  // `navigate` — this must not push a history entry the Back button would
  // have to walk through.
  useEffect(() => {
    if (!email) return;
    const params = new URLSearchParams(location.search);
    if (params.get("email") === email) return;
    params.set("email", email);
    window.history.replaceState(null, "", `${location.pathname}?${params}`);
  }, [email, location.pathname, location.search]);

  async function handleResend() {
    if (!email) return;
    setSending(true);
    setError(null);
    setSent(false);
    try {
      await api<void>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.somethingWrong"));
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.checkYourEmail")}
      subtitle={t("auth.checkYourEmailSubtitle")}
      footerText={t("auth.alreadyVerified")}
      footerLinkTo="/login"
      footerLinkLabel={t("auth.signIn")}
    >
      <div className="flex flex-col gap-4">
        {error && <ErrorAlert message={error} />}

        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            {t("auth.sentTo")}{" "}
            <span className="font-semibold break-all text-foreground">{email || t("auth.yourInbox")}</span>
          </p>
          <p className="text-xs text-muted-foreground">{t("auth.linkExpires")}</p>
        </div>

        <Button
          onClick={handleResend}
          disabled={sending || secondsLeft > 0 || !email}
          variant="outline"
        >
          {secondsLeft > 0
            ? t("auth.resendIn", { seconds: secondsLeft })
            : sending
              ? t("auth.sending")
              : t("auth.resendVerification")}
        </Button>

        {sent && (
          <p role="status" className="text-center text-xs text-primary">
            {t("auth.verificationResent")}
          </p>
        )}

        <Link
          to="/login"
          className="text-center text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary-strong"
        >
          {t("auth.backToSignIn")}
        </Link>
      </div>
    </AuthLayout>
  );
}
