'use client';

import type { ReactElement } from 'react';
import { parseClientPlatform, type ClientPlatform } from '@city-manager/shared';

const PLATFORM_ICONS: Record<ClientPlatform, ReactElement> = {
  windows: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M3 5.5L10.5 4.5V11.5H3V5.5ZM11.5 4.3L21 2.8V11.5H11.5V4.3ZM3 12.5H10.5V19.5L3 18.5V12.5ZM11.5 12.5H21V21.2L11.5 19.7V12.5Z" />
    </svg>
  ),
  macos: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  ),
  linux: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M12.5 2C9.5 2.2 7 4.5 6.6 7.4c-.9.2-1.7.7-2.3 1.4-.9 1-1.3 2.4-1.1 3.8.3 2.1 2 3.8 4.1 4.2-.1.6-.1 1.2 0 1.8-1.2.3-2.2 1-2.9 2-.5.8-.7 1.7-.5 2.6.3 1.5 1.5 2.7 3 3 1 .2 2-.1 2.8-.8.8.7 1.8 1 2.8.8 1.5-.3 2.7-1.5 3-3 .2-.9 0-1.8-.5-2.6-.7-1-1.7-1.7-2.9-2 .1-.6.1-1.2 0-1.8 2.1-.4 3.8-2.1 4.1-4.2.2-1.4-.2-2.8-1.1-3.8-.6-.7-1.4-1.2-2.3-1.4C17 4.5 14.5 2.2 12.5 2zm-1 3.2c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5zm2 0c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5z" />
    </svg>
  ),
  android: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M17.6 9.5l1.3-2.3a.6.6 0 10-1-.9l-1.4 2.4a7.2 7.2 0 00-4.9-1.9 7.2 7.2 0 00-4.9 1.9L5.1 5.3a.6.6 0 10-1 .9l1.3 2.3A6.8 6.8 0 004 14.5h16a6.8 6.8 0 00-2.4-5zM8 13.5a1 1 0 110-2 1 1 0 010 2zm8 0a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  ),
  ios: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  ),
  unknown: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M4 6h16v12H4V6zm2 2v8h12V8H6zm2 2h8v2H8v-2zm0 3h5v2H8v-2z" />
    </svg>
  ),
};

export function ClientPlatformBadge({ userAgent }: { userAgent?: string | null }) {
  const { platform, label } = parseClientPlatform(userAgent);
  return (
    <span className={`client-platform-badge platform-${platform}`} title={userAgent ?? undefined}>
      <span className="client-platform-icon">{PLATFORM_ICONS[platform]}</span>
      <span>{label}</span>
    </span>
  );
}
