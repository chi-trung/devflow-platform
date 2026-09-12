import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const titleId = useId();
  const { ref: dialogRef, onKeyDown: trapTab } = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Consume the keystroke. The page keeps window-level Escape handlers
      // for its own layers, and this dialog sits on top of them: without
      // the stop, one Escape closes the dialog and also reaches the page
      // underneath, which can clear selection state and drop focus.
      event.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        ref={dialogRef}
        onKeyDown={trapTab}
        role="dialog"
        aria-modal
        aria-labelledby={title ? titleId : undefined}
        className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] rise"
      >
        {title && (
          <h2 id={titleId} className="font-display font-semibold">
            {title}
          </h2>
        )}
        <div className={title ? "mt-2" : ""}>{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
