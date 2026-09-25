import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { GitHubSignInButton } from "../components/GitHubSignInButton";
import { ApiError } from "../lib/api";
import { usePageMeta } from "../lib/seo";
import { useSocialProviders } from "../hooks/useSocialProviders";

export function LoginPage() {
  const { t } = useTranslation();
  // Public routes share one index.html, so without this the previous route's
  // title bleeds through client-side navigation (signing up from a marketing
  // page, or the header's Log in button on "/" after visiting /blog).
  usePageMeta("auth.welcomeBack", "auth.signInToAccount");
  const { login } = useAuth();
  const navigate = useNavigate();
  const providers = useSocialProviders();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Set when the credentials were right but the address is still unproven.
  // The alert is not enough on its own: the fix is a click on a link in an
  // inbox, so the user needs a way to get to the resend screen from here.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setUnverifiedEmail(null);

    if (!email.trim() || !password) {
      setError(t("auth.fillBothFields"));
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      // 403 (not 401) is what the API answers for an unverified account, and
      // it has to stay that way: the API client silently refreshes and retries
      // on a 401, which would hand this user a working session anyway.
      if (err instanceof ApiError && err.status === 403) {
        setError(t("auth.emailNotVerified"));
        setUnverifiedEmail(email.trim());
      } else {
        setError(
          err instanceof ApiError && err.status === 401
            ? t("auth.incorrectCredentials")
            : err instanceof Error
              ? err.message
              : t("auth.somethingWrong"),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.welcomeBack")}
      subtitle={t("auth.signInToAccount")}
      footerText={t("auth.noAccount")}
      footerLinkTo="/register"
      footerLinkLabel={t("auth.createOne")}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <ErrorAlert message={error} />}

        {unverifiedEmail && (
          <Link
            to="/check-email"
            state={{ email: unverifiedEmail }}
            className="-mt-2 text-center text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary-strong"
          >
            {t("auth.resendVerification")}
          </Link>
        )}

        <Field label={t("auth.email")} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@team.dev"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label={t("auth.password")} htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button type="submit" disabled={submitting}>
          {submitting ? t("auth.signingIn") : t("auth.signIn")}
        </Button>

        {providers.any && (
          <div className="relative flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}

        <GoogleSignInButton />
        <GitHubSignInButton />
      </form>
    </AuthLayout>
  );
}
