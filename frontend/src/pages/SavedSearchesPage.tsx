import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import {
  createSavedSearch,
  deleteSavedSearch,
  getSavedSearches,
} from "../lib/api";
import type { SavedSearchResponse } from "../types/api";

export function SavedSearchesPage() {
  const { t } = useTranslation();
  const [searches, setSearches] = useState<SavedSearchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedSearchResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [filtersJson, setFiltersJson] = useState("");

  const loadSearches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSavedSearches();
      setSearches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("savedSearch.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSearches();
  }, [loadSearches]);

  function resetForm() {
    setName("");
    setQuery("");
    setFiltersJson("");
    setCreating(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !query.trim()) return;
    setSaving(true);
    try {
      await createSavedSearch({
        name: name.trim(),
        workspaceId: "",
        query: query.trim(),
        filtersJson: filtersJson.trim() || undefined,
      });
      resetForm();
      loadSearches();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("savedSearch.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const search = pendingDelete;
    if (!search) return;
    try {
      await deleteSavedSearch(search.id);
      setPendingDelete(null);
      loadSearches();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("savedSearch.deleteFailed"));
    }
  }

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("savedSearch.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("savedSearch.description")}
              </p>
            </div>
            {!creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                {t("savedSearch.create")}
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
              {t("savedSearch.createTitle")}
            </h2>
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("savedSearch.nameLabel")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("savedSearch.namePlaceholder")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Query
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search query"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Filters JSON (optional)
                </label>
                <textarea
                  value={filtersJson}
                  onChange={(e) => setFiltersJson(e.target.value)}
                  placeholder='{"status":"InProgress"}'
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={saving || !name.trim() || !query.trim()}>
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
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : searches.length === 0 ? (
          <EmptyState
            icon={<Search className="size-8 text-muted-foreground" aria-hidden />}
            title={t("savedSearch.emptyTitle")}
            description={t("savedSearch.emptyDescription")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {searches.map((search) => (
              <li
                key={search.id}
                className="group rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-border-strong"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">
                      {search.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {search.query}
                    </p>
                    {search.filtersJson && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {search.filtersJson}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(search.createdAtUtc)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(search)}
                      className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                      title={t("savedSearch.delete")}
                      aria-label={t("savedSearch.delete")}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pendingDelete && (
          <ConfirmDialog
            title={t("savedSearch.deleteTitle")}
            message={t("savedSearch.deleteMessage", { name: pendingDelete.name })}
            confirmLabel={t("savedSearch.deleteConfirm")}
            onConfirm={handleDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
