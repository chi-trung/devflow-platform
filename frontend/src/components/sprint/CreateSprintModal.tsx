import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarRange, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createSprint } from "../../lib/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ErrorAlert } from "../ui/ErrorAlert";

interface CreateSprintModalProps {
  workspaceId: string;
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateSprintModal({
  workspaceId,
  projectId,
  onClose,
  onCreated,
}: CreateSprintModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("sprint.nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createSprint(workspaceId, projectId, {
        name: name.trim(),
        goal: goal.trim() || null,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sprint.createFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("sprint.closeAria")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-sprint-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarRange className="size-4" aria-hidden />
          </span>
          <h2 id="create-sprint-title" className="font-display font-semibold">
            {t("sprint.newSprint")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("sprint.closeDialogAria")}
            className="ml-auto rounded p-1 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">{t("sprint.nameLabel")}</span>
            <Input
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("sprint.sprintNamePlaceholder")}
              invalid={error !== null && !name.trim()}
              disabled={busy}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">{t("sprint.goal")}</span>
            <Input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder={t("sprint.goalPlaceholder")}
              disabled={busy}
            />
          </label>

          <p className="text-xs text-muted-foreground">
            {t("sprint.datesHint")}
          </p>

          {error && <ErrorAlert message={error} />}

          <div className="mt-1 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("sprint.creating") : t("sprint.createSprint")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
