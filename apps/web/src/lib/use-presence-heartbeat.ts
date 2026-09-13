'use client';

import { useEffect } from 'react';
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from '@city-manager/shared';
import { sendPresenceHeartbeat } from '@/lib/presence-api';

export function usePresenceHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      void sendPresenceHeartbeat();
    };

    tick();
    const id = window.setInterval(tick, PRESENCE_HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);
}
