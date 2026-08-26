import { useTranslation } from "react-i18next";
import { BookOpen, FileCode2, Workflow, Link2, Pencil, Trash2, GitBranch } from "lucide-react";
import { Badge } from "../ui/Badge";
import type { KnowledgeEntryResponse, KnowledgeStatus, KnowledgeType } from "../../types/api";

export const TYPE_META: Record<KnowledgeType, { icon: typeof BookOpen; labelKey: string }> = {
  Adr: { icon: FileCode2, labelKey: "knowledge.type.Adr" },
  Pattern: { icon: Workflow, labelKey: "knowledge.type.Pattern" },
  Runbook: { icon: BookOpen, labelKey: "knowledge.type.Runbook" },
};

const STATUS_TONE: Record<KnowledgeStatus, "teal" | "amber" | "violet" | "neutral"> = {
  Accepted: "teal",
  Draft: "amber",
  Proposed: "violet",
  Superseded: "neutral",
  Deprecated: "neutral",
};

interface KnowledgeEntryCardProps {
  entry: KnowledgeEntryResponse;
  onEdit: (entry: KnowledgeEntryResponse) => void;
  onDelete: (entry: KnowledgeEntryResponse) => void;
  onSupersede: (entry: KnowledgeEntryResponse) => void;
  canDelete?: boolean;
}

export function KnowledgeEntryCard({
  entry,
  onEdit,
  onDelete,
  onSupersede,
  canDelete = true,
}: KnowledgeEntryCardProps) {
  const { t } = useTranslation();
  const TypeIcon = TYPE_META[entry.type]?.icon ?? BookOpen;
  const isRetired = entry.status === "Superseded" || entry.status === "Deprecated";

  return (
    <li
      className={`group rounded-xl border bg-card p-4 transition-colors duration-200 hover:border-border-strong ${
        isRetired ? "border-border/60 opacity-70" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TypeIcon className="size-4 text-primary" aria-hidden />
            <h3 className="truncate text-sm font-semibold">{entry.title}</h3>
            <Badge tone={STATUS_TONE[entry.status]}>
              {t(`knowledge.status.${entry.status}`)}
            </Badge>
            <Badge tone="neutral">{t(TYPE_META[entry.type]?.labelKey ?? "knowledge.type.Runbook")}</Badge>
          </div>

          {entry.body && (
            <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
              {entry.body}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px]">
              w {Number(entry.weight).toFixed(2)}
            </span>
            {entry.tags && (
              <span className="inline-flex flex-wrap items-center gap-1">
                {entry.tags.split(",").map((tag) => (
                  <span key={tag} className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10.5px]">
                    {tag.trim()}
                  </span>
                ))}
              </span>
            )}
            {entry.taskId && (
              <span className="inline-flex items-center gap-1 text-[11px]" title={t("knowledge.capturedFromTask")}>
                <Link2 className="size-3" aria-hidden />
                {t("knowledge.autoCaptured")}
              </span>
            )}
            {entry.supersededById && (
              <span className="inline-flex items-center gap-1 text-[11px]" title={t("knowledge.supersededBy")}>
                <GitBranch className="size-3" aria-hidden />
                {t("knowledge.supersededLink")}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onSupersede(entry)}
            disabled={isRetired}
            className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            title={t("knowledge.supersede")}
            aria-label={t("knowledge.supersede")}
          >
            <GitBranch className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
            title={t("knowledge.edit")}
            aria-label={t("knowledge.edit")}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(entry)}
              className="rounded p-1.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
              title={t("knowledge.delete")}
              aria-label={t("knowledge.delete")}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
