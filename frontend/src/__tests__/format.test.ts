import { describe, it, expect } from "vitest";
import { formatMinutes, splitEmail } from "../lib/format";

describe("formatMinutes", () => {
  it("formats zero minutes", () => {
    expect(formatMinutes(0)).toBe("0m");
  });

  it("formats minutes only", () => {
    expect(formatMinutes(30)).toBe("30m");
    expect(formatMinutes(59)).toBe("59m");
  });

  it("formats hours only", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(480)).toBe("8h");
  });

  it("formats hours and minutes", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(125)).toBe("2h 5m");
    expect(formatMinutes(161)).toBe("2h 41m");
  });
});

describe("splitEmail", () => {
  it("splits at the last @ so the domain (with @) stays intact", () => {
    expect(splitEmail("nguyen.trung.2004@gmail.com")).toEqual({
      local: "nguyen.trung.2004",
      domain: "@gmail.com",
    });
  });

  it("splits short addresses the same way", () => {
    expect(splitEmail("a@b.c")).toEqual({ local: "a", domain: "@b.c" });
  });

  it("treats an address without a usable @ as a single local part", () => {
    expect(splitEmail("plaintext")).toEqual({ local: "plaintext", domain: "" });
    expect(splitEmail("@leading")).toEqual({ local: "@leading", domain: "" });
    expect(splitEmail("")).toEqual({ local: "", domain: "" });
  });
});
