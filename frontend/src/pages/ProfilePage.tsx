import { useState, type FormEvent } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { ApiError, changePassword, updateProfile } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ErrorAlert } from "../components/ui/ErrorAlert";

function messageFrom(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const first = Object.values(err.fieldErrors)[0]?.[0];
    return first || err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export function ProfilePage() {
  const { currentUser, refreshUser } = useAuth();
  const { push } = useToast();

  const [displayName, setDisplayName] = useState(
    currentUser?.displayName ?? "",
  );
  const [username, setUsername] = useState(currentUser?.username ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim()) {
      setProfileError("Username is required.");
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      await updateProfile({
        username: username.trim(),
        displayName: displayName.trim() || undefined,
      });
      await refreshUser();
      push("Profile saved");
    } catch (err) {
      setProfileError(messageFrom(err, "Failed to save profile."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      push("Password changed");
    } catch (err) {
      setPasswordError(messageFrom(err, "Failed to change password."));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-8">
        <header className="flex items-center gap-3.5">
          <Avatar
            name={currentUser?.username ?? "?"}
            id={currentUser?.id}
            size="md"
          />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {currentUser?.displayName || currentUser?.username}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {currentUser?.email}
            </p>
          </div>
        </header>

        <section
          aria-label="Account details"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold">Account details</h2>
          </div>

          <form onSubmit={handleProfileSubmit} noValidate className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Display name</span>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How your name appears across the app"
                disabled={savingProfile}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Username</span>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                invalid={profileError !== null && !username.trim()}
                disabled={savingProfile}
              />
            </label>

            {profileError && <ErrorAlert message={profileError} />}

            <div className="mt-1 flex justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </section>

        <section
          aria-label="Change password"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="size-4" aria-hidden />
            </span>
            <h2 className="font-display font-semibold">Change password</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} noValidate className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Current password</span>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={savingPassword}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">New password</span>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  disabled={savingPassword}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Confirm new password</span>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={savingPassword}
                />
              </label>
            </div>

            {passwordError && <ErrorAlert message={passwordError} />}

            <div className="mt-1 flex justify-end">
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Changing…" : "Change password"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
