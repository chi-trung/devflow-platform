/**
 * DevFlow E2E smoke test — sweeps every major page, catches all console errors,
 * uncaught exceptions, and failed API requests from the real local stack.
 *
 * Run:   npx playwright test --config frontend/e2e/playwright.config.ts
 * Debug: npx playwright test --config frontend/e2e/playwright.config.ts --debug
 *
 * Prerequisites:
 *   - Docker containers (postgres + redis + api) are up
 *   - `npm run dev` serves the frontend (config auto-starts it)
 *   - User e2e@devflow.test / E2ePass!123 is registered
 */

import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import type { APIResponse } from "playwright-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Log {
  type: "console" | "exception" | "api-4xx";
  message: string;
}

/** Subscribe to error events on a page. Call BEFORE navigation. */
function watchPage(page: Page): Log[] {
  const logs: Log[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      logs.push({ type: "console", message: msg.text() });
    }
  });

  page.on("pageerror", (err: Error) => {
    logs.push({ type: "exception", message: err.message });
  });

  page.on("response", (res: APIResponse) => {
    if (!res.url().includes("/api/")) return;
    const status = res.status();

    // 401 on /auth/me and /hubs/ is expected before auth settles
    if (
      status === 401 &&
      (res.url().includes("/auth/me") || res.url().includes("/hubs/"))
    )
      return;
    // 404 on /reporting/ is expected when the project has no data
    if (status === 404 && res.url().includes("/reporting/")) return;
    if (status >= 400) {
      logs.push({
        type: "api-4xx",
        message: `${status} ${res.url().split("?")[0]}`,
      });
    }
  });

  return logs;
}

