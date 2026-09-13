import { useEffect, useRef, useState } from "react";
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // The launcher unmounts while the panel is open (see {!open && ...} below),
  // so on close React has no trigger node to restore focus to and the browser
  // drops it to <body>: keyboard and screen reader users lose their place.
  // Refocus the button after it remounts, but only on the open-to-closed
  // transition so an initial page load does not steal focus.
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      {!open && (
        <button
          ref={buttonRef}
          type="button"
          aria-label={t("ai.assistantOpen")}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="group fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-6 z-50 flex size-13 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-transform duration-150 hover:scale-105 active:scale-95 lg:bottom-6"
          style={{ width: "3.25rem", height: "3.25rem" }}
        >
          <Sparkles className="size-6 transition-transform duration-300 group-hover:rotate-12" aria-hidden />
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-primary/30 [animation-duration:2.5s]" aria-hidden />
        </button>
      )}

      {open && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-6 z-50 lg:bottom-24">
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
