import { useTranslation } from "react-i18next";
import type { ComponentType } from "react";
import { Workflow, Bot, BookOpen, KanbanSquare, Users, Rocket } from "lucide-react";
import { BrowserFrame } from "./BrowserFrame";
import { Avatar } from "../ui/Avatar";

/**
 * Six feature rows (flows / ai / wiki / kanban / orgs / releases) in the
 * reference layout: browser-frame mockup (58%) + copy (42%), alternating
 * left/right on desktop, stacked on mobile. Every mockup is HTML/CSS driven by
 * design tokens — no external screenshots.
 */

const FEATURE_META = [
  {
    key: "flows",
    icon: Workflow,
    gradient: "from-teal-500/20 to-cyan-500/20",
    text: "teal",
  },
  {
    key: "ai",
    icon: Bot,
    gradient: "from-violet-500/20 to-purple-500/20",
    text: "violet",
  },
  {
    key: "wiki",
    icon: BookOpen,
    gradient: "from-amber-500/20 to-orange-500/20",
    text: "amber",
  },
  {
    key: "kanban",
    icon: KanbanSquare,
    gradient: "from-emerald-500/20 to-teal-500/20",
    text: "emerald",
  },
  {
    key: "orgs",
    icon: Users,
    gradient: "from-blue-500/20 to-indigo-500/20",
    text: "blue",
  },
  {
    key: "releases",
    icon: Rocket,
    gradient: "from-rose-500/20 to-pink-500/20",
    text: "rose",
  },
] as const;

