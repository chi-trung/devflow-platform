// Scan for hardcoded (non-t()) accessible-name strings remaining in components
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "__tests__" && f !== "node_modules") walk(p); }
    else if (/\.tsx?$/.test(f)) files.push(p);
  }
})("src");
const re = /(aria-label|placeholder|title|aria-describedby|aria-labelledby)="([^"{]+)"/g;
let count = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(re)) {
    const val = m[2].trim();
    if (!val || /^\s*$/.test(val)) continue;
    // skip known non-text values
    console.log(`${f}: ${m[1]}="${val}"`);
    count++;
  }
}
console.log(`TOTAL ${count}`);
