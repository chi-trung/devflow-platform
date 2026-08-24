import { describe, it, expect, beforeEach } from "vitest";
import { getTheme, applyTheme, initTheme } from "../lib/theme";

describe("theme utils", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("light");
    localStorage.clear();
  });

  it("getTheme returns dark by default", () => {
    expect(getTheme()).toBe("dark");
  });

  it("getTheme returns light when class is present", () => {
    document.documentElement.classList.add("light");
    expect(getTheme()).toBe("light");
  });

  it("applyTheme sets light class", () => {
    applyTheme("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(getTheme()).toBe("light");
  });

  it("applyTheme removes light class for dark", () => {
    document.documentElement.classList.add("light");
    applyTheme("light");
    applyTheme("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(getTheme()).toBe("dark");
  });

  it("applyTheme persists to localStorage", () => {
    applyTheme("light");
    expect(localStorage.getItem("devflow.theme")).toBe("light");
  });

  it("initTheme reads from localStorage", () => {
    localStorage.setItem("devflow.theme", "light");
    const result = initTheme();
    expect(result).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("initTheme defaults to dark when nothing stored", () => {
    const result = initTheme();
    expect(result).toBe("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});
