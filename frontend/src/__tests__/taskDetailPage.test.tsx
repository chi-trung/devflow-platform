import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// Legacy full-page detail URL is a thin redirect onto the board's in-page
// overlay (?task=). Share links and old history entries must land on the
// board without mounting a second detail implementation.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

import { TaskDetailPage } from "../pages/TaskDetailPage";

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderRoute(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/projects/:projectId/tasks/:taskId"
          element={<TaskDetailPage />}
        />
        <Route
          path="/workspaces/:workspaceId/projects/:projectId"
          element={<LocationProbe />}
        />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function locationText() {
  const el = await waitFor(() => {
    const node = document.querySelector('[data-testid="location"]');
    expect(node).not.toBeNull();
    return node as HTMLElement;
  });
  return el.textContent ?? "";
}

describe("TaskDetailPage legacy route", () => {
  it("redirects to the board with ?task=", async () => {
    renderRoute("/workspaces/ws-1/projects/pr-9/tasks/t1");
    expect(await locationText()).toBe(
      "/workspaces/ws-1/projects/pr-9?task=t1",
    );
  });

  it("encodeURIComponent-escapes the task id into the query", async () => {
    // react-router path params cannot contain `/`; use a space-bearing id.
    renderRoute("/workspaces/ws-1/projects/pr-9/tasks/a%20b");
    expect(await locationText()).toBe(
      "/workspaces/ws-1/projects/pr-9?task=a%20b",
    );
  });

  it("renders no detail chrome while bouncing", async () => {
    renderRoute("/workspaces/ws-1/projects/pr-9/tasks/t1");
    await locationText();
    expect(screenQueryPanel()).toBeNull();
  });
});

function screenQueryPanel() {
  return document.querySelector('[data-testid="detail-panel"]');
}
