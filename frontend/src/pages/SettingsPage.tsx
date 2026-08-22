import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  Globe,
  LogOut,
  Palette,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { updateSettings, type AppSettings } from "../lib/api";
import type { Theme } from "../lib/theme";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { ConfirmDialog } from "../components/ConfirmDialog";

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        checked ? "bg-primary" : "bg-elevated border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-card shadow transition-all duration-200 ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function EmailEventRow({
  label,
  hint,
  read,
  onChange,
}: {
  label: string;
  hint: string;
  read: () => boolean;
  onChange: (value: boolean) => void;
}) {
  const [checked, setChecked] = useState(read);
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        checked={checked}
        onChange={(value) => {
          setChecked(value);
          onChange(value);
        }}
        label={label}
      />
    </div>
  );
}

export function SettingsPage() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();

  const [emailNotifications, setEmailNotifications] = useState<boolean>(() => {
    const savedEmail = localStorage.getItem("devflow.settings.email");
    if (savedEmail !== null) return savedEmail === "true";
    try {
      const raw = localStorage.getItem("devflow.settings");
      if (raw) return JSON.parse(raw).emailNotifications === true;
    } catch {}
    return false;
  });
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const EMAIL_EVENTS: { key: string; label: string; hint: string }[] = [
    { key: "assigned", label: "Task assigned to me", hint: "Someone assigns you a task" },
    { key: "mentioned", label: "I'm mentioned", hint: "Your name appears in a comment" },
    { key: "statusChanged", label: "Status changed on my tasks", hint: "A task you own moves columns" },
    { key: "dueSoon", label: "Due date reminders", hint: "24h before a task of yours is due" },
    { key: "sprintStarted", label: "Sprint started", hint: "A sprint in your workspace kicks off" },
  ];

  function readEmailEvent(key: string): boolean {
    try {
      const raw = localStorage.getItem("devflow.settings.emailEvents");
      if (!raw) return true;
      return (JSON.parse(raw) as Record<string, boolean>)[key] !== false;
    } catch {
      return true;
    }
  }

  function writeEmailEvent(key: string, value: boolean) {
    let map: Record<string, boolean> = {};
    try {
      map = JSON.parse(localStorage.getItem("devflow.settings.emailEvents") ?? "{}");
    } catch {}
    map[key] = value;
    localStorage.setItem("devflow.settings.emailEvents", JSON.stringify(map));
  }

  function saveSettings(patch: Partial<AppSettings>, emailPref: boolean) {
    void updateSettings({
      theme: document.documentElement.classList.contains("light")
        ? "light"
        : "dark",
      emailNotifications: emailPref,
      ...patch,
    });
  }

  function handleThemeChange(_next: Theme) {
    saveSettings({}, emailNotifications);
    push("Appearance updated");
  }

  function handleEmailToggle(value: boolean) {
    setEmailNotifications(value);
    saveSettings({ emailNotifications: value }, value);
    push(value ? "Email notifications on" : "Email notifications off");
  }

  async function handleSignOutAll() {
    setConfirmSignOut(false);
    localStorage.removeItem("devflow.settings.email");
    await logout();
    push("Signed out");
    navigate("/login");
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-8">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Preferences are saved on this device.
          </p>
        </header>

        <section
          aria-label="Account"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold">Account</h2>
            <Link
              to="/profile"
              className="ml-auto text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Edit profile
            </Link>
          </div>
          <div className="flex items-center gap-3.5">
            <Avatar
              name={currentUser?.username ?? "?"}
              id={currentUser?.id}
              size="md"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">
                {currentUser?.displayName || currentUser?.username}
              </p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {currentUser?.email}
              </p>
            </div>
          </div>
        </section>

        <section
          aria-label="Appearance"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold">Appearance</h2>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Color theme</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Dark is the DevFlow signature look; Light is great in daylight.
              </p>
            </div>
            <ThemeToggle onThemeChange={handleThemeChange} />
          </div>
        </section>

        <LanguageSection />

        <section
          aria-label="Notification preferences"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BellRing className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold">Notifications</h2>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Email notifications</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Get an email when someone assigns or mentions you. (Coming soon
                — preference saved locally for now.)
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onChange={handleEmailToggle}
              label="Email notifications"
            />
          </div>

          {emailNotifications && (
            <div className="rise mt-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5">
              {EMAIL_EVENTS.map((event) => (
                <EmailEventRow
                  key={event.key}
                  label={event.label}
                  hint={event.hint}
                  read={() => readEmailEvent(event.key)}
                  onChange={(value) => {
                    writeEmailEvent(event.key, value);
                  }}
                />
              ))}
              <p className="font-mono text-[10px] text-muted-foreground">
                Saved locally — server-side delivery lands with the email-preferences API.
              </p>
            </div>
          )}
        </section>

        <section
          aria-label="Danger zone"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold text-destructive">
              Danger Zone
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ends your session on this device and clears local preferences.
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirmSignOut(true)}>
              <LogOut className="size-4" aria-hidden />
              Sign out
            </Button>
          </div>
        </section>
      </div>

      {confirmSignOut && (
        <ConfirmDialog
          title="Sign out?"
          message="You'll need to sign in again to access your workspaces."
          confirmLabel="Sign out"
          onConfirm={() => void handleSignOutAll()}
          onCancel={() => setConfirmSignOut(false)}
        />
      )}
    </AppShell>
  );
}

function LanguageSection() {
  const { i18n } = useTranslation();
  const { push } = useToast();

  const languages = [
    { code: "en", label: "English" },
    { code: "vi", label: "Tiếng Việt" },
  ];

  return (
    <section
      aria-label="Language"
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Globe className="size-4" aria-hidden />
        </span>
        <h2 className="font-display font-semibold">Language</h2>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Language</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose your preferred language for the interface.
          </p>
        </div>
        <div className="flex gap-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                void i18n.changeLanguage(lang.code);
                localStorage.setItem("devflow.language", lang.code);
                push(`Language changed to ${lang.label}`);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                i18n.language === lang.code
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
