'use client';

import {
  PRESENCE_STATUS_LABELS,
  type PresenceSnapshot,
  type PresenceStatus,
} from '@city-manager/shared';

export function OnlineIndicator({
  presence,
  size = 'md',
  showLabel = false,
}: {
  presence?: PresenceSnapshot | PresenceStatus | null;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}) {
  const status: PresenceStatus = typeof presence === 'string'
    ? presence
    : presence?.status ?? 'offline';

  const title = typeof presence === 'object' && presence?.lastSeenAt
    ? `${PRESENCE_STATUS_LABELS[status]} · ${new Date(presence.lastSeenAt).toLocaleString('fa-IR')}`
    : PRESENCE_STATUS_LABELS[status];

  return (
    <span
      className={`online-indicator size-${size} status-${status}`}
      title={title}
      aria-label={PRESENCE_STATUS_LABELS[status]}
    >
      <span className="online-indicator-dot" aria-hidden />
      {showLabel && <span className="online-indicator-label">{PRESENCE_STATUS_LABELS[status]}</span>}
    </span>
  );
}
