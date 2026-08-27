import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { AiAssistantPanel } from "./AiAssistantPanel";
import type { AiPageContext } from "./AiSuggestedPrompts";

interface AiFloatingButtonProps {
  workspaceId: string;
  projectId?: string;
  sprintId?: string | null;
  epicId?: string | null;
  context?: AiPageContext;
  /** Called after AI actions execute so the current page can refresh. */
  onTaskChanged?: () => void;
}

/**
 * The always-visible ✨ assistant launcher. Renders a fixed button in the
 * bottom-right corner of authenticated pages; clicking it opens the assistant
 * panel. Gated on having a workspace (see AppShell).
 */
export function AiFloatingButton({
  workspaceId,
  projectId,
  sprintId,
  epicId,
  context = "workspace",
  onTaskChanged,
}: AiFloatingButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t("ai.assistantOpen")}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="group fixed bottom-6 right-6 z-50 flex size-13 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-transform duration-150 hover:scale-105 active:scale-95"
        style={{ width: "3.25rem", height: "3.25rem" }}
      >
        <Sparkles className="size-6 transition-transform duration-300 group-hover:rotate-12" aria-hidden />
        <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-primary/30 [animation-duration:2.5s]" aria-hidden />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50">
          <AiAssistantPanel
            open={open}
            onClose={() => setOpen(false)}
            workspaceId={workspaceId}
            projectId={projectId}
            sprintId={sprintId}
            epicId={epicId}
            context={context}
            onTaskChanged={onTaskChanged}
          />
        </div>
      )}
    </>
  );
}
