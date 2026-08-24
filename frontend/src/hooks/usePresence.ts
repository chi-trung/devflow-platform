import { useEffect, useMemo, useState } from "react";
import { createProjectConnection } from "../lib/realtime";
import type { WorkspaceMemberResponse } from "../types/api";

export interface PresenceUser {
  userId: string;
  username: string;
  displayName: string | null;
}

const MAX_VISIBLE = 5;

export function usePresence(
  projectId: string | undefined,
  members: WorkspaceMemberResponse[] = [],
  currentUserId?: string | null,
) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [currentUserPresence, setCurrentUserPresence] = useState<string | null>(null);

  const memberMap = useMemo(() => {
    const map = new Map<string, WorkspaceMemberResponse>();
    for (const member of members) {
      map.set(member.userId, member);
    }
    return map;
  }, [members]);

  useEffect(() => {
    if (!projectId) return;
    const connection = createProjectConnection(projectId);

    const selfId = currentUserId ?? null;

    function handleUserJoined(payload: unknown) {
      const record = payload as Record<string, unknown>;
      const userId = typeof record.userId === "string" ? record.userId : null;
      if (!userId || userId === selfId) return;
      setOnlineIds((current) => {
        const next = new Set(current);
        next.add(userId);
        return next;
      });
    }

    function handleUserLeft(payload: unknown) {
      const record = payload as Record<string, unknown>;
      const userId = typeof record.userId === "string" ? record.userId : null;
      if (!userId) return;
      setOnlineIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    }

    connection.on("user-joined", handleUserJoined);
    connection.on("user-left", handleUserLeft);

    connection
      .start()
      .then(() => {
        if (selfId) {
          setCurrentUserPresence(selfId);
          connection.invoke("JoinProject", projectId).catch(() => {});
        }
      })
      .catch(() => {
        // board still works without realtime
      });

    return () => {
      connection.off("user-joined", handleUserJoined);
      connection.off("user-left", handleUserLeft);
      void connection.stop();
    };
  }, [projectId, currentUserId]);

  const visibleUsers = useMemo(() => {
    const users: PresenceUser[] = [];
    for (const id of onlineIds) {
      const member = memberMap.get(id);
      if (member) {
        users.push({
          userId: id,
          username: member.username,
          displayName: member.displayName,
        });
      }
    }
    return users.slice(0, MAX_VISIBLE);
  }, [onlineIds, memberMap]);

  const remainingCount = Math.max(0, onlineIds.size - MAX_VISIBLE);

  return {
    onlineIds,
    currentUserPresence,
    visibleUsers,
    remainingCount,
    totalOnline: onlineIds.size,
  };
}