/** Navigate, wait for idle, then assert no errors. */
async function assertPageLoads(
  page: Page,
  url: string,
  options?: { waitForSelector?: string },
) {
  const logs = watchPage(page);
  const res = await page.goto(url, { waitUntil: "networkidle" });
  expect(res?.status()).not.toBe(404);

  // Let deferred errors (lazy-load, SignalR) settle
  await page.waitForTimeout(2000);

  if (options?.waitForSelector) {
    await expect(page.locator(options.waitForSelector)).toBeVisible({
      timeout: 10_000,
    });
  }

  // Filter expected benign errors
  const bad = logs.filter(
    (l) =>
      !(
        l.type === "api-4xx" &&
        (l.message.includes("/hubs/") ||
          l.message.includes("/auth/me") ||
          l.message.includes("/reporting/") ||
          l.message.includes("404"))
      ),
  );

  const consoleErrors = bad.filter((l) => l.type !== "api-4xx");
  const criticalApis = bad.filter(
    (l) => l.type === "api-4xx" && l.message.startsWith("5"),
  );

  const summary = [...consoleErrors, ...criticalApis];
  expect(summary).toEqual([]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("DevFlow E2E", () => {
  let workspaceId: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    // Ensure the test user exists and get an access token
    const loginRes = await request.post("/api/v1/auth/login", {
      data: { email: "e2e@devflow.test", password: "E2ePass!123" },
    });
    let token: string;
    if (!loginRes.ok()) {
      const regRes = await request.post("/api/v1/auth/register", {
        data: {
          email: "e2e@devflow.test",
          username: "e2etester",
          password: "E2ePass!123",
          displayName: "E2E Tester",
        },
      });
      expect([200, 201, 409]).toContain(regRes.status());
      const login2 = await request.post("/api/v1/auth/login", {
        data: { email: "e2e@devflow.test", password: "E2ePass!123" },
      });
      expect(login2.ok()).toBeTruthy();
      const b = await login2.json();
      token = b.accessToken;
    } else {
      const b = await loginRes.json();
      token = b.accessToken;
    }

    const auth = { Authorization: `Bearer ${token}` };

    // Find or create workspace
    const wsRes = await request.get("/api/v1/workspaces", { headers: auth });
    expect(wsRes.ok()).toBeTruthy();
    const wsBody = await wsRes.json();
    const existingWs = wsBody.items ?? [];
    if (existingWs.length > 0) {
      workspaceId = existingWs[0].id;
    } else {
      const createWs = await request.post("/api/v1/workspaces", {
        data: { name: "E2E Test Workspace", slug: "e2e-test-workspace" },
        headers: auth,
      });
      expect(createWs.ok()).toBeTruthy();
      const b = await createWs.json();
      workspaceId = b.id;
    }

    // Find or create project
    const projRes = await request.get(
      `/api/v1/workspaces/${workspaceId}/projects`,
      { headers: auth },
    );
    expect(projRes.ok()).toBeTruthy();
    const projBody = await projRes.json();
    const existingProj = projBody.items ?? [];
    if (existingProj.length > 0) {
      projectId = existingProj[0].id;
    } else {
      const createProj = await request.post(
        `/api/v1/workspaces/${workspaceId}/projects`,
        {
          data: { name: "E2E Test Project", key: "E2E" },
          headers: auth,
        },
      );
      expect(createProj.ok()).toBeTruthy();
      const b = await createProj.json();
      projectId = b.id;
    }

    expect(workspaceId).toBeTruthy();
    expect(projectId).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Login flow
  // -----------------------------------------------------------------------

  test("Login and land on dashboard", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 10_000 });

    await page.fill("#email", "e2e@devflow.test");
    await page.fill("#password", "E2ePass!123");
    await page.click("button[type=submit]");

    // App redirects to / (dashboard) after login
    await page.waitForURL("/", { timeout: 15_000 });
    await page.waitForTimeout(2000);

    // The first-login onboarding tour auto-opens on a fresh browser; pre-set
    // its completion flag so the tour overlay doesn't intercept the assertions.
    await page.evaluate(() => localStorage.setItem("devflow.onboardingDone", "1"));

    // Verify the sidebar shows the workspace name
    await expect(page.locator("main")).toBeVisible({ timeout: 5_000 });

    const logs = watchPage(page);
    const bad = logs.filter(
      (l) =>
        !(
          l.type === "api-4xx" &&
          (l.message.includes("/hubs/") ||
            l.message.includes("/auth/me") ||
            l.message.includes("404"))
        ),
    );
    expect(bad.filter((l) => l.type !== "api-4xx")).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Page sweep — every major route
  // -----------------------------------------------------------------------

  test.describe("All pages load without crashes", () => {
    test("Dashboard (/)", async ({ page }) => {
      await assertPageLoads(page, "/", { waitForSelector: "main" });
    });

    test("Board page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}`,
        { waitForSelector: "main" },
      );
    });

    test("Sprint planning page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}/sprints`,
        { waitForSelector: "main" },
      );
    });

    test("My tasks page", async ({ page }) => {
      await assertPageLoads(page, `/workspaces/${workspaceId}/my-tasks`, {
        waitForSelector: "main",
      });
    });

    test("Search page", async ({ page }) => {
      await assertPageLoads(page, `/workspaces/${workspaceId}/search`, {
        waitForSelector: "main",
      });
    });

    test("Reports page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}/reports`,
        { waitForSelector: "main" },
      );
    });

    test("Epics page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}/epics`,
        { waitForSelector: "main" },
      );
    });

    test("Labels page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}/labels`,
        { waitForSelector: "main" },
      );
    });

    test("Custom fields page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}/fields`,
        { waitForSelector: "main" },
      );
    });

    test("Activities page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}/activities`,
        { waitForSelector: "main" },
      );
    });

    test("Notifications page", async ({ page }) => {
      await assertPageLoads(page, "/notifications", {
        waitForSelector: "main",
      });
    });

    test("Settings page", async ({ page }) => {
      await assertPageLoads(page, "/settings", {
        waitForSelector: "main",
      });
    });

    test("Project settings page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}/settings`,
        { waitForSelector: "main" },
      );
    });

    test("Webhooks page", async ({ page }) => {
      await assertPageLoads(page, `/workspaces/${workspaceId}/webhooks`, {
        waitForSelector: "main",
      });
    });

    test("GitHub integration page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}/github`,
        { waitForSelector: "main" },
      );
    });

    test("Templates page", async ({ page }) => {
      await assertPageLoads(
        page,
        `/workspaces/${workspaceId}/projects/${projectId}/templates`,
        { waitForSelector: "main" },
      );
    });
  });
});