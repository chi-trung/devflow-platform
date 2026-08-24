import { describe, it, expect } from "vitest";
import en from "../i18n/en.json";
import vi from "../i18n/vi.json";

function getLeafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...getLeafKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe("i18n key parity", () => {
  it("vi.json has all leaf keys from en.json", () => {
    const enKeys = getLeafKeys(en);
    const viKeys = getLeafKeys(vi);
    const viKeySet = new Set(viKeys);

    const missing = enKeys.filter((k) => !viKeySet.has(k));

    if (missing.length > 0) {
      console.error("Missing keys in vi.json:", missing);
    }
    expect(missing).toEqual([]);
  });

  it("en.json has all leaf keys from vi.json", () => {
    const enKeys = getLeafKeys(en);
    const viKeys = getLeafKeys(vi);
    const enKeySet = new Set(enKeys);

    const extra = viKeys.filter((k) => !enKeySet.has(k));

    if (extra.length > 0) {
      console.error("Extra keys in vi.json not in en.json:", extra);
    }
    expect(extra).toEqual([]);
  });

  it("top-level sections match between en and vi", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort());
  });
});
