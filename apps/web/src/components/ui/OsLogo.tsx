/** Detect OS from user-agent and render a small logo */

export type DetectedOs = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';

export function detectOs(userAgent?: string | null): DetectedOs {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return 'unknown';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('linux') || ua.includes('x11')) return 'linux';
  return 'unknown';
}

export function OsLogo({ os, size = 16 }: { os: DetectedOs; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true as const,
  };

  switch (os) {
    case 'windows':
      return (
        <svg {...common}>
          <path d="M3 5.5l7.2-.9v6.7H3V5.5zm8.2-1L21 3v8.3h-9.8V4.5zM3 12.7h7.2v6.7L3 18.5v-5.8zm8.2 0H21V21l-9.8-1.3v-7z" />
        </svg>
      );
    case 'macos':
    case 'ios':
      return (
        <svg {...common}>
          <path d="M16.2 12.7c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.7-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2-.1 1.6-.7 3-.7s1.8.7 3 .7 2-.1 2.9-2.2c1.1-1.5 1.5-3 1.5-3.1-.1 0-2.9-1.1-2.9-4.1zM14.3 5.7c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.8-.9 2.9 1 .1 2-.5 2.6-1.2z" />
        </svg>
      );
    case 'android':
      return (
        <svg {...common}>
          <path d="M7.1 8.4l-1.3-2.2c-.1-.2 0-.4.2-.5.2-.1.4 0 .5.2l1.3 2.2A7.6 7.6 0 0 1 12 7c1.5 0 2.9.4 4.1 1.1l1.3-2.2c.1-.2.3-.3.5-.2.2.1.3.3.2.5l-1.3 2.2A6.7 6.7 0 0 1 18.7 12v6.2a1.3 1.3 0 0 1-1.3 1.3h-1.1V22h-1.6v-2.5H9.3V22H7.7v-2.5H6.6A1.3 1.3 0 0 1 5.3 18.2V12c0-1.4.4-2.7 1.2-3.6zM9 13.2a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6zm6 0a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6z" />
        </svg>
      );
    case 'linux':
      return (
        <svg {...common}>
          <path d="M12 2c-1.4 0-2.6 1.5-2.8 3.5-.2.1-.8.6-1.1 1.5-.4 1.2-.2 2.5.4 3.4-.7.5-1.5 1.5-1.5 2.9 0 1 .4 1.8 1 2.3-.1.5-.4 1.5-.2 2.4.3 1.3 1.4 2 2.4 2 .6 0 1.1-.2 1.5-.5.5.4 1.1.7 1.8.7s1.3-.3 1.8-.7c.4.3.9.5 1.5.5 1 0 2.1-.7 2.4-2 .2-.9-.1-1.9-.2-2.4.6-.5 1-1.3 1-2.3 0-1.4-.8-2.4-1.5-2.9.6-.9.8-2.2.4-3.4-.3-.9-.9-1.4-1.1-1.5C14.6 3.5 13.4 2 12 2z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M4 12h16M12 4a14 14 0 0 1 0 16M12 4a14 14 0 0 0 0 16" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

export const OS_LABELS: Record<DetectedOs, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS',
  unknown: 'نامشخص',
};
