// Find div/span/li with onClick but no role and no tabIndex (mouse-only click targets)
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "__tests__" && f !== "node_modules") walk(p); }
    else if (/\.tsx$/.test(f)) files.push(p);
  }
})("src");
let hits = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/<(div|span|li|tr|td|p)\b/);
    if (!m) continue;
    // gather the JSX element's attribute region: this line until the closing '>' of the open tag
    let j = i, region = "";
    let depth = 0;
    for (; j < Math.min(i + 25, lines.length); j++) {
      region += lines[j];
      const opens = (lines[j].match(/\{/g) || []).length;
      const closes = (lines[j].match(/\}/g) || []).length;
      depth += opens - closes;
      if (depth <= 0 && /[>\s]/.test(lines[j].replace(/<\/?[a-zA-Z].*$/, (x) => x)) && j > i - 1 && /(^|[^-\w])>/.test(lines.slice(i, j + 1).join("\n"))) break;
      if (j > i && /(^|[^-])>/.test(lines[j])) break;
    }
    if (/onClick=/.test(region) && !/role=/.test(region) && !/tabIndex/.test(region) && !/as=/.test(region)) {
      console.log(`${f}:${i + 1}: <${m[1]} onClick ... (no role/tabIndex)`);
      hits++;
    }
  }
}
console.log(`TOTAL ${hits}`);
