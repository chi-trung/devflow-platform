// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog } from "../components/ui/Dialog";

// Regression for the Escape leak: the shared Dialog listens on document,
// BoardPage listens on window, and one keydown bubbles through both. While
// the dialog is open it owns the keystroke; the page underneath must not
// also act on it (that used to clear the board selection under a bulk
// delete confirm and drop focus to body).
describe("Dialog Escape handling", () => {
  it("closes on Escape and stops the event before it reaches window", () => {
    const onClose = vi.fn();
    const onWindowEscape = vi.fn();
    window.addEventListener("keydown", onWindowEscape);
    try {
      render(
        <Dialog open onClose={onClose} title="Confirm">
          <p>Are you sure?</p>
        </Dialog>,
      );
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onWindowEscape).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", onWindowEscape);
    }
  });

  it("does not close or stop other keys", () => {
    const onClose = vi.fn();
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    try {
      render(
        <Dialog open onClose={onClose} title="Confirm">
          <p>Are you sure?</p>
        </Dialog>,
      );
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
      expect(onClose).not.toHaveBeenCalled();
      expect(onWindowKey).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", onWindowKey);
    }
  });

  it("ignores Escape entirely while closed", () => {
    const onClose = vi.fn();
    render(
      <Dialog open={false} onClose={onClose} title="Confirm">
        <p>Are you sure?</p>
      </Dialog>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
