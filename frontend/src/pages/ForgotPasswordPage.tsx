import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { Input } from "../components/ui/Input";
import { api } from "../lib/api";
import { usePageMeta } from "../lib/seo";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  usePageMeta("auth.forgotPassword", "auth.forgotPasswordSubtitle");

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Always 202, whether or not the address is registered. The screen below
      // therefore says the same thing in every case — that is the whole point,
      // and a "no such account" message here would leak who has one.
      await api<void>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        title={t("auth.resetLinkSent")}
        subtitle={t("auth.resetLinkSentSubtitle")}
        footerText={t("auth.rememberedPassword")}
        footerLinkTo="/login"
        footerLinkLabel={t("auth.signIn")}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            {t("auth.sentTo")}{" "}
            <span className="font-semibold break-all text-foreground">{email}</span>
          </p>
          <p className="text-xs text-muted-foreground">{t("auth.resetLinkExpiry")}</p>
          <Link
            to="/login"
            className="text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary-strong"
          >
            {t("auth.backToSignIn")}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.forgotPassword")}
      subtitle={t("auth.forgotPasswordSubtitle")}
      footerText={t("auth.rememberedPassword")}
      footerLinkTo="/login"
      footerLinkLabel={t("auth.signIn")}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <ErrorAlert message={error} />}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            {t("auth.email")}
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@team.dev"
          />
        </div>

        <Button type="submit" disabled={submitting || email.trim().length === 0}>
          {submitting ? t("auth.sending") : t("auth.sendResetLink")}
        </Button>

        <Link
          to="/login"
          className="text-center text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary-strong"
        >
          {t("auth.backToSignIn")}
        </Link>
      </form>
    </AuthLayout>
  );
}
