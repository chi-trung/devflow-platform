import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FileUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { importTasks } from "../../lib/api";
import type { ImportResultResponse } from "../../types/api";
import { Button } from "../ui/Button";
import { ErrorAlert } from "../ui/ErrorAlert";

interface ImportTasksModalProps {
  workspaceId: string;
  projectId: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportTasksModal({
  workspaceId,
  projectId,
  onClose,
  onImported,
}: ImportTasksModalProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResultResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setError(null);
    setResult(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError(t("import.noFile"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await importTasks(workspaceId, projectId, file);
      setResult(data);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("import.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("board.closeAria")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-tasks-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileUp className="size-4" aria-hidden />
          </span>
          <h2 id="import-tasks-title" className="font-display font-semibold">
            {t("import.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("board.closeDialogAria")}
            className="ml-auto rounded p-1 text-muted-foreground transition-colors duration-150 hover:bg-elevated hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {result ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {t("import.importedCount", { count: result.imported })}
              {" · "}
              <span className="text-muted-foreground">
                {t("import.skippedCount", { count: result.skipped })}
              </span>
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-surface p-3">
                <p className="mb-1 text-xs font-medium text-destructive">
                  {t("import.errors")}
                </p>
                <ul className="list-inside list-disc space-y-0.5 font-mono text-xs text-muted-foreground">
                  {result.errors.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-1 flex justify-end gap-2">
              <Button onClick={onClose}>{t("common.done")}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center transition-colors duration-150 hover:border-primary hover:bg-elevated/50">
              <FileUp className="size-5 text-muted-foreground" aria-hidden />
              <span className="text-sm">
                {file ? file.name : t("import.pickFile")}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                .csv · .json
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={handleFile}
                disabled={busy}
                className="sr-only"
              />
            </label>

            <p className="text-xs text-muted-foreground">
              CSV: <code className="font-mono">title,description,status,priority</code>
              {" — "}
              {t("import.statusHint")}
            </p>

            {error && <ErrorAlert message={error} />}

            <div className="mt-1 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={busy || !file}>
                {busy ? t("import.importing") : t("import.submit")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
