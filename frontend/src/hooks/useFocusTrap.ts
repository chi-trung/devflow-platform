import { useEffect, useRef, type KeyboardEvent } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside a modal dialog while it is open.
 *
 * The consumer wires the returned handler to the dialog element's
 * onKeyDown and puts `ref` on the same element. When `active` flips true
 * focus moves to the first control inside; Tab and Shift+Tab wrap at the
 * ends; a focus that has leaked behind the overlay is pulled back on the
 * next keystroke. On close, focus returns to whatever held it before the
 * dialog opened (typically the card or button that launched it).
 *
 * Controls with a negative tabindex (the invisible backdrop close button)
 * are skipped: they are clickable but must not join the Tab cycle or take
 * the initial focus.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
): { ref: React.RefObject<T | null>; onKeyDown: (event: KeyboardEvent<T>) => void } {
  const ref = useRef<T>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // querySelectorAll can't express "and tabindex >= 0" across all the
  // alternatives, so filter programmatically. The offsetParent check skips
  // hidden controls.
  function collect(dialog: HTMLElement): HTMLElement[] {
    return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.tabIndex >= 0 && el.offsetParent !== null,
    );
  }

  useEffect(() => {
    if (!active) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    if (!dialog) return;
    collect(dialog)[0]?.focus();
    return () => {
      const restore = restoreRef.current;
      if (restore && restore.isConnected) restore.focus();
    };
  }, [active]);

  function onKeyDown(event: KeyboardEvent<T>) {
    if (event.key !== "Tab") return;
    const dialog = ref.current;
    if (!dialog) return;
    const items = collect(dialog);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const activeEl = document.activeElement;
    if (!dialog.contains(activeEl)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && activeEl === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeEl === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return { ref, onKeyDown };
}
