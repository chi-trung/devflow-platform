// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "../i18n";
import { ThemeToggle } from "../components/ui/ThemeToggle";

// The group advertises role=radiogroup, so screen readers announce arrow-key
// selection. Native radios give that for free; these buttons have to
// implement it, and exactly one radio may hold a tab stop at a time.
function radios() {
  return screen.getAllByRole("radio");
}

describe("ThemeToggle keyboard behavior", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("light");
    localStorage.setItem("devflow.theme", "dark");
  });

  it("moves the selection and focus with arrow keys", () => {
    render(<ThemeToggle />);
    const [dark, light] = radios();
    dark.focus();
    fireEvent.keyDown(dark, { key: "ArrowRight" });
    expect(light).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(light);
    fireEvent.keyDown(light, { key: "ArrowLeft" });
    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(dark);
  });

  it("wraps around at the ends", () => {
    render(<ThemeToggle />);
    const [dark, light] = radios();
    fireEvent.keyDown(dark, { key: "ArrowRight" });
    fireEvent.keyDown(light, { key: "ArrowRight" });
    expect(dark).toHaveAttribute("aria-checked", "true");
  });

  it("keeps a single tab stop on the checked radio", () => {
    render(<ThemeToggle />);
    const [dark, light] = radios();
    expect(dark.tabIndex).toBe(0);
    expect(light.tabIndex).toBe(-1);
    fireEvent.keyDown(dark, { key: "ArrowDown" });
    expect(dark.tabIndex).toBe(-1);
    expect(light.tabIndex).toBe(0);
  });

  it("does not swallow unrelated keys", () => {
    render(<ThemeToggle />);
    const [dark] = radios();
    fireEvent.keyDown(dark, { key: "Enter" });
    expect(dark).toHaveAttribute("aria-checked", "true");
  });
});
