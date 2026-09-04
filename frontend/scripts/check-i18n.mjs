// One-off audit: find t("...") keys referenced in src but missing from en.json/vi.json
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const en = JSON.parse(readFileSync(new URL("../src/i18n/en.json", import.meta.url), "utf8"));
const vi = JSON.parse(readFileSync(new URL("../src/i18n/vi.json", import.meta.url), "utf8"));

function leafKeys(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) leafKeys(v, path, out);
    else out.add(path);
  }
  return out;
}
const enKeys = leafKeys(en);
const viKeys = leafKeys(vi);

function hasKey(set, key) {
  if (set.has(key)) return true;
  // i18next plural: key_one / key_other (also key_zero / few / many for vi)
  for (const suffix of ["_one", "_other", "_zero", "_two", "_few", "_many"]) {
    if (set.has(key + suffix)) return true;
  }
  return false;
}

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) yield p;
  }
}

const report = {};
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  const rel = file.replace(/\\/g, "/").split("/src/")[1];
  const re = /\bt\(\s*(["'`])((?:(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(text))) {
    const key = m[2];
    if (!key) continue;
    const missEn = !hasKey(enKeys, key);
    const missVi = !hasKey(viKeys, key);
    if (missEn || missVi) {
      (report[key] ??= { files: new Set(), missEn, missVi }).files.add(rel);
    }
  }
}

const entries = Object.entries(report).sort();
if (entries.length === 0) {
  console.log("OK — no missing keys");
} else {
  for (const [key, info] of entries) {
    console.log(`${key}  [en:${info.missEn ? "MISSING" : "ok"} vi:${info.missVi ? "MISSING" : "ok"}]`);
    for (const f of info.files) console.log(`   -> ${f}`);
  }
  console.log(`\nTotal missing keys: ${entries.length}`);
}
