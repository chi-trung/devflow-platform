import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { WebhooksPage } from "../pages/WebhooksPage";
import { createWebhook, getDeadLetterMessages, getWebhooks } from "../lib/api";
import type { DeadLetterMessageDto, WebhookResponse } from "../types/api";

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
vi.mock("../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: vi.fn() }),
}));
vi.mock("../hooks/useApi", () => ({
  useApi: () => ({ data: { role: "Owner" }, error: null, reload: vi.fn() }),
}));
vi.mock("../lib/api", () => ({
  api: vi.fn(),
  getWebhooks: vi.fn(),
  getDeadLetterMessages: vi.fn(),
  createWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  testWebhook: vi.fn(),
  replayDeadLetterMessage: vi.fn(),
  replayAllDeadLetterMessages: vi.fn(),
  purgeDeadLetterMessages: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function webhook(workspace: string): WebhookResponse {
  return {
    id: workspace,
    url: `https://${workspace}.example/webhook`,
    events: ["task.created"],
    isActive: true,
    createdAtUtc: "2026-09-17T00:00:00Z",
  };
}
function deadLetter(workspace: string): DeadLetterMessageDto {
  return {
    id: workspace,
    type: `event-${workspace}`,
    retryCount: 5,
    occurredAtUtc: "2026-09-17T00:00:00Z",
    failedPermanentlyAt: "2026-09-17T01:00:00Z",
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/a/webhooks"]}>
      <Link to="/workspaces/b/webhooks">Switch workspace</Link>
      <Routes>
        <Route path="/workspaces/:workspaceId/webhooks" element={<WebhooksPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function switchWorkspace() {
  fireEvent.click(screen.getByRole("link", { name: "Switch workspace" }));
  await screen.findByText(webhook("b").url);
  await screen.findByText("event-b");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getWebhooks).mockImplementation(async (id) => [webhook(id)]);
  vi.mocked(getDeadLetterMessages).mockImplementation(async (id) => [deadLetter(id)]);
});
afterEach(cleanup);

describe("WebhooksPage workspace ownership", () => {
  it("ignores old list responses after the next workspace has loaded", async () => {
    const hooks = deferred<WebhookResponse[]>();
    const letters = deferred<DeadLetterMessageDto[]>();
    vi.mocked(getWebhooks).mockImplementation((id) =>
      id === "a" ? hooks.promise : Promise.resolve([webhook(id)]));
    vi.mocked(getDeadLetterMessages).mockImplementation((id) =>
      id === "a" ? letters.promise : Promise.resolve([deadLetter(id)]));
    renderPage();
    await switchWorkspace();

    await act(async () => {
      hooks.resolve([webhook("a")]);
      letters.resolve([deadLetter("a")]);
    });
    expect(screen.getByText(webhook("b").url)).toBeInTheDocument();
    expect(screen.getByText("event-b")).toBeInTheDocument();
    expect(screen.queryByText(webhook("a").url)).not.toBeInTheDocument();
    expect(screen.queryByText("event-a")).not.toBeInTheDocument();
  });

  it("ignores errors from the previous workspace", async () => {
    const hooks = deferred<WebhookResponse[]>();
    const letters = deferred<DeadLetterMessageDto[]>();
    vi.mocked(getWebhooks).mockImplementation((id) =>
      id === "a" ? hooks.promise : Promise.resolve([webhook(id)]));
    vi.mocked(getDeadLetterMessages).mockImplementation((id) =>
      id === "a" ? letters.promise : Promise.resolve([deadLetter(id)]));
    renderPage();
    await switchWorkspace();

    await act(async () => {
      hooks.reject(new Error("workspace A hooks failed"));
      letters.reject(new Error("workspace A queue failed"));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(webhook("b").url)).toBeInTheDocument();
    expect(screen.getByText("event-b")).toBeInTheDocument();
  });

  it("does not retain A's rows when B's reads fail", async () => {
    vi.mocked(getWebhooks).mockImplementation((id) => id === "a"
      ? Promise.resolve([webhook(id)]) : Promise.reject(new Error("B hooks failed")));
    vi.mocked(getDeadLetterMessages).mockImplementation((id) => id === "a"
      ? Promise.resolve([deadLetter(id)]) : Promise.reject(new Error("B queue failed")));
    renderPage();
    await screen.findByText(webhook("a").url);
    await screen.findByText("event-a");
    fireEvent.click(screen.getByRole("link", { name: "Switch workspace" }));
    await screen.findByText("B hooks failed");
    await screen.findByText("B queue failed");
    expect(screen.queryByText(webhook("a").url)).not.toBeInTheDocument();
    expect(screen.queryByText("event-a")).not.toBeInTheDocument();
  });

  it("keeps a late create refresh from A out of B's state", async () => {
    const created = deferred<WebhookResponse>();
    vi.mocked(createWebhook).mockReturnValue(created.promise);
    renderPage();
    await screen.findByText(webhook("a").url);
    fireEvent.click(screen.getByRole("button", { name: "webhook.create" }));
    fireEvent.change(screen.getByLabelText("webhook.urlLabel"), {
      target: { value: "https://created.example/webhook" },
    });
    fireEvent.click(screen.getByRole("button", { name: "task.created" }));
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));
    expect(createWebhook).toHaveBeenCalledWith("a", expect.objectContaining({
      url: "https://created.example/webhook",
    }));
    await switchWorkspace();
    await act(async () => { created.resolve(webhook("created")); });

    // The already-submitted operation may finish, but its refresh belongs to A.
    expect(getWebhooks).toHaveBeenLastCalledWith("a");
    expect(screen.getByText(webhook("b").url)).toBeInTheDocument();
    expect(screen.queryByText(webhook("a").url)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("webhook.urlLabel")).not.toBeInTheDocument();
  });
});
