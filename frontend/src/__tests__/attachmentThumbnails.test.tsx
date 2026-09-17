import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, waitFor } from "@testing-library/react";
import {
  useAttachmentPreviews,
  AttachmentRowThumb,
} from "../components/board/AttachmentThumbnails";
import type { TaskItemResponse } from "../types/api";

// Object-URL leak probe (wave-35). The card's thumbnail strip and the detail
// panel's row thumb both fetch blob URLs via getAttachmentObjectUrl. Each
// effect run must revoke every URL IT created - including ones whose fetch
// resolved after cleanup already ran. A shared module ref cannot do that: the
// late URL lands in the ref after cleanup emptied it (leak), or is dropped by
// the `cancelled` guard without ever being revoked (leak).

const revoke = vi.fn();

vi.stubGlobal("URL", {
  createObjectURL: (blob: Blob) => `blob:probe/${String(blob.size)}`,
  revokeObjectURL: revoke,
} as unknown as typeof URL);

const getter = vi.fn();
vi.mock("../lib/api", () => ({
  getAttachmentObjectUrl: (...args: unknown[]) => getter(...args),
}));

type Previews = NonNullable<TaskItemResponse["attachmentSummary"]>["previews"];

// The effect chains Promise.all over the fetches, so the .then that revokes
// late URLs sits one microtask deeper than a plain .then — flush generously
// rather than guessing an exact depth.
async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

beforeEach(() => {
  revoke.mockClear();
  getter.mockReset();
});

describe("useAttachmentPreviews revokes late-resolving URLs (wave-35)", () => {
  const previews: Previews = [
    { id: "a1", contentType: "image/png" },
  ];

  it("revokes when the fetch resolves after unmount", async () => {
    let resolveFetch!: (url: string | null) => void;
    getter.mockImplementation(
      () => new Promise((res) => (resolveFetch = res as typeof res)),
    );

    const { unmount } = renderHook(() =>
      useAttachmentPreviews({
        workspaceId: "w1",
        projectId: "p1",
        taskId: "t1",
        previews,
      }),
    );

    // Unmount BEFORE the fetch settles - this is the leak window.
    unmount();
    resolveFetch("blob:probe/10");
    await flush();

    expect(revoke).toHaveBeenCalledWith("blob:probe/10");
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("revokes on prop swap, not only on full unmount", async () => {
    getter.mockResolvedValue("blob:probe/first");
    const first: Previews = [
      { id: "a1", contentType: "image/png" },
    ];
    const second: Previews = [
      { id: "a2", contentType: "image/png" },
    ];

    const { rerender } = renderHook(
      ({ previews }: { previews: Previews }) =>
        useAttachmentPreviews({
          workspaceId: "w1",
          projectId: "p1",
          taskId: "t1",
          previews,
        }),
      { initialProps: { previews: first } },
    );

    await flush();

    getter.mockResolvedValue("blob:probe/second");
    rerender({ previews: second });
    await flush();

    // The URL from the superseded effect run must be revoked.
    expect(revoke).toHaveBeenCalledWith("blob:probe/first");
  });

  it("renders the resolved preview while mounted", async () => {
    getter.mockResolvedValue("blob:probe/10");
    const { result, unmount } = renderHook(() =>
      useAttachmentPreviews({
        workspaceId: "w1",
        projectId: "p1",
        taskId: "t1",
        previews,
      }),
    );
    await waitFor(() =>
      expect(result.current).toEqual([{ id: "a1", url: "blob:probe/10" }]),
    );
    unmount();
  });
});

describe("AttachmentRowThumb revokes its URL (wave-35)", () => {
  it("does not leak when the row unmounts mid-fetch", async () => {
    let resolveFetch!: (url: string | null) => void;
    getter.mockImplementation(
      () => new Promise((res) => (resolveFetch = res as typeof res)),
    );

    const { unmount } = render(
      <AttachmentRowThumb
        workspaceId="w1"
        projectId="p1"
        taskId="t1"
        attachmentId="a1"
        contentType="image/png"
      />,
    );

    unmount();
    resolveFetch("blob:probe/10");
    await flush();

    expect(revoke).toHaveBeenCalledWith("blob:probe/10");
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("mounts the image once the URL resolves", async () => {
    getter.mockResolvedValue("blob:probe/10");
    const { container, unmount } = render(
      <AttachmentRowThumb
        workspaceId="w1"
        projectId="p1"
        taskId="t1"
        attachmentId="a1"
        contentType="image/png"
      />,
    );
    await waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("src")).toBe(
        "blob:probe/10",
      ),
    );
    unmount();
  });

  it("renders nothing for non-image attachments", () => {
    getter.mockResolvedValue("blob:probe/10");
    const { container, unmount } = render(
      <AttachmentRowThumb
        workspaceId="w1"
        projectId="p1"
        taskId="t1"
        attachmentId="a1"
        contentType="application/pdf"
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    unmount();
  });
});
