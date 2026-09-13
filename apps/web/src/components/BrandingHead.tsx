'use client';

import { useEffect } from 'react';
import { fetchPublicBranding } from '@/lib/admin-api';
import { applyFavicon } from '@/lib/branding-dom';
import { APP_NAME } from '@city-manager/shared';

/** Applies favicon + document title from public org branding (works on login without auth). */
export function BrandingHead() {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const onLogin = typeof window !== 'undefined' && window.location.pathname.startsWith('/login');
        const res = await fetchPublicBranding();
        if (cancelled || !res.success || !res.data) return;
        if (res.data.faviconUrl) applyFavicon(res.data.faviconUrl);
        const title = (
          onLogin
            ? (res.data.loginTitle || res.data.title || APP_NAME)
            : (res.data.title || res.data.loginTitle || APP_NAME)
        ).trim();
        if (title) document.title = title;
      } catch {
        /* ignore */
      }
    }

    void load();
    const onUpdated = () => void load();
    window.addEventListener('cm:branding-updated', onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('cm:branding-updated', onUpdated);
    };
  }, []);

  return null;
}
