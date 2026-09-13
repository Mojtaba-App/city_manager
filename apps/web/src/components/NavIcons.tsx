/** Inline SVG nav icons — crisp at collapsed sidebar size */

export function NavIcon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case 'org':
      return (
        <svg {...common}>
          <path d="M4 20V8l8-4 8 4v12" />
          <path d="M9 20v-6h6v6" />
          <path d="M9 10h.01M15 10h.01M12 10h.01" />
        </svg>
      );
    case 'welcome':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 19c.7-3.2 3.1-5 7-5s6.3 1.8 7 5" />
          <path d="M19 8.5l1.2.4.4 1.2-.4 1.2-1.2.4-1.2-.4-.4-1.2.4-1.2z" />
        </svg>
      );
    case 'shield-admin':
      return (
        <svg {...common}>
          <path d="M12 3l8 3.5v5.2c0 4.6-3.1 8.7-8 9.8-4.9-1.1-8-5.2-8-9.8V6.5L12 3z" />
          <path d="M12 8v5" />
          <path d="M12 16.2h.01" />
        </svg>
      );
    case 'dwellings':
      return (
        <svg {...common}>
          <path d="M3 10.5L12 4l9 6.5" />
          <path d="M5 9.8V20h14V9.8" />
          <path d="M10 20v-6h4v6" />
          <path d="M8 12h2M14 12h2" />
        </svg>
      );
    case 'neighborhood':
      return (
        <svg {...common}>
          <path d="M4 20h16" />
          <path d="M6 20V10l4-3 4 3v10" />
          <path d="M14 20V8l4-2v14" />
          <path d="M8 14h2M8 17h2" />
        </svg>
      );
    case 'fabric':
      return (
        <svg {...common}>
          <path d="M4 7h16v10H4z" />
          <path d="M4 11h16M4 15h16M8 7v10M12 7v10M16 7v10" />
        </svg>
      );
    case 'trajectory':
      return (
        <svg {...common}>
          <path d="M4 18c3-1 5-5 6.5-8S14 4 20 4" />
          <circle cx="6" cy="17" r="1.6" />
          <circle cx="12" cy="9" r="1.6" />
          <circle cx="19" cy="5" r="1.6" />
        </svg>
      );
    case 'plus-home':
      return (
        <svg {...common}>
          <path d="M4 11L12 5l8 6" />
          <path d="M6 10.5V19h12v-8.5" />
          <path d="M12 13v4M10 15h4" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 15v-4" />
          <path d="M12 15V8" />
          <path d="M16 15v-7" />
          <path d="M20 15v-2" />
        </svg>
      );
    case 'activity':
      return (
        <svg {...common}>
          <path d="M3 12h4l2.5-6 3 12 2.5-6H21" />
        </svg>
      );
    case 'security':
      return (
        <svg {...common}>
          <path d="M12 3l8 3.5v5.2c0 4.6-3.1 8.7-8 9.8-4.9-1.1-8-5.2-8-9.8V6.5L12 3z" />
          <path d="M9.5 12.2l1.7 1.7 3.5-3.6" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <path d="M8 3h6l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v4h4" />
          <path d="M9.5 12h5" />
          <path d="M9.5 16h5" />
        </svg>
      );
    case 'households':
      return (
        <svg {...common}>
          <path d="M4 10.5L12 4l8 6.5" />
          <path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <path d="M9 4.5l-5 2v13l5-2 6 2 5-2v-13l-5 2-6-2z" />
          <path d="M9 4.5v13" />
          <path d="M15 6.5v13" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...common}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
          <path d="M3 17l9 5 9-5" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
          <circle cx="17" cy="9" r="2.4" />
          <path d="M14.2 19c.4-2.2 1.8-3.5 3.6-3.5 1.1 0 2 .4 2.7 1.1" />
        </svg>
      );
    case 'roles':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" />
          <path d="M3.2 19c.5-2.8 2.4-4.4 4.8-4.4S12.3 16.2 12.8 19" />
          <path d="M15 8h6" />
          <path d="M15 12h6" />
          <path d="M15 16h4" />
        </svg>
      );
    case 'integrations':
      return (
        <svg {...common}>
          <path d="M8 8h.01" />
          <path d="M16 16h.01" />
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
          <path d="M11 7.5h2.2a2.5 2.5 0 0 1 2.5 2.5V11" />
          <path d="M13 16.5h-2.2a2.5 2.5 0 0 1-2.5-2.5V13" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.4l1.6 1.6M17.5 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.6l1.6-1.6M17.5 8l1.6-1.6" />
        </svg>
      );
    case 'collapse':
      return (
        <svg {...common}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      );
    case 'expand':
      return (
        <svg {...common}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 16V5" />
          <path d="M8 8l4-4 4 4" />
          <path d="M5 19h14" />
          <path d="M7 19v-3h10v3" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
          <path d="M15 16l4-4-4-4" />
          <path d="M10 12h9" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 19c.7-3.2 3.1-5 7-5s6.3 1.8 7 5" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M5.1 18.9l1.6-1.6M17.3 6.7l1.6-1.6" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path d="M20 13.5A7.5 7.5 0 0 1 10.5 4 7.8 7.8 0 1 0 20 13.5z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 14v-1.5a6 6 0 1 0-12 0V14l-1.5 2h15L18 14z" />
          <path d="M10.5 18a1.5 1.5 0 0 0 3 0" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
