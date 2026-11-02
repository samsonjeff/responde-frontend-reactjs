// src/context/NotificationContext.tsx
// Global real-time notification & priority alert system using Supabase Realtime + Live Polling Fallback
// Listens for INSERT events on: incident_reports, fb_comments, conversations
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
import { apiRequest } from '../services/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType = 'scraper' | 'messenger' | 'priority';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  /** Short preview of the comment, message, or incident text */
  message: string;
  /** Barangay location */
  barangay?: string;
  /** Sender name — messenger notifications only */
  sender?: string;
  /** Where clicking should navigate the user */
  targetPath: string;
  timestamp: Date;
  read: boolean;
  /** Priority Alert indicators for FR-007 */
  isPriority?: boolean;
  urgency?: string;
  incidentType?: string;
  reportId?: string;
}

export interface ToastNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  targetPath: string;
  isPriority?: boolean;
  barangay?: string;
  urgency?: string;
  incidentType?: string;
  reportId?: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  toasts: ToastNotification[];
  unreadCount: number;
  priorityUnreadCount: number;
  markAllRead: () => void;
  markTypeRead: (type: NotificationType) => void;
  markNotificationRead: (id: string) => void;
  markMultipleRead: (ids: string[]) => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  dismissToast: (id: number) => void;
  triggerPriorityAlert: (data: {
    id?: string;
    title?: string;
    message: string;
    barangay?: string;
    type?: string;
    urgency?: string;
    targetPath?: string;
    reportId?: string;
  }) => void;
}

// ── Web Audio API Emergency Alert Chime ───────────────────────────────────────

export function playPriorityChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    const t = ctx.currentTime;
    playTone(880, t, 0.18);
    playTone(1174.66, t + 0.14, 0.28);
  } catch (err) {
    console.debug('[NotificationContext] Web Audio chime suspended or not allowed:', err);
  }
}

// ── Priority / High-Urgency Detection Helper ──────────────────────────────────

function evaluatePriorityIncident(rawUrgency?: string, rawType?: string, rawText?: string) {
  const urgency = String(rawUrgency || '').toLowerCase().trim();
  const type = String(rawType || '').toLowerCase().trim();
  const text = String(rawText || '').toLowerCase().trim();

  const isRescue =
    type.includes('rescue') ||
    type.includes('search') ||
    text.includes('rescue') ||
    text.includes('stranded') ||
    text.includes('naipit sa bubong') ||
    text.includes('boat capsized') ||
    text.includes('bangka');

  const hasEmergencyKeywords =
    text.includes('tulong po') ||
    text.includes('nabangga') ||
    text.includes('aksidente') ||
    text.includes('duguan') ||
    text.includes('saklolo') ||
    text.includes('lampas tao') ||
    text.includes('kailangan ng rescue') ||
    text.includes('sunog') ||
    text.includes('emergency') ||
    text.includes('asap');

  const isHigh = urgency === 'high' || hasEmergencyKeywords;
  const isPriority = isHigh || isRescue;

  const priorityTitle = isRescue
    ? 'Search & Rescue'
    : 'High-Urgency Incident';

  return {
    isPriority,
    isHigh,
    isRescue,
    priorityTitle,
    incidentType: isRescue ? 'Search & Rescue' : rawType || 'Emergency',
  };
}

// ── Storage Keys ──────────────────────────────────────────────────────────────
const NOTIFS_STORAGE_KEY = 'responde_notifications_v3';
const READ_IDS_STORAGE_KEY = 'responde_read_notif_ids_v2';
const DELETED_IDS_STORAGE_KEY = 'responde_deleted_notif_ids_v2';
const TOASTED_IDS_STORAGE_KEY = 'responde_toasted_notif_ids_v2';

function loadStringSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

function saveStringSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-300)));
  } catch {}
}

