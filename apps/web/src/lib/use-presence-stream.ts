'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  PRESENCE_POLL_INTERVAL_MS,
  type PresenceSnapshot,
  type PresenceStreamEvent,
} from '@city-manager/shared';
import { fetchUsersPresence, presenceStreamUrl } from '@/lib/presence-api';

type PresenceStreamHandlers = {
  onSnapshot: (data: Record<string, PresenceSnapshot>) => void;
  onPresence: (snapshot: PresenceSnapshot) => void;
};

export function usePresenceStream(
  userIds: string[],
  enabled: boolean,
  handlers: PresenceStreamHandlers,
) {
  const idsKey = useMemo(
    () => userIds.slice().sort().join(','),
    [userIds],
  );
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || userIds.length === 0) return;

    let cancelled = false;
    let pollId: number | undefined;
    let source: EventSource | undefined;

    const applyEvent = (payload: PresenceStreamEvent) => {
      if (payload.type === 'ping') return;
      if (payload.type === 'snapshot') {
        handlersRef.current.onSnapshot(payload.data);
        return;
      }
      handlersRef.current.onPresence(payload.snapshot);
    };

    const poll = () => {
      void fetchUsersPresence(userIds).then((res) => {
        if (cancelled || !res.success || !res.data) return;
        handlersRef.current.onSnapshot(res.data);
      });
    };

    const startPoll = () => {
      if (pollId != null) return;
      poll();
      pollId = window.setInterval(poll, PRESENCE_POLL_INTERVAL_MS);
    };

    if (typeof EventSource === 'undefined') {
      startPoll();
      return () => {
        cancelled = true;
        if (pollId != null) window.clearInterval(pollId);
      };
    }

    source = new EventSource(presenceStreamUrl(userIds), { withCredentials: true });
    source.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data) as PresenceStreamEvent;
        applyEvent(payload);
      } catch {
        /* ignore malformed frames */
      }
    };
    source.onerror = () => {
      source?.close();
      source = undefined;
      startPoll();
    };

    return () => {
      cancelled = true;
      source?.close();
      if (pollId != null) window.clearInterval(pollId);
    };
  }, [enabled, idsKey, userIds]);
}
