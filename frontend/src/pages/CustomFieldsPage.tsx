import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import {
  createCustomField,
  deleteCustomField,
  getCustomFields,
} from "../lib/api";
import type { CustomFieldResponse } from "../types/api";

const FIELD_TYPES = [
  { value: "text", labelKey: "customField.typeText" },
  { value: "number", labelKey: "customField.typeNumber" },
  { value: "date", labelKey: "customField.typeDate" },
  { value: "select", labelKey: "customField.typeSelect" },
] as const;

type FieldType = CustomFieldResponse["fieldType"];

export function CustomFieldsPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const [fields, setFields] = useState<CustomFieldResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CustomFieldResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");

  const loadFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomFields(workspaceId, projectId);
      setFields(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("customField.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  function resetForm() {
    setName("");
    setFieldType("text");
    setOptions("");
    setCreating(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCustomField(workspaceId, projectId, {
        name: name.trim(),
        fieldType,
        options: fieldType === "select" ? options : null,
      });
      resetForm();
      loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("customField.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const field = pendingDelete;
    if (!field) return;
    try {
      await deleteCustomField(workspaceId, projectId, field.id);
      setPendingDelete(null);
      loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("customField.deleteFailed"));
    }
  }

  const typeLabel = FIELD_TYPES.find((ft) => ft.value === fieldType)?.labelKey;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            to={`/workspaces/${workspaceId}/projects/${projectId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("customField.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("customField.description")}
              </p>
            </div>
            {!creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                {t("customField.create")}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        {creating && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="mb-4 font-display text-lg font-semibold">
              {t("customField.createTitle")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("customField.nameLabel")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("customField.namePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("customField.typeLabel")}
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as FieldType)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {FIELD_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>
                      {t(ft.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              {fieldType === "select" && (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">
                    {t("customField.optionsLabel")}
                  </label>
                  <textarea
                    value={options}
                    onChange={(e) => setOptions(e.target.value)}
                    placeholder={t("customField.optionsPlaceholder")}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? t("common.saving") : t("common.create")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                disabled={saving}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : fields.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold">
              {t("customField.emptyTitle")}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("customField.emptyDescription")}
            </p>
            {!creating && (
              <Button
                className="mt-2"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" aria-hidden />
                {t("customField.create")}
              </Button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {fields.map((field) => (
              <li
                key={field.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong"
              >
                <GripVertical className="size-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{field.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(typeLabel ?? "customField.typeText")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setPendingDelete(field)}
                    className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                    title={t("customField.delete")}
                    aria-label={t("customField.delete")}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pendingDelete && (
          <ConfirmDialog
            title={t("customField.deleteTitle")}
            message={t("customField.deleteMessage", { name: pendingDelete.name })}
            confirmLabel={t("customField.deleteConfirm")}
            onConfirm={handleDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
