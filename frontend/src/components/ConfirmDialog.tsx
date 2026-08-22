import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/Button";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="alertdialog" aria-label={title}>
      <button
        type="button"
        aria-label={t("confirm.cancel")}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
          <h2 className="font-display font-semibold">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("confirm.cancel")}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel ?? t("common.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
