'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NavIcon } from '@/components/NavIcons';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationStreamUrl,
} from '@/lib/collaboration-api';
import { NOTIFICATION_POLL_INTERVAL_MS, NOTIFICATION_TYPE_LABELS, NotificationType } from '@city-manager/shared';
import { formatDateTime } from '@/lib/format';

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [c, n] = await Promise.all([fetchUnreadCount(), fetchNotifications(false)]);
    if (c.success && c.data) setCount(c.data.count);
    if (n.success && n.data) setItems(n.data.slice(0, 8));
  }

  useEffect(() => {
    let cancelled = false;
    let pollId: number | undefined;
    let source: EventSource | undefined;

    const startPoll = () => {
      if (pollId != null) return;
      void load();
      pollId = window.setInterval(() => {
        if (!cancelled) void load();
      }, NOTIFICATION_POLL_INTERVAL_MS);
    };

    void load();

    if (typeof EventSource === 'undefined') {
      startPoll();
      return () => {
        cancelled = true;
        if (pollId != null) window.clearInterval(pollId);
      };
    }

    source = new EventSource(notificationStreamUrl(), { withCredentials: true });
    source.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data) as {
          type?: string;
          unreadCount?: number;
          item?: Record<string, unknown>;
        };
        if (payload.type === 'ping') return;
        if (typeof payload.unreadCount === 'number') setCount(payload.unreadCount);
        if (payload.item) {
          setItems((prev) => {
            const next = [payload.item as Record<string, unknown>, ...prev.filter((x) => x.id !== payload.item?.id)];
            return next.slice(0, 8);
          });
        }
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
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function handleRead(id: string, link?: string) {
    await markNotificationRead(id);
    setOpen(false);
    void load();
    if (link) router.push(link);
  }

  return (
    <div className="notif-bell" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => { setOpen((v) => !v); void load(); }}
        aria-label="اعلان‌ها"
      >
        <NavIcon name="bell" size={18} />
        {count > 0 && <span className="notif-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <header>
            <strong>اعلان‌ها</strong>
            <button type="button" className="btn btn-sm" onClick={() => void markAllNotificationsRead().then(() => load())}>
              همه خوانده
            </button>
          </header>
          {items.length === 0 ? (
            <p className="muted">اعلانی نیست</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={String(n.id)} className={n.isRead ? '' : 'unread'}>
                  <button
                    type="button"
                    onClick={() => void handleRead(String(n.id), n.link ? String(n.link) : undefined)}
                  >
                    <small>{NOTIFICATION_TYPE_LABELS[n.type as NotificationType] ?? String(n.type)}</small>
                    <strong>{String(n.title)}</strong>
                    {n.body != null && String(n.body).trim() !== '' && <span>{String(n.body)}</span>}
                    <time>{formatDateTime(String(n.createdAt))}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <footer>
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>مشاهده همه</Link>
          </footer>
        </div>
      )}
    </div>
  );
}
