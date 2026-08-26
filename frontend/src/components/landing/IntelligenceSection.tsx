import { useTranslation } from "react-i18next";
import { BrowserFrame } from "./BrowserFrame";

/**
 * "The Intelligence" section — mirrors the reference site's wiki-recall block:
 * a copy column describing weighted wiki recall + a terminal mockup showing the
 * agent querying RAG with a weighted context bundle of ADRs/runbooks.
 */

type EntryStatus = "accepted" | "proposed" | "superseded" | "deprecated" | "run";

const STATUS_STYLES: Record<EntryStatus, { dot: string; chip: string; label: string }> = {
  accepted: {
    dot: "bg-[#2dd4bf]",
    chip: "border-primary/30 text-primary",
    label: "accepted",
  },
  proposed: {
    dot: "bg-amber-400",
    chip: "border-amber-400/40 text-amber-400",
    label: "proposed",
  },
  superseded: {
    dot: "bg-sky-400",
    chip: "border-sky-400/40 text-sky-400",
    label: "superseded",
  },
  deprecated: {
    dot: "bg-rose-400",
    chip: "border-rose-400/40 text-rose-400",
    label: "deprecated",
  },
  run: {
    dot: "bg-violet-400",
    chip: "border-violet-400/40 text-violet-400",
    label: "run",
  },
};

const LIFECYCLE = [
  { nameKey: "acceptedName", descKey: "acceptedDesc", dot: "bg-[#2dd4bf]", ring: "ring-[#2dd4bf]/30", size: "size-3.5" },
  { nameKey: "proposedName", descKey: "proposedDesc", dot: "bg-amber-400", ring: "ring-amber-400/30", size: "size-3" },
  { nameKey: "supersededName", descKey: "supersededDesc", dot: "bg-sky-400", ring: "ring-sky-400/30", size: "size-2.5" },
  { nameKey: "deprecatedName", descKey: "deprecatedDesc", dot: "bg-rose-400", ring: "ring-rose-400/30", size: "size-2" },
];

export function IntelligenceSection() {
  const { t } = useTranslation();

  const entries = t("landing.intel.entries", { returnObjects: true }) as Array<{
    id: string;
    title: string;
    weight: string;
    status: string;
  }>;

  return (
    <section className="border-b border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* ── Copy column ── */}
          <div>
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t("landing.intel.eyebrow")}
            </p>
            <h2 className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {t("landing.intel.title")}
            </h2>
            <p className="mb-8 text-base leading-relaxed text-muted-foreground">
              {t("landing.intel.desc")}
            </p>

            <h3 className="mb-4 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("landing.intel.lifecycleTitle")}
            </h3>
            <div className="space-y-3">
              {LIFECYCLE.map((item) => (
                <div key={item.nameKey} className="flex items-center gap-3">
                  <span
                    className={`${item.dot} ${item.size} shrink-0 rounded-full ring-4 ${item.ring}`}
                    aria-hidden
                  />
                  <span className="w-28 shrink-0 text-sm font-medium">
                    {t(`landing.intel.${item.nameKey}`)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t(`landing.intel.${item.descKey}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Terminal mockup ── */}
          <BrowserFrame className="font-mono">
            {/* prompt line */}
            <div className="mb-4 rounded-lg bg-[#0a0e14] px-3 py-2.5 text-[12.5px] leading-relaxed dark:bg-black/40">
              <span className="text-emerald-400">{t("landing.intel.terminalPrompt")}</span>{" "}
              <span className="text-foreground">{t("landing.intel.terminalQuery")}</span>
            </div>

            {/* RAG tag */}
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex rounded-md border border-border bg-elevated px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                {t("landing.intel.terminalAgentTag")}
              </span>
            </div>

            {/* ADR cards */}
            <div className="space-y-2">
              {entries.map((entry, i) => {
                const status = STATUS_STYLES[(entry.status as EntryStatus) ?? "accepted"] ?? STATUS_STYLES.accepted;
                return (
                  <div
                    key={entry.id + i}
                    className={`flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 ${status.chip}`}
                  >
                    <span className={`size-2 shrink-0 rounded-full ${status.dot}`} aria-hidden />
                    <span className="text-[11.5px] font-semibold tracking-wide">{entry.id}</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
                      {entry.title}
                    </span>
                    {entry.weight && (
                      <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                        {entry.weight}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* context bundle footer */}
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-glow-pulse" aria-hidden />
              {t("landing.intel.terminalContextBundle")}
            </div>
          </BrowserFrame>
        </div>
      </div>
    </section>
  );
}
