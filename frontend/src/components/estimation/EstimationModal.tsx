import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Check } from "lucide-react";
import { Button } from "../ui/Button";
import { setTaskEstimation } from "../../lib/api";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21] as const;

interface EstimationModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
  taskId: string;
  currentEstimate: number | null;
  onSaved: (storyPoints: number | null) => void;
}

export function EstimationModal({
  open,
  onClose,
  workspaceId,
  projectId,
  taskId,
  currentEstimate,
  onSaved,
}: EstimationModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(currentEstimate);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await setTaskEstimation(workspaceId, projectId, taskId, selected);
      onSaved(selected);
      onClose();
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold">
            {t("estimation.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          {t("estimation.description")}
        </p>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {FIBONACCI.map((points) => (
            <button
              key={points}
              type="button"
              onClick={() => setSelected(points)}
              className={`rounded-lg border py-2 text-sm font-semibold transition-colors duration-150 ${
                selected === points
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-border-strong"
              }`}
            >
              {points}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("estimation.clear")}
          </button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Check className="size-4" aria-hidden />
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
