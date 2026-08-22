import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { ApiError } from "../lib/api";

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError(t("auth.fillBothFields"));
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
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
      </form>
    </AuthLayout>
  );
}
