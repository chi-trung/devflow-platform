import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { EMOJI_PRESETS, COVER_GRADIENTS, COVER_COLOR_KEYS } from "./EmojiCover";

/**
 * Small preset pickers for the project create/edit + workspace edit forms.
 * Popover-style: click the current tile to open a grid, click a preset to
 * select, click the clear button to remove.
 */

interface EmojiPickerProps {
  value?: string | null;
  onChange: (emoji: string | null) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("ui.emojiPicker.label")}
        title={t("ui.emojiPicker.label")}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-xl transition-colors duration-150 hover:border-border-strong"
      >
        {value ?? "🙂"}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-12 z-40 w-64 rounded-xl border border-border bg-card p-2 shadow-2xl">
            <div className="grid grid-cols-6 gap-1">
              {EMOJI_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onChange(emoji);
                    setOpen(false);
                  }}
                  className={`flex h-9 cursor-pointer items-center justify-center rounded-lg text-lg transition-colors duration-150 hover:bg-elevated ${
                    value === emoji ? "bg-primary/15 ring-1 ring-primary/40" : ""
                  }`}
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-destructive"
              >
                <X className="size-3" aria-hidden />
                {t("ui.emojiPicker.clear")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface CoverColorPickerProps {
  value?: string | null;
  onChange: (color: string | null) => void;
}

export function CoverColorPicker({ value, onChange }: CoverColorPickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{t("ui.coverColor.label")}</span>
      <div className="flex items-center gap-1.5">
        {COVER_COLOR_KEYS.map((key) => {
          const gradient = COVER_GRADIENTS[key];
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(active ? null : key)}
              aria-label={`${t("ui.coverColor.label")} ${key}`}
              title={key}
              className={`h-6 w-6 cursor-pointer rounded-full bg-gradient-to-br ${gradient} transition-transform duration-150 hover:scale-110 ${
                active ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
              }`}
            />
          );
        })}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t("ui.emojiPicker.clear")}
            className="cursor-pointer rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-destructive"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