function FlowsMock() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[
        { head: t("landing.mock.flows.todo"), cards: ["card1", "card2"], highlight: false },
        { head: t("landing.mock.flows.doing"), cards: ["card3", "card4"], highlight: false },
        { head: t("landing.mock.flows.done"), cards: ["card5", "card6"], highlight: true },
      ].map((col) => (
        <div key={col.head} className="rounded-lg bg-surface/60 p-2">
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {col.head}
          </p>
          <div className="space-y-1.5">
            {col.cards.map((c) => (
              <div
                key={c}
                className={`rounded-md px-2 py-1.5 text-[10.5px] leading-tight ${
                  col.highlight ? "border border-primary/40 bg-primary/10 text-foreground" : "bg-card text-muted-foreground"
                }`}
              >
                {t(`landing.mock.flows.${c}`)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AiMock() {
  const { t } = useTranslation();
  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-violet-400/25 bg-violet-400/5 p-3">
        <p className="mb-2 text-xs font-semibold text-violet-400">{t("landing.mock.ai.planTitle")}</p>
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-2 w-full rounded-full bg-elevated" />
          ))}
          <div className="h-2 w-2/3 rounded-full bg-elevated" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary">
          {t("landing.mock.ai.gateApproved")}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          {t("landing.mock.ai.gateReview")}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["discipline1", "discipline2", "discipline3"].map((d) => (
          <span key={d} className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {t(`landing.mock.ai.${d}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

function WikiMock() {
  const { t } = useTranslation();
  const rows = [
    { text: t("landing.mock.wiki.entry1"), tone: "border-primary/25 text-primary" },
    { text: t("landing.mock.wiki.entry2"), tone: "border-sky-400/25 text-sky-400" },
    { text: t("landing.mock.wiki.entry3"), tone: "border-violet-400/25 text-violet-400" },
    { text: t("landing.mock.wiki.entry4"), tone: "border-rose-400/25 text-rose-400" },
    { text: t("landing.mock.wiki.entry5"), tone: "border-amber-400/25 text-amber-400" },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-[11px] ${row.tone}`}
        >
          <span className={`size-1.5 rounded-full ${row.tone.split(" ")[1]}`} aria-hidden />
          <span className="truncate">{row.text}</span>
        </div>
      ))}
    </div>
  );
}

function KanbanMock() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[
        { head: t("landing.mock.kanban.todo"), cards: ["card1", "card2"], dim: false },
        { head: t("landing.mock.kanban.doing"), cards: ["card3", "card4"], dim: false },
        { head: t("landing.mock.kanban.done"), cards: ["card5", "card6"], dim: true },
      ].map((col) => (
        <div key={col.head} className="rounded-lg bg-surface/60 p-2">
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {col.head}
          </p>
          <div className="space-y-1.5">
            {col.cards.map((c, ci) => (
              <div key={c} className="rounded-md bg-card px-2 py-1.5">
                <p className="truncate text-[10.5px] leading-tight text-foreground">
                  {t(`landing.mock.kanban.${c}`)}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  <Avatar
                    name={[t("landing.mock.kanban.assignee1"), t("landing.mock.kanban.assignee2"), t("landing.mock.kanban.assignee3")][ci]}
                  />
                </div>
              </div>
            ))}
            {col.dim && <div className="rounded-md border border-dashed border-border px-2 py-1.5 text-center text-[10px] text-muted-foreground/60">+</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrgsMock() {
  const { t } = useTranslation();
  const members = [
    { name: t("landing.mock.orgs.member1"), role: t("landing.mock.orgs.member1Role"), tone: "teal" },
    { name: t("landing.mock.orgs.member2"), role: t("landing.mock.orgs.member2Role"), tone: "sky" },
    { name: t("landing.mock.orgs.member3"), role: t("landing.mock.orgs.member3Role"), tone: "violet" },
    { name: t("landing.mock.orgs.member4"), role: t("landing.mock.orgs.member4Role"), tone: "amber" },
  ];
  return (
    <div className="space-y-1.5">
      {members.map((m) => (
        <div key={m.name} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2">
          <Avatar name={m.name} size="sm" />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{m.name}</span>
          <span className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {m.role}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 px-2.5 py-2 text-xs text-primary">
        <span className="text-base leading-none">+</span> {t("landing.mock.orgs.inviteBtn")}
      </div>
    </div>
  );
}

function ReleasesMock() {
  const { t } = useTranslation();
  const rows = [
    { text: t("landing.mock.releases.flow1"), done: true },
    { text: t("landing.mock.releases.flow2"), done: false },
    { text: t("landing.mock.releases.flow3"), done: false },
    { text: t("landing.mock.releases.flow4"), done: false },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
          {t("landing.mock.releases.version")}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{t("landing.mock.releases.target")}</span>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>{t("landing.mock.releases.progress")}</span>
          <span className="font-mono">75%</span>
        </div>
        <div className="h-2 rounded-full bg-elevated">
          <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-primary to-primary-strong" />
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.text} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-foreground">
            <span className={`size-2 shrink-0 rounded-full ${row.done ? "bg-primary" : "bg-elevated ring-1 ring-border"}`} aria-hidden />
            <span className="truncate">{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOCKUPS: Record<string, ComponentType> = {
  flows: FlowsMock,
  ai: AiMock,
  wiki: WikiMock,
  kanban: KanbanMock,
  orgs: OrgsMock,
  releases: ReleasesMock,
};

export function FeatureBrowserFrame() {
  const { t } = useTranslation();

  return (
    <div className="space-y-16 lg:space-y-24">
      {FEATURE_META.map(({ key, icon: Icon, gradient }, i) => {
        const Mock = MOCKUPS[key];
        const reverse = i % 2 === 1;
        return (
          <div
            key={key}
            className={`flex flex-col items-center gap-8 lg:gap-14 ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"}`}
          >
            {/* Mockup (58%) */}
            <div className="w-full lg:w-[58%]">
              <BrowserFrame>{<Mock />}</BrowserFrame>
            </div>

            {/* Copy (42%) */}
            <div className="w-full lg:w-[42%]">
              <span
                className={`mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}
              >
                <Icon className="size-5.5 text-primary" aria-hidden />
              </span>
              <h3 className="mb-2 text-2xl font-semibold tracking-tight">
                {t(`landing.features.${key}.title`)}
              </h3>
              <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
                {t(`landing.features.${key}.desc`)}
              </p>
              <ul className="space-y-2">
                {[1, 2, 3].map((bi) => (
                  <li key={bi} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span>{t(`landing.features.${key}.b${bi}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
