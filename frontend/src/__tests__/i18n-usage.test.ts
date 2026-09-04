// Complements i18n-parity.test.ts: parity only checks en ↔ vi consistency,
// this catches keys *called* in source that don't exist in either catalog —
// the class of bug that used to surface as raw "board.selectAllColumn"
// strings in the UI. Mirrors scripts/check-i18n.mjs (static keys only;
// dynamic `${...}` keys are inherently uncheckable here).
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import en from "../i18n/en.json";
import vi from "../i18n/vi.json";

function leafKeys(obj: Record<string, unknown>, prefix = "", out = new Set<string>()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) leafKeys(v as Record<string, unknown>, path, out);
    else out.add(path);
  }
  return out;
}

const enKeys = leafKeys(en as Record<string, unknown>);
const viKeys = leafKeys(vi as Record<string, unknown>);

const PLURAL_SUFFIXES = ["_one", "_other", "_zero", "_two", "_few", "_many"] as const;

function hasKey(set: Set<string>, key: string): boolean {
  if (set.has(key)) return true;
  return PLURAL_SUFFIXES.some((suffix) => set.has(key + suffix));
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(p);
  }
  return out;
}

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY_RE = /\bt\(\s*(["'`])((?:(?!\1)[^\\])*)\1/g;

function collectMissing(): { key: string; files: string[] }[] {
  const report = new Map<string, Set<string>>();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    const rel = file.replace(/\\/g, "/").split("/src/")[1] ?? file;
    let m: RegExpExecArray | null;
    while ((m = KEY_RE.exec(text))) {
      const key = m[2];
      if (!key || key.includes("${")) continue; // dynamic keys can't be statically verified
      if (!hasKey(enKeys, key) || !hasKey(viKeys, key)) {
        (report.get(key) ?? report.set(key, new Set()).get(key)!).add(rel);
      }
    }
  }
  return [...report.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, files]) => ({ key, files: [...files] }));
}

describe("i18n usage", () => {
  it("every statically-called t() key exists in en.json and vi.json", () => {
    const missing = collectMissing();
    const summary = missing
      .map(({ key, files }) => `${key}\n   -> ${files.join("\n   -> ")}`)
      .join("\n");
    // Assert-style failure listing every offender at once (faster fixes than
    // failing on the first).
    expect(summary, `Missing i18n keys:\n${summary}`).toBe("");
  });
});
