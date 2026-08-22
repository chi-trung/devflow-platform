import { useMemo, useState } from "react";
import { Filter, Link2, X } from "lucide-react";
import {
  deleteFilterPreset,
  loadFilterPresets,
  saveFilterPreset,
  type BoardFilterState,
} from "../../lib/api";
import type { LabelResponse, WorkspaceMemberResponse } from "../../types/api";

const inputClass =
  "rounded-lg border border-border bg-card px-2 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none";

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
  if (current.priority) chips.push({ key: "priority", label: `Priority: ${current.priority}` });
  if (current.assignee === "none") chips.push({ key: "assignee", label: "Unassigned" });
  else if (current.assignee) {
    const member = members.find((m) => m.userId === current.assignee);
    chips.push({
      key: "assignee",
      label: `Assignee: ${member?.displayName || member?.username || "user"}`,
    });
  }
  if (current.label) {
    const label = labels.find((l) => l.id === current.label);
    chips.push({ key: "label", label: `Label: ${label?.name ?? "?"}` });
  }
  if (current.dueFrom) chips.push({ key: "dueFrom", label: `Due ≥ ${current.dueFrom}` });
  if (current.dueTo) chips.push({ key: "dueTo", label: `Due ≤ ${current.dueTo}` });
  if (current.blockedOnly)
    chips.push({ key: "blockedOnly", label: "Blocked only" });

  return (
    <section
      aria-label="Board filters"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"
    >
      <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Filter className="size-3.5" aria-hidden />
        Filters
      </span>

      <select
        aria-label="Filter by assignee"
        value={current.assignee}
        onChange={(event) =>
          onChange({ assignee: event.target.value, })
        }
        className={inputClass}
      >
        <option value="">All assignees</option>
        <option value="none">Unassigned</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.displayName || member.username}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by priority"
        value={current.priority}
        onChange={(event) => onChange({ priority: event.target.value })}
        className={inputClass}
      >
        <option value="">Any priority</option>
        <option value="Critical">Critical</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>

      {labels.length > 0 && (
        <select
          aria-label="Filter by label"
          value={current.label}
          onChange={(event) => onChange({ label: event.target.value })}
          className={inputClass}
        >
          <option value="">Any label</option>
          {labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      )}

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Due from
        <input
          type="date"
          aria-label="Due date from"
          value={current.dueFrom}
          onChange={(event) => onChange({ dueFrom: event.target.value })}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        to
        <input
          type="date"
          aria-label="Due date to"
          value={current.dueTo}
          onChange={(event) => onChange({ dueTo: event.target.value })}
          className={inputClass}
        />
      </label>

      <button
        type="button"
        onClick={() => onChange({ blockedOnly: !current.blockedOnly })}
        aria-pressed={current.blockedOnly}
        title="Show only blocked tasks"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-all duration-200 active:scale-[0.98] ${
          current.blockedOnly
            ? "border-destructive/50 bg-destructive/10 text-destructive"
            : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
        }`}
      >
        <Link2 className="size-3.5" aria-hidden />
        Blocked
      </button>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {(presetNames.length > 0 || activePreset) && (
          <select
            aria-label="Load filter preset"
            value=""
            onChange={(event) => {
              if (event.target.value) applyPreset(event.target.value);
            }}
            className={`${inputClass} max-w-40`}
          >
            <option value="">Presets…</option>
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
              aria-label={`Delete preset ${activePreset}`}
              className="rounded p-1 text-muted-foreground hover:text-destructive"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </>
        )}
        {!isDefault && (
          <span className="flex items-center gap-1">
            <input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSave();
                }
              }}
              placeholder="Save as…"
              aria-label="Preset name"
              maxLength={30}
              className={`${inputClass} w-28`}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!presetName.trim()}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:border-primary disabled:opacity-40"
            >
              Save
            </button>
          </span>
        )}
      </div>

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
              title="Clear filter"
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
