import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { ApiError } from "../lib/api";

interface FormState {
  displayName: string;
  username: string;
  email: string;
  password: string;
}

const initialForm: FormState = {
  displayName: "",
  username: "",
  email: "",
  password: "",
};

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (!form.displayName.trim()) {
    errors.displayName = "Display name is required.";
  } else if (form.displayName.trim().length > 100) {
    errors.displayName = "Display name must be at most 100 characters.";
  }

  if (!form.username.trim()) {
    errors.username = "Username is required.";
  } else if (
    form.username.trim().length < 3 ||
    !/^[a-zA-Z0-9_]+$/.test(form.username.trim())
  ) {
    errors.username =
      "Username needs at least 3 characters — letters, digits and underscores only.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (form.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        displayName: form.displayName.trim(),
      });
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(err.message);
      } else if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        const mapped: Partial<Record<keyof FormState, string>> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          const key = field.charAt(0).toLowerCase() + field.slice(1);
          if (key in form && messages[0]) {
            mapped[key as keyof FormState] = messages[0];
          }
        }
        setFieldErrors(mapped);
      } else {
        setFormError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start managing your team's work in minutes."
      footerText="Already have an account?"
      footerLinkTo="/login"
      footerLinkLabel="Sign in"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {formError && <ErrorAlert message={formError} />}

        <Field
          label="Display name"
          htmlFor="displayName"
          error={fieldErrors.displayName}
        >
          <Input
            id="displayName"
            placeholder="Dang Nguyen"
            value={form.displayName}
            onChange={(event) => update("displayName", event.target.value)}
            invalid={Boolean(fieldErrors.displayName)}
          />
        </Field>

        <Field
          label="Username"
          htmlFor="username"
          error={fieldErrors.username}
          hint="Letters, digits and underscores."
        >
          <Input
            id="username"
            autoComplete="username"
            placeholder="dangn"
            value={form.username}
            onChange={(event) => update("username", event.target.value)}
            invalid={Boolean(fieldErrors.username)}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@team.dev"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            invalid={Boolean(fieldErrors.email)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={fieldErrors.password}
          hint="At least 8 characters."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            invalid={Boolean(fieldErrors.password)}
          />
        </Field>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
