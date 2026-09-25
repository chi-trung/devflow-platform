// Dashboard screenshot for the landing page (ScreenshotShowcase <picture>,
// og:image, JSON-LD). Pure node, zero npm dependencies.
//
// Flow:
//   1. Spawns `npx vite --port 5199` (dev server, so /demo/board exists).
//   2. Polls http://localhost:5199/demo/board until 200.
//   3. Finds an Edge/Chrome binary (where.exe + common Windows paths +
//      linux/mac fallbacks) and runs it headless:
//        --headless --disable-gpu --hide-scrollbars
//        --window-size=1869,842 --force-device-scale-factor=1
//        --screenshot=<abs path to landing-opt.png>
//   4. Verifies the PNG IHDR is exactly 1869x842 and under ~1MB.
//   5. WebP: only when cwebp or ffmpeg is available; otherwise keeps the old
//      landing.webp untouched and prints a manual one-liner (exit 0).
//
// Never fakes an image: no browser binary -> old files untouched + manual
// command printed, exit 0.

import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, statSync, copyFileSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WIDTH = 1869;
const HEIGHT = 842;
const PORT = 5199;

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, "..");
const publicDir = join(frontendDir, "public");
const pngOut = join(publicDir, "landing-opt.png");
const webpOut = join(publicDir, "landing.webp");

function log(...args) {
  console.log("[capture-dashboard]", ...args);
}

function findBrowser() {
  const candidates = [];
  if (process.platform === "win32") {
    try {
      const out = execFileSync("where", ["msedge"], { encoding: "utf8" });
      for (const line of out.split(/\r?\n/)) {
        const p = line.trim();
        if (p) candidates.push(p);
      }
    } catch {}
    try {
      const out = execFileSync("where", ["chrome"], { encoding: "utf8" });
      for (const line of out.split(/\r?\n/)) {
        const p = line.trim();
        if (p) candidates.push(p);
      }
    } catch {}
    candidates.push(
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    );
  } else {
    for (const bin of ["microsoft-edge", "msedge", "google-chrome", "chromium", "chromium-browser"]) {
      try {
        const out = execFileSync("which", [bin], { encoding: "utf8" }).trim();
        if (out) candidates.push(out);
      } catch {}
    }
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );
  }
  for (const c of candidates) {
    try {
      if (c && existsSync(c)) return c;
    } catch {}
  }
  return null;
}

function hasBinary(name) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [name], {
    stdio: "ignore",
  });
  return r.status === 0;
}

function readPngSize(path) {
  const buf = readFileSync(path);
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error("not a valid PNG file");
  }
  // IHDR: width at offset 16, height at offset 20 (big-endian).
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height, bytes: buf.length };
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    log("No Edge/Chrome binary found — leaving existing images untouched.");
    log("Manual step on a machine with Edge/Chrome:");
    log(`  cd frontend && npx vite --port ${PORT} &`);
    log(`  "<edge-or-chrome>" --headless --disable-gpu --hide-scrollbars --window-size=${WIDTH},${HEIGHT} --force-device-scale-factor=1 --screenshot="${pngOut}" http://localhost:${PORT}/demo/board`);
    log("  then convert landing-opt.png to landing.webp (Squoosh.app or: cwebp -q 80 landing-opt.png -o landing.webp)");
    return;
  }
  log("browser:", browser);

  const server = spawn("npx", ["vite", "--port", String(PORT)], {
    cwd: frontendDir,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOut = "";
  server.stdout?.on("data", (d) => { serverOut += String(d); });
  server.stderr?.on("data", (d) => { serverOut += String(d); });

  const stopServer = () => {
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        server.kill("SIGTERM");
      }
    } catch {}
  };
  process.on("exit", stopServer);

  try {
    const url = `http://localhost:${PORT}/demo/board`;
    log("waiting for dev server:", url);
    const ready = await waitForServer(url);
    if (!ready) {
      log("dev server did not answer in time. Output:\n" + serverOut.slice(-2000));
      process.exitCode = 1;
      return;
    }
    // Let the dev server finish its first compile before screenshotting.
    await new Promise((r) => setTimeout(r, 2500));

    log("capturing screenshot…");
    const shot = spawnSync(
      browser,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        `--window-size=${WIDTH},${HEIGHT}`,
        "--force-device-scale-factor=1",
        // Wait for the React boot (locale chunk + lazy route + splash swap)
        // to finish before capturing — otherwise the shot fires on a blank
        // page (~9KB PNG).
        "--virtual-time-budget=15000",
        "--run-all-compositor-stages-before-draw",
        `--screenshot=${pngOut}`,
        url,
      ],
      { timeout: 90000, stdio: "inherit" },
    );
    if (shot.status !== 0) {
      log("browser screenshot failed with status", shot.status);
      process.exitCode = 1;
      return;
    }

    const info = readPngSize(pngOut);
    log(`PNG: ${info.width}x${info.height}, ${(info.bytes / 1024).toFixed(0)}KB`);
    if (info.width !== WIDTH || info.height !== HEIGHT) {
      log(`WARNING: expected ${WIDTH}x${HEIGHT} — keeping file but check --window-size support.`);
    }
    if (info.bytes > 1024 * 1024) {
      log("WARNING: PNG exceeds 1MB — consider compressing before shipping.");
    }

    if (hasBinary("cwebp")) {
      const r = spawnSync("cwebp", ["-q", "80", pngOut, "-o", webpOut], { stdio: "inherit" });
      if (r.status === 0) {
        const bytes = statSync(webpOut).size;
        log(`WebP written: ${(bytes / 1024).toFixed(0)}KB`);
      } else {
        log("cwebp failed — leaving old landing.webp untouched.");
      }
    } else if (hasBinary("ffmpeg")) {
      const r = spawnSync(
        "ffmpeg",
        ["-y", "-i", pngOut, "-c:v", "libwebp", "-q:v", "80", webpOut],
        { stdio: "inherit" },
      );
      if (r.status === 0) {
        const bytes = statSync(webpOut).size;
        log(`WebP written via ffmpeg: ${(bytes / 1024).toFixed(0)}KB`);
      } else {
        log("ffmpeg webp convert failed — leaving old landing.webp untouched.");
      }
    } else {
      // landing.webp must stay a VALID webp — never copy a PNG over it.
      copyFileSync(pngOut, join(publicDir, "landing-opt.png"));
      log("No cwebp/ffmpeg found — landing-opt.png updated, landing.webp left as-is.");
      log("Manual webp step: open https://squoosh.app, drop in landing-opt.png,");
      log("export as WebP (q~80) to frontend/public/landing.webp, or run:");
      log(`  cwebp -q 80 "${pngOut}" -o "${webpOut}"`);
    }
  } finally {
    stopServer();
  }
}

await main();
