import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { XCircle } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { Input } from "../components/ui/Input";
import { api } from "../lib/api";
import { usePageMeta } from "../lib/seo";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  usePageMeta("auth.chooseNewPassword", "auth.chooseNewPasswordSubtitle");
  const [params] = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const token = params.get("token") ?? "";

  // A missing token can never succeed, so do not render a form that is
  // guaranteed to fail — the user needs a way to request a new link instead.
  if (!token) {
    return (
      <AuthLayout
        title={t("auth.chooseNewPassword")}
        subtitle={t("auth.chooseNewPasswordSubtitle")}
        footerText={t("auth.rememberedPassword")}
        footerLinkTo="/login"
        footerLinkLabel={t("auth.signIn")}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          >
            <XCircle className="size-6" />
          </span>
          <div className="space-y-1">
            <p role="alert" className="text-sm font-semibold text-foreground">
              {t("auth.resetLinkInvalid")}
            </p>
            <p className="text-xs text-muted-foreground">{t("auth.resetLinkInvalidSubtitle")}</p>
          </div>
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary-strong"
          >
            {t("auth.requestNewLink")}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Checked here as well as on the server so the mismatch is immediate; the
    // server has its own length rules and is still the authority.
    if (password !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api<void>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthLayout
        title={t("auth.passwordChanged")}
        subtitle={t("auth.passwordChangedSubtitle")}
        footerText={t("auth.backToSignIn")}
        footerLinkTo="/login"
        footerLinkLabel={t("auth.signIn")}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <p role="status" className="text-sm text-muted-foreground">
            {t("auth.sessionsSignedOut")}
          </p>
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
      title={t("auth.chooseNewPassword")}
      subtitle={t("auth.chooseNewPasswordSubtitle")}
      footerText={t("auth.rememberedPassword")}
      footerLinkTo="/login"
      footerLinkLabel={t("auth.signIn")}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <ErrorAlert message={error} />}

        <div className="space-y-1.5">
          <label htmlFor="new-password" className="text-sm font-medium text-foreground">
            {t("auth.newPassword")}
          </label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("auth.newPasswordPlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
            {t("auth.confirmPassword")}
          </label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder={t("auth.confirmPasswordPlaceholder")}
          />
        </div>

        <Button type="submit" disabled={submitting || password.length === 0}>
          {submitting ? t("auth.saving") : t("auth.saveNewPassword")}
        </Button>
      </form>
    </AuthLayout>
  );
}