// ── Context ───────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  const readIdsRef = useRef<Set<string>>(loadStringSet(READ_IDS_STORAGE_KEY));
  const deletedIdsRef = useRef<Set<string>>(loadStringSet(DELETED_IDS_STORAGE_KEY));
  const toastedIdsRef = useRef<Set<string>>(loadStringSet(TOASTED_IDS_STORAGE_KEY));

  // 1. Initialize from localStorage so notifications persist across refresh/logout/login
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const raw = localStorage.getItem(NOTIFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item: any) => !deletedIdsRef.current.has(item.id))
            .map((item: any) => ({
              ...item,
              timestamp: new Date(item.timestamp),
              read: readIdsRef.current.has(item.id) ? true : Boolean(item.read),
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

  const enqueueToast = useCallback(
    (
      notifId: string,
      type: NotificationType,
      title: string,
      message: string,
      targetPath: string,
      extra?: {
        isPriority?: boolean;
        barangay?: string;
        urgency?: string;
        incidentType?: string;
        reportId?: string;
      }
    ) => {
      if (toastedIdsRef.current.has(notifId)) return;
      toastedIdsRef.current.add(notifId);
      saveStringSet(TOASTED_IDS_STORAGE_KEY, toastedIdsRef.current);

      const toastId = ++toastIdRef.current;
      const isPriority = extra?.isPriority || type === 'priority';
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type,
          title,
          message,
          targetPath,
          isPriority,
          barangay: extra?.barangay,
          urgency: extra?.urgency,
          incidentType: extra?.incidentType,
          reportId: extra?.reportId,
        },
      ]);
      if (isPriority) {
        playPriorityChime();
      }
    },
    []
  );

  const addNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      message: string,
      targetPath: string,
      extra?: {
        barangay?: string;
        sender?: string;
        id?: string;
        timestamp?: Date;
        read?: boolean;
        isPriority?: boolean;
        urgency?: string;
        incidentType?: string;
        reportId?: string;
      }
    ) => {
      const id = extra?.id || crypto.randomUUID();
      if (deletedIdsRef.current.has(id)) return;

      const isPriority = extra?.isPriority || type === 'priority';
      const isRead = extra?.read ?? false;
      if (isRead) {
        readIdsRef.current.add(id);
        saveStringSet(READ_IDS_STORAGE_KEY, readIdsRef.current);
      }

      const newNotif: AppNotification = {
        id,
        type,
        title,
        message,
        targetPath,
        barangay: extra?.barangay,
        sender: extra?.sender,
        timestamp: extra?.timestamp || new Date(),
        read: isRead,
        isPriority,
        urgency: extra?.urgency,
        incidentType: extra?.incidentType,
        reportId: extra?.reportId,
      };

      setNotifications((prev) => {
        const filtered = prev.filter((n) => n.id !== id);
        return [newNotif, ...filtered]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 50);
      });

      if (!isRead) {
        enqueueToast(id, type, title, message, targetPath, {
          isPriority,
          barangay: extra?.barangay,
          urgency: extra?.urgency,
          incidentType: extra?.incidentType,
          reportId: extra?.reportId,
        });
      }
    },
    [enqueueToast]
  );

  const triggerPriorityAlert = useCallback(
    (data: {
      id?: string;
      title?: string;
      message: string;
      barangay?: string;
      type?: string;
      urgency?: string;
      targetPath?: string;
      reportId?: string;
      timestamp?: Date;
    }) => {
      const id = data.id || `priority-${crypto.randomUUID()}`;
      const isSearchAndRescue =
        (data.type || '').toLowerCase().includes('rescue') ||
        (data.type || '').toLowerCase().includes('search');
      const title =
        data.title ||
        (isSearchAndRescue
          ? 'Search & Rescue'
          : 'High-Urgency Incident');
      const targetPath = data.targetPath || '/incident-reports';

      addNotification('priority', title, data.message, targetPath, {
        id,
        barangay: data.barangay,
        timestamp: data.timestamp,
        read: false,
        isPriority: true,
        urgency: data.urgency || 'High',
        incidentType: data.type || (isSearchAndRescue ? 'Search & Rescue' : 'Emergency'),
        reportId: data.reportId,
      });
    },
    [addNotification]
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      prev.forEach((n) => readIdsRef.current.add(n.id));
      saveStringSet(READ_IDS_STORAGE_KEY, readIdsRef.current);
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, []);

  const markTypeRead = useCallback((type: NotificationType) => {
    setNotifications((prev) => {
      prev.forEach((n) => {
        if (n.type === type) readIdsRef.current.add(n.id);
      });
      saveStringSet(READ_IDS_STORAGE_KEY, readIdsRef.current);
      return prev.map((n) => (n.type === type ? { ...n, read: true } : n));
    });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    readIdsRef.current.add(id);
    saveStringSet(READ_IDS_STORAGE_KEY, readIdsRef.current);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markMultipleRead = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    ids.forEach((id) => readIdsRef.current.add(id));
    saveStringSet(READ_IDS_STORAGE_KEY, readIdsRef.current);
    setNotifications((prev) =>
      prev.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n))
    );
  }, []);

  const deleteNotification = useCallback((id: string) => {
    deletedIdsRef.current.add(id);
    saveStringSet(DELETED_IDS_STORAGE_KEY, deletedIdsRef.current);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications((prev) => {
      prev.forEach((n) => deletedIdsRef.current.add(n.id));
      saveStringSet(DELETED_IDS_STORAGE_KEY, deletedIdsRef.current);
      return [];
    });
  }, []);

  // ── Fetch Recent Records on Mount & Poll Every 8s for Guaranteed Sync ───────
  useEffect(() => {
    let cancelled = false;
    const RECENT_UNREAD_WINDOW_MS = 45 * 60 * 1000; // Items within last 45m stay unread until explicitly read

    async function loadRecentHistory(isInitial = false) {
      try {
        let commentsData: any[] = [];
        let convosData: any[] = [];

        try {
          const [cRes, mRes] = await Promise.all([
            apiRequest<{ data?: any[] }>('/api/auth/data/fb-comments?limit=25', {
              cacheTtlMs: isInitial ? 4000 : 0,
            }),
            apiRequest<{ data?: any[] }>('/api/auth/data/conversations?limit=25', {
              cacheTtlMs: isInitial ? 4000 : 0,
            }),
          ]);
          commentsData = cRes.data ?? [];
          convosData = mRes.data ?? [];
        } catch {
          return;
        }

        if (cancelled) return;

        const now = Date.now();
        const fetchedItems: AppNotification[] = [];

        if (commentsData && commentsData.length > 0) {
          commentsData.forEach((row: any) => {
            const rawId = row.id || row.comment_id;
            if (!rawId) return;
            const barangay = row.barangay || row.location || 'Unknown Barangay';
            const fullText = String(
              row.comment_text || row.commentText || row.raw_text || row.text || 'New comment scraped'
            );
            const preview = fullText.slice(0, 80) + (fullText.length > 80 ? '...' : '');
            const time = row.created_at || row.timestamp || new Date().toISOString();
            const itemDate = new Date(time);
            const ageMs = Math.max(0, now - itemDate.getTime());
            const isRecent = ageMs <= RECENT_UNREAD_WINDOW_MS;

            const scraperId = `scraper-${rawId}`;
            if (!deletedIdsRef.current.has(scraperId)) {
              const isRead = readIdsRef.current.has(scraperId) || !isRecent;
              fetchedItems.push({
                id: scraperId,
                type: 'scraper',
                title: 'New Scraped Comment',
                message: preview,
                barangay,
                targetPath: '/scraper-feed',
                timestamp: itemDate,
                read: isRead,
                isPriority: false,
                urgency: row.urgency,
                incidentType: row.incident_type || row.type,
              });
            }

            // If this scraped comment is a Priority / High-Urgency report, ALSO add the Priority Alert notification!
            const evalRes = evaluatePriorityIncident(
              row.urgency,
              row.incident_type || row.type,
              fullText
            );
            if (evalRes.isPriority) {
              const priorityId = `priority-sc-${rawId}`;
              if (!deletedIdsRef.current.has(priorityId)) {
                const isPriorityRead = readIdsRef.current.has(priorityId) || !isRecent;
                const priorityTimestamp = new Date(itemDate.getTime() + 1000); // 1s after so Priority sits right above the Scraper item
                fetchedItems.push({
                  id: priorityId,
                  type: 'priority',
                  title: evalRes.priorityTitle,
                  message: preview,
                  barangay,
                  targetPath: '/incident-reports',
                  timestamp: priorityTimestamp,
                  read: isPriorityRead,
                  isPriority: true,
                  urgency: 'High',
                  incidentType: evalRes.incidentType,
                  reportId: String(rawId),
                });

                if (!isPriorityRead && !isInitial) {
                  enqueueToast(priorityId, 'priority', evalRes.priorityTitle, preview, '/incident-reports', {
                    isPriority: true,
                    barangay,
                    urgency: 'High',
                    incidentType: evalRes.incidentType,
                    reportId: String(rawId),
                  });
                }
              }
            }
          });
        }

        if (convosData && convosData.length > 0) {
          convosData.forEach((row: any) => {
            const rawId = row.id || row.conversation_id;
            if (!rawId) return;
            const sender =
              row.sender_name && row.sender_name !== 'Unknown User'
                ? row.sender_name
                : row.name || (row.sender_psid ? `PSID ...${String(row.sender_psid).slice(-6)}` : 'Unknown User');
            const fullText = String(
              row.user_message || (row.messages && row.messages[0]?.text) || 'New message received'
            );
            const preview = fullText.slice(0, 80) + (fullText.length > 80 ? '...' : '');
            const time = row.created_at || row.timestamp || row.time || new Date().toISOString();
            const itemDate = new Date(time);
            const ageMs = Math.max(0, now - itemDate.getTime());
            const isRecent = ageMs <= RECENT_UNREAD_WINDOW_MS;

            const messengerId = `messenger-${rawId}`;
            if (!deletedIdsRef.current.has(messengerId)) {
              const isRead = readIdsRef.current.has(messengerId) || !isRecent;
              fetchedItems.push({
                id: messengerId,
                type: 'messenger',
                title: 'New Messenger Message',
                message: preview,
                sender,
                targetPath: '/messenger-bot-logs',
                timestamp: itemDate,
                read: isRead,
                isPriority: false,
                urgency: row.urgency,
                incidentType: row.type,
              });
            }

            const evalRes = evaluatePriorityIncident(row.urgency, row.type, fullText);
            if (evalRes.isPriority) {
              const priorityId = `priority-msg-${rawId}`;
              if (!deletedIdsRef.current.has(priorityId)) {
                const isPriorityRead = readIdsRef.current.has(priorityId) || !isRecent;
                const priorityTimestamp = new Date(itemDate.getTime() + 1000);
                fetchedItems.push({
                  id: priorityId,
                  type: 'priority',
                  title: evalRes.priorityTitle,
                  message: preview,
                  barangay: row.barangay || 'Talisay',
                  sender,
                  targetPath: '/incident-reports',
                  timestamp: priorityTimestamp,
                  read: isPriorityRead,
                  isPriority: true,
                  urgency: 'High',
                  incidentType: evalRes.incidentType,
                  reportId: String(rawId),
                });

                if (!isPriorityRead && !isInitial) {
                  enqueueToast(priorityId, 'priority', evalRes.priorityTitle, preview, '/incident-reports', {
                    isPriority: true,
                    barangay: row.barangay || 'Talisay',
                    urgency: 'High',
                    incidentType: evalRes.incidentType,
                    reportId: String(rawId),
                  });
                }
              }
            }
          });
        }

        if (cancelled) return;

        setNotifications((prev) => {
          const map = new Map<string, AppNotification>();

          // Keep existing stored items that haven't been deleted
          prev.forEach((stored) => {
            if (!deletedIdsRef.current.has(stored.id)) {
              const ageMs = Math.max(0, now - new Date(stored.timestamp).getTime());
              const isRecent = ageMs <= RECENT_UNREAD_WINDOW_MS;
              map.set(stored.id, {
                ...stored,
                read: readIdsRef.current.has(stored.id) ? true : isRecent ? false : stored.read,
              });
            }
          });

          // Merge fetched items (preserving explicit user read state via readIdsRef)
          fetchedItems.forEach((item) => {
            const existing = map.get(item.id);
            const isExplicitlyRead = readIdsRef.current.has(item.id);
            map.set(item.id, {
              ...item,
              read: isExplicitlyRead ? true : existing ? existing.read && item.read : item.read,
            });
          });

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

    loadRecentHistory(true);
    const pollInterval = setInterval(() => {
      loadRecentHistory(false);
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [enqueueToast]);

  // ── Supabase Realtime Subscriptions ──────────────────────────────────────────

  useEffect(() => {
    // 1. incident_reports — Emergency Incident Reports table
    const incidentChannel = supabase
      .channel('rt:incident_reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_reports' },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row) return;
          const text = String(row.description || row.original_text || '');
          const evalRes = evaluatePriorityIncident(
            row.urgency,
            row.type || row.incident_type,
            text
          );
          const rawId = row.id || crypto.randomUUID();

          if (evalRes.isPriority) {
            // If this report originated from a scraped comment or conversation that already has priority-sc / priority-msg, avoid duplicate if same source id
            const sourceId = row.comment_id || row.source_id || rawId;
            triggerPriorityAlert({
              id: row.source === 'scraper' ? `priority-sc-${sourceId}` : `priority-inc-${rawId}`,
              title: evalRes.priorityTitle,
              message:
                text || 'High-urgency emergency incident requiring immediate response.',
              barangay: row.barangay || 'Talisay',
              type: evalRes.incidentType,
              urgency: 'High',
              targetPath: '/incident-reports',
              reportId: String(rawId),
            });
          }
        }
      )
      .subscribe();

    // 2. fb_comments — scraped Facebook comments
    const scraperChannel = supabase
      .channel('rt:fb_comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fb_comments' },
        (payload) => {
          const row = payload.new as Record<string, any>;
          const rawId = row.id || row.comment_id || crypto.randomUUID();
          const barangay = row.barangay || row.location || 'Unknown Barangay';
          const text = String(row.comment_text || row.raw_text || '');
          const preview = text
            ? text.slice(0, 80) + (text.length > 80 ? '...' : '')
            : 'New comment scraped';

          const nowDate = new Date();

          // 1. Always add the Scraper notification (unread & bold)
          addNotification('scraper', 'New Scraped Comment', preview, '/scraper-feed', {
            barangay,
            id: `scraper-${rawId}`,
            timestamp: nowDate,
            read: false,
            urgency: row.urgency,
            incidentType: row.incident_type || row.type,
          });

          // 2. If it is ALSO a Priority / High-Urgency incident, pop the Priority Alert too!
          const evalRes = evaluatePriorityIncident(
            row.urgency,
            row.incident_type || row.type,
            text
          );
          if (evalRes.isPriority) {
            triggerPriorityAlert({
              id: `priority-sc-${rawId}`,
              title: evalRes.priorityTitle,
              message: preview,
              barangay,
              type: evalRes.incidentType,
              urgency: 'High',
              targetPath: '/incident-reports',
              reportId: String(rawId),
              timestamp: new Date(nowDate.getTime() + 1000),
            });
          }
        }
      )
      .subscribe();

    // 3. conversations — Messenger Bot messages
    const messengerChannel = supabase
      .channel('rt:conversations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const row = payload.new as Record<string, any>;
          const rawId = row.id || row.conversation_id || crypto.randomUUID();
          const sender =
            row.sender_name && row.sender_name !== 'Unknown User'
              ? row.sender_name
              : row.sender_psid
              ? `PSID ...${String(row.sender_psid).slice(-6)}`
              : 'Unknown User';
          const text = String(row.user_message || (row.messages && row.messages[0]?.text) || '');
          const preview = text
            ? text.slice(0, 80) + (text.length > 80 ? '...' : '')
            : 'New message received';

          const nowDate = new Date();

          // 1. Always add the Messenger notification (unread & bold)
          addNotification(
            'messenger',
            'New Messenger Message',
            preview,
            '/messenger-bot-logs',
            {
              sender,
              id: `messenger-${rawId}`,
              timestamp: nowDate,
              read: false,
            }
          );

          // 2. If it is ALSO a Priority / High-Urgency incident, pop the Priority Alert too!
          const evalRes = evaluatePriorityIncident(row.urgency, row.type, text);
          if (evalRes.isPriority) {
            triggerPriorityAlert({
              id: `priority-msg-${rawId}`,
              title: evalRes.priorityTitle,
              message: preview,
              barangay: row.barangay || 'Talisay',
              type: evalRes.incidentType,
              urgency: 'High',
              targetPath: '/incident-reports',
              reportId: String(rawId),
              timestamp: new Date(nowDate.getTime() + 1000),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incidentChannel);
      supabase.removeChannel(scraperChannel);
      supabase.removeChannel(messengerChannel);
    };
  }, [addNotification, triggerPriorityAlert]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const priorityUnreadCount = notifications.filter(
    (n) => (n.type === 'priority' || n.isPriority) && !n.read
  ).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        toasts,
        unreadCount,
        priorityUnreadCount,
        markAllRead,
        markTypeRead,
        markNotificationRead,
        markMultipleRead,
        deleteNotification,
        clearAll,
        dismissToast,
        triggerPriorityAlert,
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
