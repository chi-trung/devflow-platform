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
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
): { ref: React.RefObject<T | null>; onKeyDown: (event: KeyboardEvent<T>) => void } {
  const ref = useRef<T>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    if (!dialog) return;
    const first = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find(
      (el) => el.offsetParent !== null,
    );
    first?.focus();
    return () => {
      const restore = restoreRef.current;
      if (restore && restore.isConnected) restore.focus();
    };
  }, [active]);

  function onKeyDown(event: KeyboardEvent<T>) {
    if (event.key !== "Tab") return;
    const dialog = ref.current;
    if (!dialog) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
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
