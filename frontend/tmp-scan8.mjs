// Find elements with focus:outline-none but no focus-visible / ring replacement
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "__tests__" && f !== "node_modules") walk(p); }
    else if (/\.tsx$/.test(f)) files.push(f === "x" ? p : p);
  }
})("src");
let hits = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((ln, i) => {
    if (!/focus:outline-none|outline-none/.test(ln)) return;
    // check the surrounding element region (up to 6 lines) for a focus ring replacement
    const region = lines.slice(Math.max(0, i - 6), i + 7).join(" ");
    if (!/focus-visible|focus:ring|focus:border|not-sr-only|appearance-none/.test(region)) {
      console.log(`${f}:${i + 1}: ${ln.trim().slice(0, 110)}`);
      hits++;
    }
  });
}
console.log(`TOTAL ${hits}`);
