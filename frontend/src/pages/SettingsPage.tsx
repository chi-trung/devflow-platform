import { useEffect, useState } from "react";
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
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateSettings,
  type AppSettings,
} from "../lib/api";
import type { NotificationPreferencesResponse } from "../types/api";
import type { Theme } from "../lib/theme";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { WebhooksSection } from "../components/settings/WebhooksSection";

function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${checked ? "bg-primary" : "bg-elevated border border-border"}`}
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
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        label={label}
      />
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();

  const [prefs, setPrefs] = useState<NotificationPreferencesResponse | null>(
    null,
  );
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getNotificationPreferences()
      .then((loaded) => {
        if (!cancelled) setPrefs(loaded);
      })
      .catch(() => {
        if (!cancelled)
          setPrefs({
            emailOnAssignment: true,
            emailOnMention: true,
            emailOnSprintStarted: true,
          });
      })
      .finally(() => {
        if (!cancelled) setPrefsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const emailNotifications = prefs
    ? prefs.emailOnAssignment ||
      prefs.emailOnMention ||
      prefs.emailOnSprintStarted
    : false;

  const EMAIL_EVENTS: {
    key: keyof NotificationPreferencesResponse;
    label: string;
    hint: string;
  }[] = [
    { key: "emailOnAssignment", label: t("settings.assignedToMe"), hint: t("settings.assignedHint") },
    { key: "emailOnMention", label: t("settings.imMentioned"), hint: t("settings.mentionedHint") },
    { key: "emailOnSprintStarted", label: t("settings.sprintStarted"), hint: t("settings.sprintStartedHint") },
  ];

  async function persistPrefs(
    next: NotificationPreferencesResponse,
  ): Promise<boolean> {
    try {
      await updateNotificationPreferences(next);
      return true;
    } catch {
      push(t("settings.prefsSaveFailed"), "error");
      return false;
    }
  }

  function handlePrefToggle(
    key: keyof NotificationPreferencesResponse,
    value: boolean,
  ) {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    void persistPrefs(next).then((ok) => {
      if (!ok) setPrefs(prefs);
    });
  }

  function handleMasterEmailToggle(value: boolean) {
    if (!prefs) return;
    const next: NotificationPreferencesResponse = {
      emailOnAssignment: value,
      emailOnMention: value,
      emailOnSprintStarted: value,
    };
    setPrefs(next);
    void persistPrefs(next).then((ok) => {
      if (!ok) setPrefs(prefs);
      else push(value ? t("settings.emailOn") : t("settings.emailOff"));
    });
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
    push(t("settings.appearanceUpdated"));
  }

  async function handleSignOutAll() {
    setConfirmSignOut(false);
    await logout();
    push(t("settings.signedOut"));
    navigate("/login");
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-8">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("settings.title")}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("settings.preferences")}
          </p>
        </header>

        <section
          aria-label={t("settings.account")}
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold">{t("settings.account")}</h2>
            <Link
              to="/profile"
              className="ml-auto text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {t("settings.editProfile")}
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
          aria-label={t("settings.appearance")}
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold">{t("settings.appearance")}</h2>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("settings.colorTheme")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("settings.themeDesc")}
              </p>
            </div>
            <ThemeToggle onThemeChange={handleThemeChange} />
          </div>
        </section>

        <LanguageSection />

        <section
          aria-label={t("settings.notifications")}
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BellRing className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold">{t("settings.notifications")}</h2>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t("settings.emailNotifications")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("settings.emailDesc")}
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              disabled={prefsLoading}
              onChange={handleMasterEmailToggle}
              label={t("settings.emailNotifications")}
            />
          </div>

          {emailNotifications && prefs && (
            <div className="rise mt-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5">
              {EMAIL_EVENTS.map((event) => (
                <EmailEventRow
                  key={event.key}
                  label={event.label}
                  hint={event.hint}
                  checked={prefs[event.key]}
                  onChange={(value) => handlePrefToggle(event.key, value)}
                />
              ))}
              <p className="font-mono text-[10px] text-muted-foreground">
                {t("settings.syncedToAccount")}
              </p>
            </div>
          )}
        </section>

        <WebhooksSection />

        <section
          aria-label={t("settings.dangerZone")}
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <TriangleAlert className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold text-destructive">
              {t("settings.dangerZone")}
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("settings.signOut")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("settings.signOutDesc")}
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirmSignOut(true)}>
              <LogOut className="size-4" aria-hidden />
              {t("settings.signOut")}
            </Button>
          </div>
        </section>
      </div>

      {confirmSignOut && (
        <ConfirmDialog
          title={t("settings.signOutTitle")}
          message={t("settings.signOutConfirmMsg")}
          confirmLabel={t("settings.signOut")}
          onConfirm={() => void handleSignOutAll()}
          onCancel={() => setConfirmSignOut(false)}
        />
      )}
    </AppShell>
  );
}

function LanguageSection() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();

  const languages = [
    { code: "en", label: "English" },
    { code: "vi", label: "Tiếng Việt" },
  ];

  return (
    <section
      aria-label={t("settings.language")}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Globe className="size-4" aria-hidden />
        </span>
        <h2 className="font-display font-semibold">{t("settings.language")}</h2>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t("settings.language")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("settings.languageDesc")}
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
                push(t("settings.languageChangedTo", { language: lang.label }));
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
