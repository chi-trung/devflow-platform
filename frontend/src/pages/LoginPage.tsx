import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  // A registration that just created an account hands the username over, so
  // the person does not have to remember what they typed on the previous
  // screen. It is a convenience, not a guarantee: the value comes from our own
  // navigation state, never from the URL, so it cannot be used to prefill an
  // account somebody else is about to be asked for.
  const location = useLocation();
  const registeredUsername =
    (location.state as { registeredUsername?: string } | null)?.registeredUsername ?? "";

  const [username, setUsername] = useState(() => registeredUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError(t("auth.fillBothFields"));
      return;
    }

    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      // One message for "no such username" and for "wrong password": the form
      // cannot tell them apart, and saying which one was wrong would let
      // anyone confirm which usernames exist.
      setError(
        err instanceof ApiError && err.status === 401
          ? t("auth.incorrectCredentials")
          : err instanceof Error
            ? err.message
            : t("auth.somethingWrong"),
      );
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

        <Field label={t("auth.username")} htmlFor="username">
          <Input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="dangn"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>

        {/* A registration that just happened is the one case where "forgot
            password" is known to be a dead end, and it is exactly the one the
            person is about to hit. Saying so here is cheaper than letting them
            find out by typing an address that was never collected. */}
        {registeredUsername && (
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            {t("auth.registeredHint")}
          </p>
        )}

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

        {/* Without this the page has no way out of a forgotten password, and
            the recovery route would be reachable only by typing the URL. */}
        <Link
          to="/forgot-password"
          className="-mt-1 self-end text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          {t("auth.forgotPassword")}
        </Link>

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
