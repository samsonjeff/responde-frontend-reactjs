// src/context/NotificationContext.tsx
// Global real-time notification system using Supabase Realtime
// Listens for INSERT events on: fb_comments, conversations
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType = 'scraper' | 'messenger';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  /** Short preview of the comment or message text */
  message: string;
  /** Barangay location — scraper notifications only */
  barangay?: string;
  /** Sender name — messenger notifications only */
  sender?: string;
  /** Where clicking should navigate the user */
  targetPath: string;
  timestamp: Date;
  read: boolean;
}

export interface ToastNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  targetPath: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  toasts: ToastNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markNotificationRead: (id: string) => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  dismissToast: (id: number) => void;
}

// ── Storage Key ─────────────────────────────────────────────────────────────
const NOTIFS_STORAGE_KEY = 'responde_notifications_v2';

// ── Context ───────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  // 1. Initialize from localStorage so notifications persist across refresh/logout/login
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const raw = localStorage.getItem(NOTIFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }));
        }
      }
    } catch (err) {
      console.warn('[NotificationContext] Failed to parse stored notifications:', err);
    }
    return [];
  });

  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const toastIdRef = useRef(0);

  // 2. Persist to localStorage whenever notifications change
  useEffect(() => {
    try {
      localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(notifications));
    } catch (err) {
      console.warn('[NotificationContext] Failed to persist notifications:', err);
    }
  }, [notifications]);

  const addNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      message: string,
      targetPath: string,
      extra?: { barangay?: string; sender?: string; id?: string; timestamp?: Date; read?: boolean }
    ) => {
      const id = extra?.id || crypto.randomUUID();
      const newNotif: AppNotification = {
        id,
        type,
        title,
        message,
        targetPath,
        barangay: extra?.barangay,
        sender: extra?.sender,
        timestamp: extra?.timestamp || new Date(),
        read: extra?.read ?? false,
      };

      setNotifications((prev) => {
        const filtered = prev.filter((n) => n.id !== id);
        return [newNotif, ...filtered].slice(0, 50);
      });

      if (!extra?.read) {
        const toastId = ++toastIdRef.current;
        setToasts((prev) => [
          ...prev,
          { id: toastId, type, title, message, targetPath },
        ]);
      }
    },
    []
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // ── Fetch Recent Records on Mount & Merge with Stored ────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadRecentHistory() {
      try {
        const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');
        const storedToken = (() => { try { return localStorage.getItem('responde_session_token'); } catch { return null; } })();
        const hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
        if (storedToken) hdrs['Authorization'] = `Bearer ${storedToken}`;

        let commentsData: any[] = [];
        let convosData: any[] = [];

        try {
          const [cRes, mRes] = await Promise.all([
            fetch(`${API_BASE}/api/auth/data/fb-comments?limit=25`, { credentials: 'include', headers: hdrs }),
            fetch(`${API_BASE}/api/auth/data/conversations?limit=25`, { credentials: 'include', headers: hdrs }),
          ]);
          if (cRes.ok) {
            const j = await cRes.json();
            commentsData = j.data ?? [];
          }
          if (mRes.ok) {
            const j = await mRes.json();
            convosData = j.data ?? [];
          }
        } catch {
          // Backend API fetch failed, proceed to Supabase fallback
        }

        if (commentsData.length === 0 || convosData.length === 0) {
          const [commentsRes, convosRes] = await Promise.allSettled([
            commentsData.length === 0
              ? supabase.from('fb_comments').select('*').order('created_at', { ascending: false }).limit(25)
              : Promise.resolve({ data: commentsData, error: null }),
            convosData.length === 0
              ? supabase.from('conversations').select('*').order('timestamp', { ascending: false }).limit(25)
              : Promise.resolve({ data: convosData, error: null }),
          ]);

          if (commentsData.length === 0 && commentsRes.status === 'fulfilled' && (commentsRes.value as any)?.data) {
            commentsData = (commentsRes.value as any).data;
          }
          if (convosData.length === 0 && convosRes.status === 'fulfilled' && (convosRes.value as any)?.data) {
            convosData = (convosRes.value as any).data;
          }
        }

        const fetchedItems: AppNotification[] = [];

        if (commentsData && commentsData.length > 0) {
          commentsData.forEach((row: any) => {
            const rawId = row.id || row.comment_id;
            const barangay = row.barangay || row.location || 'Unknown Barangay';
            const preview =
              row.comment_text || row.commentText || row.raw_text || row.text || 'New comment scraped';
            const time = row.created_at || row.timestamp || new Date().toISOString();
            fetchedItems.push({
              id: `scraper-${rawId || crypto.randomUUID()}`,
              type: 'scraper',
              title: 'New Scraped Comment',
              message:
                String(preview).slice(0, 70) +
                (String(preview).length > 70 ? '...' : ''),
              barangay,
              targetPath: '/scraper-feed',
              timestamp: new Date(time),
              read: true, // Existing records from database start as read unless new
            });
          });
        }

        if (convosData && convosData.length > 0) {
          convosData.forEach((row: any) => {
            const rawId = row.id || row.conversation_id;
            const sender =
              row.sender_name && row.sender_name !== 'Unknown User'
                ? row.sender_name
                : row.name || (row.sender_psid ? `PSID ...${String(row.sender_psid).slice(-6)}` : 'Unknown User');
            const preview =
              row.user_message ||
              (row.messages && row.messages[0]?.text) ||
              'New message received';
            const time = row.created_at || row.timestamp || row.time || new Date().toISOString();
            fetchedItems.push({
              id: `messenger-${rawId || crypto.randomUUID()}`,
              type: 'messenger',
              title: 'New Messenger Message',
              message:
                String(preview).slice(0, 70) +
                (String(preview).length > 70 ? '...' : ''),
              sender,
              targetPath: '/messenger-bot-logs',
              timestamp: new Date(time),
              read: true,
            });
          });
        }

        if (cancelled) return;

        setNotifications((prev) => {
          const map = new Map<string, AppNotification>();
          
          // Add all fetched history items first
          fetchedItems.forEach((item) => {
            map.set(item.id, item);
          });

          // Overlay stored user notifications (preserving read status & realtime events)
          prev.forEach((stored) => {
            map.set(stored.id, stored);
          });

          // Sort by timestamp descending and keep up to 50
          return Array.from(map.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 50);
        });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[NotificationContext] Failed to load history:', err);
        }
      }
    }

    loadRecentHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Supabase Realtime Subscriptions ──────────────────────────────────────────

  useEffect(() => {
    // fb_comments — scraped Facebook comments
    const scraperChannel = supabase
      .channel('rt:fb_comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fb_comments' },
        (payload) => {
          const row = payload.new as Record<string, any>;
          const rawId = row.id || row.comment_id;
          const barangay = row.barangay || 'Unknown Barangay';
          const preview = row.comment_text
            ? String(row.comment_text).slice(0, 70) +
              (String(row.comment_text).length > 70 ? '...' : '')
            : 'New comment scraped';
          addNotification('scraper', 'New Scraped Comment', preview, '/scraper-feed', {
            barangay,
            id: `scraper-${rawId || crypto.randomUUID()}`,
            read: false,
          });
        }
      )
      .subscribe((s) => {
        if (import.meta.env.DEV) console.log('[Notif] fb_comments:', s);
      });

    // conversations — Messenger Bot messages
    const messengerChannel = supabase
      .channel('rt:conversations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const row = payload.new as Record<string, any>;
          const rawId = row.id || row.conversation_id;
          const sender =
            row.sender_name && row.sender_name !== 'Unknown User'
              ? row.sender_name
              : row.sender_psid
              ? `PSID ...${String(row.sender_psid).slice(-6)}`
              : 'Unknown User';
          const preview = row.user_message
            ? String(row.user_message).slice(0, 70) +
              (String(row.user_message).length > 70 ? '...' : '')
            : 'New message received';
          addNotification(
            'messenger',
            'New Messenger Message',
            preview,
            '/messenger-bot-logs',
            { sender, id: `messenger-${rawId || crypto.randomUUID()}`, read: false }
          );
        }
      )
      .subscribe((s) => {
        if (import.meta.env.DEV) console.log('[Notif] conversations:', s);
      });

    return () => {
      supabase.removeChannel(scraperChannel);
      supabase.removeChannel(messengerChannel);
    };
  }, [addNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        toasts,
        unreadCount,
        markAllRead,
        markNotificationRead,
        deleteNotification,
        clearAll,
        dismissToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
