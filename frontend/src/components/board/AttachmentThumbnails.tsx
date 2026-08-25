import { useEffect, useRef, useState } from "react";
import { getAttachmentObjectUrl } from "../../lib/api";
import type { TaskItemResponse } from "../../types/api";

/**
 * Lazy-loads object URLs for image attachment previews (B32.2).
 *
 * Auth constraint: attachment bytes only come from the authenticated
 * /download endpoint, so `<img src>` can't fetch them — we must go through
 * fetch→blob→URL.createObjectURL. URLs are revoked on unmount to avoid leaks.
 */

interface UseAttachmentPreviewsOptions {
  workspaceId: string;
  projectId: string;
  taskId: string;
  previews?: NonNullable<TaskItemResponse["attachmentSummary"]>["previews"];
}

interface PreviewImage {
  id: string;
  url: string;
}

/** Fetch object URLs for the given image previews (lazily, in one batch). */
export function useAttachmentPreviews({
  workspaceId,
  projectId,
  taskId,
  previews,
}: UseAttachmentPreviewsOptions): PreviewImage[] {
  const [urls, setUrls] = useState<Record<string, string>>({});
  // Track every URL this hook has created so cleanup revokes them even when
  // the URL map was populated after the effect body ran.
  const createdRef = useRef<string[]>([]);

  useEffect(() => {
    if (!previews || previews.length === 0) {
      setUrls({});
      return;
    }
    let cancelled = false;

    Promise.all(
      previews.map(async (preview) => {
        const url = await getAttachmentObjectUrl(
          workspaceId,
          projectId,
          taskId,
          preview.id,
        );
        if (url) createdRef.current.push(url);
        return { id: preview.id, url };
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const { id, url } of results) {
        if (url) next[id] = url;
      }
      setUrls(next);
    });

    return () => {
      cancelled = true;
      for (const url of createdRef.current) {
        URL.revokeObjectURL(url);
      }
      createdRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, projectId, taskId, previews]);

  return (previews ?? [])
    .filter((p) => urls[p.id])
    .map((p) => ({ id: p.id, url: urls[p.id] }));
}

/** Image preview for a single attachment row in the detail panel. */
export function AttachmentRowThumb({
  workspaceId,
  projectId,
  taskId,
  attachmentId,
  contentType,
}: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  attachmentId: string;
  contentType: string;
}) {
  const isImage = contentType.startsWith("image/");
  const [url, setUrl] = useState<string | null>(null);
  const createdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    void getAttachmentObjectUrl(workspaceId, projectId, taskId, attachmentId).then(
      (u) => {
        if (!cancelled && u) {
          createdRef.current = u;
          setUrl(u);
        }
      },
    );
    return () => {
      cancelled = true;
      if (createdRef.current) {
        URL.revokeObjectURL(createdRef.current);
        createdRef.current = null;
      }
    };
  }, [workspaceId, projectId, taskId, attachmentId, isImage]);

  if (!isImage) return null;
  return (
    <span className="relative shrink-0">
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-9 rounded-md object-cover ring-1 ring-border"
        />
      ) : (
        <span className="block size-9 animate-pulse rounded-md bg-elevated" />
      )}
    </span>
  );
}

/** Horizontal strip of small image thumbnails + a "+N" overflow chip. */
export function ThumbnailStrip({
  previews,
  count,
}: {
  previews: PreviewImage[];
  count: number;
}) {
  if (previews.length === 0) return null;
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      {previews.slice(0, 3).map((preview) => (
        <img
          key={preview.id}
          src={preview.url}
          alt=""
          loading="lazy"
          className="size-10 shrink-0 rounded-md object-cover ring-1 ring-border"
        />
      ))}
      {count > previews.length && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-elevated font-mono text-[11px] font-semibold text-muted-foreground">
          +{count - previews.length}
        </span>
      )}
    </div>
  );
}
