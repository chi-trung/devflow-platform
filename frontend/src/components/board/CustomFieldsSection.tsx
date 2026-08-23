import { useTranslation } from "react-i18next";
import { Tags } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getTaskFieldValues } from "../../lib/api";
import type { CustomFieldValueResponse } from "../../types/api";

interface CustomFieldsSectionProps {
  workspaceId: string;
  projectId: string;
  taskId: string;
}

export function CustomFieldsSection({
  workspaceId,
  projectId,
  taskId,
}: CustomFieldsSectionProps) {
  const { t } = useTranslation();
  const { data: fields } = useApi<CustomFieldValueResponse[]>(
    () => getTaskFieldValues(workspaceId, projectId, taskId),
    [workspaceId, projectId, taskId],
  );

  const visible = (fields ?? []).filter(
    (field) => field.value != null && field.value !== "",
  );

  if (visible.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <Tags className="size-4 text-muted-foreground" aria-hidden />
        {t("taskDetail.customFields")}
      </h3>

      <div className="flex flex-col gap-1.5">
        {visible.map((field) => (
          <div
            key={field.fieldId}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm"
          >
            <span className="text-muted-foreground">{field.fieldName}</span>
            <span className="font-mono text-xs text-foreground">
              {field.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
