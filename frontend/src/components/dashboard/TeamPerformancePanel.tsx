import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gauge } from "lucide-react";
import { api } from "../../lib/api";
import { EmptyState } from "../ui/EmptyState";

interface CycleLeadTimeResponse {
  cycleTimeP50?: number | null;
  cycleTimeP90?: number | null;
  leadTimeP50?: number | null;
  leadTimeP90?: number | null;
}

interface TeamPerformancePanelProps {
  workspaceId: string;
  projectId: string;
  className?: string;
}

function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value % 1 === 0 ? `${value}` : value.toFixed(1);
}

export function TeamPerformancePanel({
  workspaceId,
  projectId,
  className = "",
}: TeamPerformancePanelProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<CycleLeadTimeResponse | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<CycleLeadTimeResponse>(
      `/workspaces/${workspaceId}/projects/${projectId}/reporting/cycle-lead-time`,
    )
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId]);

  if (unavailable) {
    return (
      <div className={className}>
        <EmptyState
          icon={<Gauge className="size-8 text-muted-foreground" aria-hidden />}
          title={t("dashboard.analyticsUnavailable")}
        />
      </div>
    );
  }

  const tiles = [
    { key: "cycleP50", label: t("dashboard.cycleTime"), metric: t("dashboard.p50"), value: data?.cycleTimeP50 },
    { key: "cycleP90", label: t("dashboard.cycleTime"), metric: t("dashboard.p90"), value: data?.cycleTimeP90 },
    { key: "leadP50", label: t("dashboard.leadTime"), metric: t("dashboard.p50"), value: data?.leadTimeP50 },
    { key: "leadP90", label: t("dashboard.leadTime"), metric: t("dashboard.p90"), value: data?.leadTimeP90 },
  ];

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <h3 className="mb-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold">
        <Gauge className="size-4 text-primary" aria-hidden />
        {t("dashboard.teamPerformance")}
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="rounded-lg border border-border/60 bg-card px-3 py-2.5"
          >
            <p className="text-[11px] font-medium text-muted-foreground">
              {tile.label} · <span className="font-mono">{tile.metric}</span>
            </p>
            <p className="mt-1 font-display text-xl font-semibold">
              {formatDays(tile.value)}
              <span className="ml-0.5 font-mono text-xs text-muted-foreground">
                {t("dashboard.days")}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
