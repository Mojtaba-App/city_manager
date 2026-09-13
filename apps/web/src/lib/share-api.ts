import { apiFetch } from './api';
import {
  ShareViewKind,
  ShareViewListItem,
  ShareViewPublicDto,
  ShareViewSnapshot,
} from '@city-manager/shared';

export async function fetchShareViews() {
  return apiFetch<ShareViewListItem[]>('/share-views', {});
}

export async function createShareView(payload: {
  kind: ShareViewKind | string;
  title: string;
  caption?: string;
  recipientLabel?: string;
  expiresInDays?: number;
  snapshot: ShareViewSnapshot | Record<string, unknown>;
  reportSections?: string[];
}) {
  return apiFetch<{ item: ShareViewListItem; token: string; publicPath: string }>(
    '/share-views',
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export async function revokeShareView(id: string) {
  return apiFetch<ShareViewListItem>(`/share-views/${id}/revoke`, { method: 'POST' });
}

/** Public — no auth token */
export async function fetchPublicShareView(token: string) {
  return apiFetch<ShareViewPublicDto>(
    `/share-views/public/${encodeURIComponent(token)}`,
    {},
  );
}

export function absoluteShareUrl(publicPath: string): string {
  if (typeof window === 'undefined') return publicPath;
  return `${window.location.origin}${publicPath.startsWith('/') ? '' : '/'}${publicPath}`;
}
