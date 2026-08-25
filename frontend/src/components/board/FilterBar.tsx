import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Filter, Link2, X } from "lucide-react";
import {
  deleteFilterPreset,
  loadFilterPresets,
  saveFilterPreset,
  type BoardFilterState,
} from "../../lib/api";
import type { LabelResponse, WorkspaceMemberResponse } from "../../types/api";

const inputClass =
  "w-full max-w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none sm:w-auto";

interface FilterBarProps {
  projectId: string;
  members: WorkspaceMemberResponse[];
  labels: LabelResponse[];
  current: BoardFilterState;
  onChange: (patch: Partial<BoardFilterState>) => void;
}

export function FilterBar({
  projectId,
  members,
  labels,
  current,
  onChange,
}: FilterBarProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState(0);
  const [presetName, setPresetName] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const presets = useMemo(
    () => loadFilterPresets(projectId),
    [projectId, version],
  );
  const presetNames = Object.keys(presets);

  const isDefault =
    current.sprint === "all" &&
    !current.search &&
    !current.priority &&
    !current.assignee &&
    !current.label &&
    !current.dueFrom &&
    !current.dueTo &&
    !current.blockedOnly;

  function applyPreset(name: string) {
    const preset = presets[name];
    if (!preset) return;
    onChange(preset);
    setActivePreset(name);
    setPresetName("");
  }

  function handleSave() {
    const name = presetName.trim();
    if (!name || isDefault) return;
    saveFilterPreset(projectId, name, current);
    setVersion((v) => v + 1);
    setActivePreset(name);
    setPresetName("");
  }

  function handleDelete(name: string) {
    deleteFilterPreset(projectId, name);
    setVersion((v) => v + 1);
    if (activePreset === name) setActivePreset(null);
  }

  const chips: { key: keyof BoardFilterState; label: string }[] = [];
  if (current.priority)
    chips.push({ key: "priority", label: t("filter.chipPriority", { value: current.priority }) });
  if (current.assignee === "none")
    chips.push({ key: "assignee", label: t("filter.unassigned") });
  else if (current.assignee) {
    const member = members.find((m) => m.userId === current.assignee);
    chips.push({
      key: "assignee",
      label: t("filter.chipAssignee", {
        value: member?.displayName || member?.username || "user",
      }),
    });
  }
  if (current.label) {
    const label = labels.find((l) => l.id === current.label);
    chips.push({
      key: "label",
      label: t("filter.chipLabel", { value: label?.name ?? "?" }),
    });
  }
  if (current.dueFrom)
    chips.push({ key: "dueFrom", label: t("filter.chipDueFrom", { date: current.dueFrom }) });
  if (current.dueTo)
    chips.push({ key: "dueTo", label: t("filter.chipDueTo", { date: current.dueTo }) });
  if (current.blockedOnly)
    chips.push({ key: "blockedOnly", label: t("filter.blockedOnly") });

  return (
    <section
      aria-label={t("filter.filters")}
      className="mb-3 flex flex-col gap-2 rounded-xl border border-border bg-surface px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2"
    >
      <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Filter className="size-3.5" aria-hidden />
        {t("filter.filters")}
      </span>

      <select
        aria-label={t("filter.filterByAssignee")}
        value={current.assignee}
        onChange={(event) =>
          onChange({ assignee: event.target.value, })
        }
        className={inputClass}
      >
        <option value="">{t("filter.allAssignees")}</option>
        <option value="none">{t("filter.unassigned")}</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.displayName || member.username}
          </option>
        ))}
      </select>

      <select
        aria-label={t("filter.filterByPriority")}
        value={current.priority}
        onChange={(event) => onChange({ priority: event.target.value })}
        className={inputClass}
      >
        <option value="">{t("filter.anyPriority")}</option>
        <option value="Critical">{t("task.critical")}</option>
        <option value="High">{t("task.high")}</option>
        <option value="Medium">{t("task.medium")}</option>
        <option value="Low">{t("task.low")}</option>
      </select>

      {labels.length > 0 && (
        <select
          aria-label={t("filter.filterByLabel")}
          value={current.label}
          onChange={(event) => onChange({ label: event.target.value })}
          className={inputClass}
        >
          <option value="">{t("filter.anyLabel")}</option>
          {labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      )}

      <span className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1.5 sm:gap-y-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("filter.dueFrom")}
          <input
            type="date"
            aria-label={t("filter.dueDateFrom")}
            value={current.dueFrom}
            onChange={(event) => onChange({ dueFrom: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("filter.to")}
          <input
            type="date"
            aria-label={t("filter.dueDateTo")}
            value={current.dueTo}
            onChange={(event) => onChange({ dueTo: event.target.value })}
            className={inputClass}
          />
        </label>
      </span>

      <button
        type="button"
        onClick={() => onChange({ blockedOnly: !current.blockedOnly })}
        aria-pressed={current.blockedOnly}
        title={t("filter.showBlockedOnly")}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-all duration-200 active:scale-[0.98] ${
          current.blockedOnly
            ? "border-destructive/50 bg-destructive/10 text-destructive"
            : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
        }`}
      >
        <Link2 className="size-3.5" aria-hidden />
        {t("filter.blocked")}
      </button>

      {(presetNames.length > 0 || activePreset || !isDefault) && (
        <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 sm:w-auto sm:ml-auto sm:border-t-0 sm:pt-0">
          {(presetNames.length > 0 || activePreset) && (
            <select
              aria-label={t("filter.loadPreset")}
              value=""
              onChange={(event) => {
                if (event.target.value) applyPreset(event.target.value);
              }}
              className={`${inputClass} max-w-40`}
            >
              <option value="">{t("filter.presets")}</option>
              {presetNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          {activePreset && (
            <>
              <span className="max-w-32 truncate rounded-md bg-elevated px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {activePreset}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(activePreset)}
                aria-label={t("filter.deletePresetAria", { name: activePreset })}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </>
          )}
          {!isDefault && (
            <span className="flex w-full items-center gap-1 sm:w-auto">
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSave();
                  }
                }}
                placeholder={t("filter.saveAs")}
                aria-label={t("filter.presetName")}
                maxLength={30}
                className={`${inputClass} w-full sm:w-28`}
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={!presetName.trim()}
                className="shrink-0 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:border-primary disabled:opacity-40"
              >
                {t("filter.save")}
              </button>
            </span>
          )}
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1.5 pt-0.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() =>
                onChange(
                  chip.key === "blockedOnly"
                    ? { blockedOnly: false }
                    : { [chip.key]: "" } as Partial<BoardFilterState>,
                )
              }
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-1 text-xs font-medium text-foreground transition-colors duration-150 hover:border-border-strong"
              title={t("filter.clearFilter")}
            >
              {chip.label}
              <X className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
