import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  LayoutDashboard, FileText, MessageSquare, Globe, Map,
  BarChart3, Settings, Search, Bell, LogOut, Menu, X,
  Globe2, MessageCircle, CheckCheck, Trash2, BellOff, ArrowRight, ArrowDown,
  Sun, Moon, Copy, Check, Siren, ShieldAlert, MapPin, Inbox,
} from 'lucide-react';
import SignOutModal from './SignOutModal';
import {
  useNotifications,
  type AppNotification,
  type ToastNotification,
  type NotificationType,
} from '../context/NotificationContext';
import { useBotConversations } from '../context/BotConversationsContext';
import { useTheme } from './ThemeContent';

import {
  formatPhilippineTimeOnly,
  formatPhilippineDateOnly,
} from '../utils/dateUtils';

type FilterTab = 'all' | NotificationType;

const NOTIF_TAB_ANIMATIONS: Record<FilterTab, Variants> = {
  all: {
    rest: { scale: 1, y: 0 },
    hover: {
      scale: 1.18,
      y: -1.5,
      transition: { type: 'spring', stiffness: 500, damping: 15 },
    },
  },
  priority: {
    rest: { scale: 1, rotate: 0 },
    hover: {
      scale: [1, 1.25, 1.12],
      rotate: [0, -14, 14, -8, 8, 0],
      transition: { duration: 0.5, ease: 'easeInOut' },
    },
  },
  scraper: {
    rest: { scale: 1, rotate: 0 },
    hover: {
      rotate: [0, 36, 0],
      scale: 1.18,
      transition: { duration: 0.55, ease: 'easeInOut' },
    },
  },
  messenger: {
    rest: { scale: 1, y: 0 },
    hover: {
      scale: [1, 0.88, 1.22, 1.08],
      y: [0, 1, -2, 0],
      transition: { duration: 0.45, ease: 'easeOut' },
    },
  },
};

const BELL_SWING_VARIANTS: Variants = {
  rest: { rotate: 0 },
  hover: {
    rotate: [0, -16, 16, -10, 8, 0],
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
};

// Prefetch map for lazy page chunks — loaded on demand when user hovers or presses navigation buttons
const ROUTE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/Dashboard'),
  '/incident-reports': () => import('../pages/IncidentReports'),
  '/messenger-bot-logs': () => import('../pages/MessengerBotLogs'),
  '/scraper-feed': () => import('../pages/ScraperFeed'),
  '/geospatial-map': () => import('../pages/GeospatialMap'),
  '/geospatial': () => import('../pages/GeospatialMap'),
  '/analytics': () => import('../pages/Analytics'),
  '/settings': () => import('../pages/Settings'),
};

const prefetchedRoutes = new Set<string>();

const APPLE_DECEL_EASE = [0.25, 0.46, 0.45, 0.94] as const;

export interface LayoutOutletContext {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

export function prefetchRoute(path: string) {
  if (!path || prefetchedRoutes.has(path)) return;
  const loader = ROUTE_PRELOADERS[path];
  if (loader) {
    prefetchedRoutes.add(path);
    loader().catch(() => {
      prefetchedRoutes.delete(path);
    });
  }
}

function getInitials(name?: string, username?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (username && username.trim()) {
    return username.trim().slice(0, 2).toUpperCase();
  }
  return 'U';
}

function getRoleBadge(role?: string) {
  const normalized = (role || 'staff').toLowerCase();
  if (normalized.includes('super_admin') || normalized.includes('super admin')) {
    return {
      label: 'Super Admin',
      className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    };
  }
  if (normalized.includes('admin')) {
    return {
      label: 'Admin',
      className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    };
  }
  if (normalized.includes('responder')) {
    return {
      label: 'Responder',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    };
  }
  return {
    label: role ? role.replace('_', ' ') : 'Staff',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  };
}

function UserAvatar({
  src,
  name,
  username,
  size = 'md',
  className = '',
}: {
  src?: string | null;
  name?: string;
  username?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name, username);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm font-bold',
  }[size];

  if (src && !imgError) {
    return (
      <div className={`relative rounded-full overflow-hidden shrink-0 ${sizeClasses} ${className}`}>
        <img
          src={src}
          alt={name || 'Profile'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full shrink-0 flex items-center justify-center font-bold tracking-tight select-none bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white shadow-xs ${sizeClasses} ${className}`}
    >
      {initials}
    </div>
  );
}

function PhilippineClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right hidden sm:block">
      <div className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
        {formatPhilippineTimeOnly(time, true)}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {formatPhilippineDateOnly(time, 'short')}
      </div>
    </div>
  );
}

export default function Layout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<'all' | string | null>(null);
  const confirmDeleteTargetRef = useRef<'all' | string | null>(null);
  confirmDeleteTargetRef.current = confirmDeleteTarget;
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    toasts,
    unreadCount,
    markAllRead,
    markTypeRead,
    markNotificationRead,
    markMultipleRead,
    deleteNotification,
    clearAll,
    dismissToast,
    triggerPriorityAlert,
  } = useNotifications();

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__testPriorityAlert = () => {
        triggerPriorityAlert({
          barangay: 'Tranca',
          type: 'Fire',
          urgency: 'High',
          title: 'Fire Emergency Alert',
          message: 'May duguan pong bata dito sa tranca, malapit po sa harap ng simbahan dito ito din po ang contact...',
          targetPath: '/incident-reports',
        });
      };
    }
  }, [triggerPriorityAlert]);

  const { incompleteCount } = useBotConversations();

  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search') || params.get('q') || '';
    if (location.pathname === '/incident-reports') {
      setGlobalSearch(q);
    }
  }, [location.pathname, location.search]);

  const handleGlobalSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = globalSearch.trim();
    if (query) {
      navigate(`/incident-reports?search=${encodeURIComponent(query)}`);
    } else if (location.pathname === '/incident-reports') {
      navigate('/incident-reports');
    }
  };

  // Scroll container ref for notification dropdown
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [viewedNotifIds, setViewedNotifIds] = useState<Set<string>>(new Set());
  const viewedNotifIdsRef = useRef<Set<string>>(new Set());
  viewedNotifIdsRef.current = viewedNotifIds;


  // Clear unread notifications when viewing the corresponding page
  useEffect(() => {
    if (location.pathname === '/scraper-feed') {
      markTypeRead('scraper');
    } else if (location.pathname === '/messenger-bot-logs') {
      markTypeRead('messenger');
    }
  }, [location.pathname, markTypeRead]);

  // Keep notifications bold & highlighted while the notification panel is open.
  // When the user closes the panel, mark ONLY the notifications that were actually scrolled/viewed as read.
  const prevNotifOpenRef = useRef(notifOpen);
  useEffect(() => {
    if (prevNotifOpenRef.current && !notifOpen) {
      if (viewedNotifIdsRef.current.size > 0) {
        markMultipleRead(Array.from(viewedNotifIdsRef.current));
      }
    }
    if (notifOpen && !prevNotifOpenRef.current) {
      setViewedNotifIds(new Set());
      viewedNotifIdsRef.current = new Set();
    }
    prevNotifOpenRef.current = notifOpen;
  }, [notifOpen, markMultipleRead]);

  // Option A: Track notifications that enter the viewport (IntersectionObserver with 50% threshold)
  useEffect(() => {
    if (!notifOpen || !listContainerRef.current) return;

    const container = listContainerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const newlySeen: string[] = [];
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const notifId = entry.target.getAttribute('data-notif-id');
            const isUnread = entry.target.getAttribute('data-unread') === 'true';
            if (notifId && isUnread) {
              newlySeen.push(notifId);
            }
          }
        });

        if (newlySeen.length > 0) {
          setViewedNotifIds((prev) => {
            let changed = false;
            const next = new Set(prev);
            for (const id of newlySeen) {
              if (!next.has(id)) {
                next.add(id);
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }
      },
      {
        root: container,
        threshold: [0.5],
      }
    );

    const rows = container.querySelectorAll<HTMLElement>('[data-notif-id][data-unread="true"]');
    rows.forEach((row) => observer.observe(row));

    return () => {
      observer.disconnect();
    };
  }, [notifOpen, activeTab, notifications]);


  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (user?.email) {
      navigator.clipboard.writeText(user.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteTarget === 'all') {
      clearAll();
    } else if (confirmDeleteTarget) {
      deleteNotification(confirmDeleteTarget);
    }
    setConfirmDeleteTarget(null);
  };

  // Close notification & profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (confirmDeleteTargetRef.current) return;
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile sidebar, notification dropdown, and profile dropdown on route change
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  // Handle escape key and desktop resize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDeleteTargetRef.current) {
          setConfirmDeleteTarget(null);
          return;
        }
        setMobileOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleConfirmSignOut = async () => {
    try {
      setIsSigningOut(true);
      await logout();
      setSignOutModalOpen(false);
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  };


  const isActive = (p: string) => location.pathname === p;
  const isSettingsPage = location.pathname.startsWith('/settings');

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
    { path: '/incident-reports', label: 'Incident Reports', shortLabel: 'Reports', icon: FileText },
    { path: '/messenger-bot-logs', label: 'Messenger Logs', shortLabel: 'Messenger', icon: MessageSquare },
    { path: '/scraper-feed', label: 'Scraper Feed', shortLabel: 'Scraper', icon: Globe },
    { path: '/geospatial-map', label: 'Geospatial Map', shortLabel: 'Map', icon: Map },
    { path: '/analytics', label: 'Analytics', shortLabel: 'Analytics', icon: BarChart3 },
    { path: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
  ];

  const filteredNotifications =
    activeTab === 'all'
      ? notifications
      : activeTab === 'priority'
      ? notifications.filter((n) => n.type === 'priority' || n.isPriority)
      : notifications.filter((n) => n.type === activeTab);

  const priorityUnread = notifications.filter(
    (n) => (n.type === 'priority' || n.isPriority) && !n.read
  ).length;
  const scraperUnread = notifications.filter((n) => n.type === 'scraper' && !n.read).length;
  const messengerUnread = notifications.filter((n) => n.type === 'messenger' && !n.read).length;

  const unreadInTab = useMemo(() => {
    return filteredNotifications.filter((n) => !n.read);
  }, [filteredNotifications]);

  const totalUnreadInTab = unreadInTab.length;
  const viewedUnreadInTabCount = useMemo(() => {
    return unreadInTab.filter((n) => viewedNotifIds.has(n.id)).length;
  }, [unreadInTab, viewedNotifIds]);

  const remainingUnseenInTab = Math.max(0, totalUnreadInTab - viewedUnreadInTabCount);

  const scrollToNextUnseen = () => {
    if (!listContainerRef.current) return;
    const container = listContainerRef.current;
    const unviewedRow = container.querySelector<HTMLElement>(
      '[data-notif-id][data-unread="true"]:not([data-viewed="true"])'
    );
    if (unviewedRow) {
      unviewedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      container.scrollBy({ top: 120, behavior: 'smooth' });
    }
  };

  const handleBellClick = () => {
    setNotifOpen((prev) => !prev);
  };

  const handleNotifClick = (notif: AppNotification) => {
    markNotificationRead(notif.id);
    setNotifOpen(false);
    navigate(notif.targetPath);
  };

  return (
    <div
      className="relative h-screen overflow-hidden flex bg-cover bg-center bg-no-repeat bg-fixed transition-colors duration-300"
      style={{
        backgroundImage: theme === 'dark'
          ? "linear-gradient(rgba(11, 15, 25, 0.94), rgba(11, 15, 25, 0.94)), url('/DashboardBG.jpg')"
          : "url('/DashboardBG.jpg')",
      }}
    >
      {/* Ambient background glows for frosted glass refraction */}

      {/* ─── SIDEBAR (Frosted Glass — Visible on Tablet/Desktop, Hidden on Cellphone) ─── */}
      <aside
        id="app-sidebar"
        className={`
          fixed z-[60] flex flex-col
          hidden md:flex
          top-4 bottom-4 left-4
          w-18 ${collapsed ? 'lg:w-18' : 'lg:w-64'}
          backdrop-blur-2xl backdrop-saturate-180
          bg-white/95 dark:bg-slate-900/95
          lg:bg-white/45 lg:dark:bg-slate-900/60
          rounded-2xl
          border border-white/60 dark:border-white/10
          shadow-[0_8px_32px_0_rgba(31,38,135,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.9)]
          dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.1)]
          transition-all duration-300 ease-in-out
        `}
      >
        {/* Logo */}
        <div className={`
          h-16 flex items-center shrink-0
          md:justify-center md:px-0 md:gap-0
          ${collapsed ? 'lg:justify-center lg:px-0 lg:gap-0' : 'lg:justify-start lg:px-4 lg:gap-3'}
        `}>
          <div className="sidebar-logo h-10 w-10 shrink-0 overflow-hidden rounded-full shadow-[0_6px_18px_rgba(37,99,235,.35)] ring-2 ring-white/80 cursor-pointer flex items-center justify-center">
            <img
              src="/Responde_Logo.png"
              alt="Responde"
              className="h-full w-full rounded-full object-cover"
            />
          </div>
          <span className={`
            font-bold text-slate-800 dark:text-white text-base tracking-tight
            transition-all duration-300 overflow-hidden whitespace-nowrap
            hidden lg:block
            ${collapsed ? 'lg:w-0 lg:opacity-0' : 'lg:w-auto lg:opacity-100'}
          `}>
            RESPONDE
          </span>
        </div>

        {/* thin divider */}
        <div className="mx-3 h-px bg-white/60 dark:bg-white/10 shrink-0 shadow-[0_1px_0_rgba(0,0,0,0.03)]" />

        {/* Navigation */}
        <nav
          className="flex-1 py-4 px-2.5 space-y-1.5 overflow-y-auto"
          onMouseLeave={() => setHoveredNav(null)}
        >
          {navItems.map((item) => {
            const active = isActive(item.path);
            const isCollapsed = collapsed && !mobileOpen;
            const isHovered = hoveredNav === item.path && !active;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-nav-item={item.path}
                onClick={() => setMobileOpen(false)}
                onMouseEnter={() => {
                  setHoveredNav(item.path);
                  prefetchRoute(item.path);
                }}
                onPointerDown={() => prefetchRoute(item.path)}
                className={`
                  navlink relative group flex items-center rounded-xl px-3.5 py-2.5 transition-colors duration-150 active:scale-[0.97]
                  md:justify-center md:px-0 md:gap-0 select-none
                  ${isCollapsed ? 'lg:justify-center lg:px-0 lg:gap-0' : 'gap-3 lg:justify-start lg:px-3.5 lg:gap-3'}
                  ${active
                    ? 'font-semibold text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }
                `}
                title={item.label}
              >
                {/* Active Sliding Pill with Apple Spring Physics */}
                {active && (
                  <motion.div
                    layoutId="activeSidebarPill"
                    className="absolute inset-0 rounded-xl bg-white/85 dark:bg-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.12)] border border-white/90 dark:border-white/10 backdrop-blur-md"
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 32,
                      mass: 0.8,
                    }}
                  />
                )}

                {/* Smooth Hover Highlight */}
                {isHovered && (
                  <motion.div
                    layoutId="hoverSidebarPill"
                    className="absolute inset-0 rounded-xl bg-white/45 dark:bg-white/8 border border-white/40 dark:border-white/5"
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 34,
                    }}
                  />
                )}

                <motion.div
                  animate={{ scale: active ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className={`
                  relative z-10 shrink-0 flex items-center justify-center transition-colors duration-200
                  ${active
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                  }
                `}>
                  <item.icon className="w-5.5 h-5.5" strokeWidth={active ? 2.5 : 1.75} />
                  {item.path === '/messenger-bot-logs' && incompleteCount > 0 && (
                    <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[oklch(62.3%_0.214_259.815)] ring-2 ring-white dark:ring-[#111827] animate-pulse md:block ${isCollapsed ? 'lg:block' : 'lg:hidden'}`} />
                  )}
                </motion.div>
                <span className={`
                  relative z-10 text-[13px] transition-all duration-300 overflow-hidden whitespace-nowrap
                  block md:hidden lg:block
                  ${active
                    ? 'text-blue-700 dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:hover:text-white font-medium'
                  }
                  ${isCollapsed ? 'lg:w-0 lg:opacity-0' : 'lg:w-auto lg:opacity-100 shrink-0'}
                `}>
                  {item.label}
                </span>
                {item.path === '/messenger-bot-logs' && incompleteCount > 0 && (
                  <span className={`relative z-10 ml-auto shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[oklch(62.3%_0.214_259.815)]/10 text-[oklch(62.3%_0.214_259.815)] border border-[oklch(62.3%_0.214_259.815)]/20 tabular-nums block md:hidden ${isCollapsed ? 'lg:hidden' : 'lg:block'}`}>
                    {incompleteCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* thin divider */}
        <div className="mx-3 h-px bg-white/60 dark:bg-white/10 shrink-0 shadow-[0_1px_0_rgba(0,0,0,0.03)]" />

        {/* Sign Out */}
        <div className="px-2.5 pb-3 pt-1 shrink-0">
          <button
            id="sidebar-signout-btn"
            onClick={() => {
              setMobileOpen(false);
              setSignOutModalOpen(true);
            }}
            className={`
              signout-btn group relative flex items-center w-full rounded-xl px-3.5 py-2.5 active:scale-[0.97] select-none
              md:justify-center md:px-0 md:gap-0
              ${collapsed && !mobileOpen ? 'lg:justify-center lg:px-0 lg:gap-0' : 'gap-3 lg:justify-start lg:px-3.5 lg:gap-3'}
              text-slate-600 dark:text-slate-300 hover:bg-red-500/10 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 cursor-pointer
            `}
            title="Sign Out"
          >
            <div className="shrink-0 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-red-500 transition-colors duration-200">
              <LogOut className="w-5.5 h-5.5" strokeWidth={1.75} />
            </div>
            <span className={`
              text-[13px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-red-500 group-hover:translate-x-1
              transition-[color,transform,width,opacity] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden whitespace-nowrap
              block md:hidden lg:block
              ${collapsed && !mobileOpen ? 'lg:w-0 lg:opacity-0' : 'lg:w-auto lg:opacity-100 shrink-0'}
            `}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      {/* left margin accounts for: 16px gap-left + sidebar width + 16px gap-right */}
      <main
        className={`
          flex-1 flex flex-col min-w-0 min-h-0 h-full transition-all duration-300
          ml-0 md:ml-[calc(16px+72px+8px)] ${collapsed ? 'lg:ml-[calc(16px+72px+8px)]' : 'lg:ml-[calc(16px+256px+8px)]'}
          md:pb-4 lg:pb-4 md:pr-4 lg:pr-4
        `}
      >
        {/* ─── FLOATING HEADER (Frosted Glass) ─── */}
        {!isSettingsPage && (
          <div className="shrink-0 px-2 sm:px-4 md:px-0 md:pl-2 pt-3 sm:pt-4 z-[100] relative">
          <header className="
            h-16.25 flex items-center justify-between px-4
            backdrop-blur-xl backdrop-saturate-180
            bg-white/45 dark:bg-slate-900/60
            border border-white/60 dark:border-white/10
            shadow-[0_8px_32px_0_rgba(31,38,135,0.08),inset_0_1px_1px_0_rgba(255,255,255,0.9)]
            dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.1)]
            rounded-2xl sm:rounded-3xl
            transition-all duration-300
          ">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              {/* Mobile Brand Logo (< md) — visible since sidebar is hidden on cellphone */}
              <Link to="/dashboard" className="flex items-center gap-2 md:hidden shrink-0 select-none">
                <img
                  src="/Responde_Logo.png"
                  alt="Responde"
                  className="w-7 h-7 rounded-lg object-cover shrink-0"
                />
                <span className="font-bold text-slate-800 dark:text-white text-sm tracking-tight">
                  RESPONDE
                </span>
              </Link>

              {/* Desktop/Tablet Sidebar Collapse Toggle (>= md) */}
              <button
                id="sidebar-toggle-btn"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setCollapsed((prev) => !prev)}
                className="hidden md:flex shrink-0 p-2 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition-colors active:scale-95 cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              {/* Search — floating pill inside the floating header */}
              <form
                onSubmit={handleGlobalSearchSubmit}
                className="hidden sm:flex items-center relative flex-1 max-w-sm"
              >
                <div className="
                w-full flex items-center gap-2 px-3
                bg-white/50 dark:bg-slate-800/60
                border border-white/60 dark:border-white/10
                shadow-sm
                rounded-xl
                transition-all duration-200
                focus-within:bg-white/80 dark:focus-within:bg-slate-800/90
                focus-within:border-blue-400/60 dark:focus-within:border-blue-500/50
                focus-within:shadow-[0_4px_16px_rgba(59,130,246,0.14),inset_0_1px_2px_rgba(255,255,255,0.8)]
                dark:focus-within:shadow-[0_4px_16px_rgba(59,130,246,0.22)]
              ">
                  <button
                    type="submit"
                    className="shrink-0 p-0 text-slate-400 hover:text-[#0071E3] transition-colors cursor-pointer"
                    aria-label="Search"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    placeholder="Search incidents, logs, or barangays..."
                    className="w-full py-2 bg-transparent border-0 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                  />
                  {globalSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setGlobalSearch('');
                        if (location.pathname === '/incident-reports') {
                          navigate('/incident-reports');
                        }
                      }}
                      className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="flex items-center gap-4">
              {/* ── Notification Bell ── */}
              <div ref={notifRef} className="relative z-10">
                <button
                  id="notification-bell-btn"
                  onClick={handleBellClick}
                  className="bell-btn relative p-2.5 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition-colors duration-200 active:scale-95 cursor-pointer"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span
                        key="badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#0F1525]"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                {/* ── Notification Dropdown ── */}
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      id="notification-dropdown"
                      initial={{ opacity: 0, x: 16, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        x: 12,
                        scale: 0.97,
                        transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
                      }}
                      transition={{
                        duration: 0.36,
                        ease: APPLE_DECEL_EASE,
                      }}
                      className="origin-top-right fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-20 sm:top-full mt-0 sm:mt-2 w-auto sm:w-[420px] max-w-[calc(100vw-1.5rem)] sm:max-w-none bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] z-[110] overflow-hidden flex flex-col"
                    >
                      {/* ── Stage 1: Header (Ambatubazz Cascade) ── */}
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: 0.03, ease: APPLE_DECEL_EASE }}
                        className="flex items-center justify-between px-4.5 py-3 border-b border-slate-100/80 dark:border-white/5 shrink-0 bg-transparent"
                      >
                        <motion.div
                          initial="rest"
                          whileHover="hover"
                          animate="rest"
                          className="bell-btn flex items-center gap-2 cursor-default select-none"
                        >
                          <motion.span variants={BELL_SWING_VARIANTS} className="inline-flex items-center justify-center">
                            <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          </motion.span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            Notifications
                          </span>
                          {notifications.length > 0 && (
                            <span className="px-2 py-0.5 bg-slate-100/90 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-semibold rounded-full tabular-nums">
                              {notifications.length > 99 ? '99+' : notifications.length}
                            </span>
                          )}
                        </motion.div>
                        <div className="flex items-center gap-1">
                          {unreadCount > 0 && (
                            <button
                              type="button"
                              onClick={markAllRead}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0071E3] dark:text-sky-400 bg-blue-500/10 hover:bg-blue-500/15 rounded-xl transition-all active:scale-95 cursor-pointer"
                              title="Mark all notifications as read"
                              aria-label="Mark all notifications as read"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Mark all read</span>
                            </button>
                          )}
                          {notifications.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTarget('all')}
                              className="p-1.5 rounded-xl text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200/70 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/60 hover:text-red-600 dark:hover:text-red-300 shadow-2xs transition-all active:scale-90 cursor-pointer"
                              title="Clear all notifications"
                              aria-label="Clear all notifications"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setNotifOpen(false)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-500/10 transition-all active:scale-90 cursor-pointer"
                            title="Close notification panel"
                            aria-label="Close notification panel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>

                      {/* ── Stage 2: Filter Tabs (Segmented Control - Ambatubazz Cascade) ── */}
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: 0.06, ease: APPLE_DECEL_EASE }}
                        className="p-1.5 mx-3.5 mb-2 bg-slate-200/50 dark:bg-white/[0.05] backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-center gap-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
                      >
                        {([
                          { key: 'all' as const, label: 'All', icon: Inbox, count: notifications.length },
                          { key: 'priority' as const, label: 'Priority', icon: Siren, count: priorityUnread },
                          { key: 'scraper' as const, label: 'Scraper', icon: Globe2, count: scraperUnread },
                          { key: 'messenger' as const, label: 'Messenger', icon: MessageCircle, count: messengerUnread },
                        ]).map((tab) => {
                          const isPriorityTab = tab.key === 'priority';
                          const isSelected = activeTab === tab.key;
                          const IconComponent = tab.icon;
                          const animation = NOTIF_TAB_ANIMATIONS[tab.key];
                          return (
                            <motion.button
                              key={tab.key}
                              type="button"
                              initial="rest"
                              whileHover="hover"
                              animate="rest"
                              onClick={() => {
                                setActiveTab(tab.key);
                                if (listContainerRef.current) {
                                  listContainerRef.current.scrollTop = 0;
                                }
                              }}
                              className={`group relative flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-xs transition-colors duration-150 cursor-pointer select-none ${
                                isSelected
                                  ? 'text-white font-semibold'
                                  : isPriorityTab && tab.count > 0
                                  ? 'text-red-600 dark:text-red-400 font-bold hover:bg-red-500/10'
                                  : 'text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
                              }`}
                            >
                              {isSelected && (
                                <motion.div
                                  layoutId="activeNotifTabIndicator"
                                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                  className={`absolute inset-0 rounded-xl ${
                                    isPriorityTab
                                      ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-[0_2px_8px_rgba(239,68,68,0.35)]'
                                      : 'bg-[#0071E3] shadow-[0_2px_8px_rgba(0,113,227,0.35)]'
                                  }`}
                                />
                              )}
                              <span className="relative z-10 flex items-center gap-1 truncate">
                                <motion.span
                                  variants={animation}
                                  className="inline-flex shrink-0 items-center justify-center"
                                >
                                  <IconComponent className="w-3.5 h-3.5 shrink-0" />
                                </motion.span>
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 tabular-nums ${
                                      isSelected
                                        ? 'bg-white/25 text-white'
                                        : isPriorityTab
                                        ? 'bg-red-500 text-white'
                                        : 'bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {tab.count > 99 ? '99+' : tab.count}
                                  </span>
                                )}
                              </span>
                            </motion.button>
                          );
                        })}
                      </motion.div>

                      {/* ── Stage 3: Notification List Viewport (Fixed Height, Staggered Reveal) ── */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.24, delay: 0.09, ease: APPLE_DECEL_EASE }}
                        className="relative flex-1 min-h-0 flex flex-col bg-transparent"
                      >
                        <div
                          ref={listContainerRef}
                          className="h-[340px] sm:h-[360px] overflow-y-auto pb-6 divide-y divide-slate-100/80 dark:divide-white/5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 bg-transparent"
                          style={{
                            maskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)',
                          }}
                        >
                          <AnimatePresence initial={false} mode="wait">
                            <motion.div
                              key={activeTab}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.16, ease: APPLE_DECEL_EASE }}
                              className="divide-y divide-slate-100/80 dark:divide-white/5"
                            >
                              {filteredNotifications.length === 0 ? (
                                <div className="h-[340px] sm:h-[360px] flex flex-col items-center justify-center py-12 px-4 gap-2 text-slate-400 text-center">
                                  <BellOff className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                  <p className="text-sm font-medium">No notifications yet</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">
                                    New scraper &amp; messenger events will appear here in real-time
                                  </p>
                                </div>
                              ) : (
                                filteredNotifications.map((n) => (
                                  <NotificationRow
                                    key={n.id}
                                    notification={n}
                                    isViewed={viewedNotifIds.has(n.id)}
                                    onClick={() => handleNotifClick(n)}
                                    onDelete={() => setConfirmDeleteTarget(n.id)}
                                  />
                                ))
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        {/* Floating "more new below" scroll pill */}
                        <AnimatePresence>
                          {remainingUnseenInTab > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 8, scale: 0.95 }}
                              transition={{ duration: 0.22, ease: APPLE_DECEL_EASE }}
                              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
                            >
                              <button
                                type="button"
                                onClick={scrollToNextUnseen}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0071E3] hover:bg-[#0077ED] active:scale-95 text-white text-[11px] font-semibold shadow-md shadow-blue-500/25 transition-all cursor-pointer backdrop-blur-md"
                              >
                                <ArrowDown className="w-3 h-3" />
                                <span>{remainingUnseenInTab} more new</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      {/* ── Stage 4: Stable Footer (Ambatubazz Cascade) ── */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: 0.12, ease: APPLE_DECEL_EASE }}
                        className="px-4 py-2.5 border-t border-slate-100/80 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-white/[0.02] text-xs text-slate-400 dark:text-slate-500"
                      >
                        <span>
                          {filteredNotifications.length} notification
                          {filteredNotifications.length !== 1 ? 's' : ''}
                        </span>
                        {unreadInTab.length > 0 && (
                          <span className="font-medium text-[#0071E3] dark:text-sky-400">
                            {unreadInTab.length} unread
                          </span>
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div ref={profileRef} className="relative flex items-center gap-3 pl-4 border-l border-white/60 dark:border-white/10 z-10">
                <PhilippineClock />
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className={`profile-avatar-btn group relative w-9 h-9 rounded-full ring-2 cursor-pointer focus:outline-none flex items-center justify-center active:scale-95 ${
                    profileOpen
                      ? 'ring-[#0071E3] dark:ring-sky-400 shadow-[0_0_0_4px_rgba(0,113,227,0.18),0_6px_16px_rgba(0,113,227,0.28)] scale-[1.05]'
                      : 'ring-white/85 dark:ring-white/15 hover:ring-[#0071E3] dark:hover:ring-sky-400 shadow-sm'
                  }`}
                  aria-label="User profile menu"
                  aria-expanded={profileOpen}
                >
                  <UserAvatar
                    src={user?.avatar_url}
                    name={user?.full_name}
                    username={user?.username}
                    size="md"
                  />
                  <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-120 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.85)]" />
                </button>

                {/* Profile Dropdown (Ambatubazz Cascade) */}
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      id="profile-dropdown-menu"
                      initial={{ opacity: 0, x: 16, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        x: 12,
                        scale: 0.97,
                        transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
                      }}
                      transition={{
                        duration: 0.36,
                        ease: APPLE_DECEL_EASE,
                      }}
                      className="origin-top-right absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_24px_60px_rgba(0,0,0,0.25)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.85)] z-[110] p-2.5 overflow-hidden flex flex-col"
                    >
                      {/* ── Stage 1: Identity Card ── */}
                      <motion.div
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.28, delay: 0.04, ease: APPLE_DECEL_EASE }}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/60 mb-2"
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={user?.avatar_url}
                            name={user?.full_name}
                            username={user?.username}
                            size="lg"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate leading-tight">
                              {user?.full_name || user?.username || 'User Profile'}
                            </p>
                            {user?.username && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                                @{user.username}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center">
                              {(() => {
                                const role = getRoleBadge(user?.role);
                                return (
                                  <span
                                    className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${role.className}`}
                                  >
                                    {role.label}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Email with 1-click copy */}
                        {user?.email && (
                          <div className="mt-2.5 flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80">
                            <span
                              className="text-[11px] text-slate-600 dark:text-slate-300 truncate font-mono select-all"
                              title={user.email}
                            >
                              {user.email}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyEmail}
                              className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title={copiedEmail ? 'Copied to clipboard!' : 'Copy email'}
                              aria-label="Copy email address"
                            >
                              {copiedEmail ? (
                                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Copied</span>
                                </span>
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </motion.div>

                      {/* ── Stage 2: Quick Actions ── */}
                      <motion.div
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.26, delay: 0.08, ease: APPLE_DECEL_EASE }}
                        className="space-y-0.5"
                      >
                        <Link
                          to="/settings"
                          onClick={() => setProfileOpen(false)}
                          onMouseEnter={() => prefetchRoute('/settings')}
                          onPointerDown={() => prefetchRoute('/settings')}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] rounded-xl transition-all"
                        >
                          <Settings className="w-4 h-4 text-slate-400" />
                          <span>Account Settings</span>
                        </Link>

                        <button
                          type="button"
                          onClick={toggleTheme}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] rounded-xl transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            {theme === 'dark' ? (
                              <Moon className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Sun className="w-4 h-4 text-amber-500" />
                            )}
                            <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                          </div>
                          <div
                            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${
                              theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform ${
                                theme === 'dark' ? 'translate-x-3.5' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </button>
                      </motion.div>

                      {/* ── Stage 3: Sign Out ── */}
                      <motion.div
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.24, delay: 0.12, ease: APPLE_DECEL_EASE }}
                        className="border-t border-slate-100 dark:border-slate-800/80 mt-1 pt-1"
                      >
                        <button
                          type="button"
                          id="header-signout-btn"
                          onClick={() => {
                            setProfileOpen(false);
                            setSignOutModalOpen(true);
                          }}
                          className="signout-btn group flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98] rounded-xl cursor-pointer text-left w-full"
                        >
                          <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">Sign Out</span>
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>
          </div>
        )}

        <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden px-3.5 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:pr-0 md:pl-2 lg:pb-0 lg:pr-0 lg:pl-2 ${
          isSettingsPage
            ? 'pt-4 sm:pt-4 md:pt-4 lg:pt-4'
            : 'pt-3 sm:pt-3.5 md:pt-3.5 lg:pt-3.5'
        }`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
              transition={{
                duration: 0.22,
                ease: [0.23, 1, 0.32, 1],
              }}
              className="flex-1 flex flex-col min-h-full h-full w-full"
            >
              <Outlet context={{ collapsed, setCollapsed, toggleSidebar: () => setCollapsed((prev) => !prev) } satisfies LayoutOutletContext} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Mobile Floating Bottom Navigation Bar (<768px) ── */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-50 md:hidden max-w-lg mx-auto backdrop-blur-2xl backdrop-saturate-180 bg-white/90 dark:bg-slate-900/90 border border-white/70 dark:border-white/10 px-1.5 py-1.5 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] transition-all duration-300"
      >
        <div className="flex items-center justify-between w-full">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const isMessenger = item.path === '/messenger-bot-logs';
            const isScraper = item.path === '/scraper-feed';
            const hasMessengerBadge = isMessenger && incompleteCount > 0;
            const hasScraperBadge = isScraper && scraperUnread > 0;

            return (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => prefetchRoute(item.path)}
                onPointerDown={() => prefetchRoute(item.path)}
                onTouchStart={() => prefetchRoute(item.path)}
                className={`relative flex flex-col items-center justify-center py-1 px-1 flex-1 rounded-xl transition-all duration-150 active:scale-90 min-h-[46px] select-none ${
                  active
                    ? 'text-blue-600 dark:text-sky-400 font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title={item.label}
                aria-label={item.label}
              >
                {/* Active Sliding Pill with Apple Spring Physics */}
                {active && (
                  <motion.div
                    layoutId="floatingMobileActivePill"
                    className="absolute inset-0 rounded-xl bg-blue-500/10 dark:bg-white/10 border border-blue-500/20 dark:border-white/10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }}
                  />
                )}

                <div className="relative">
                  <item.icon className="w-5 h-5 relative z-10" strokeWidth={active ? 2.4 : 1.8} />

                  {hasMessengerBadge && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[oklch(62.3%_0.214_259.815)] ring-2 ring-white dark:ring-slate-900 animate-pulse z-10" />
                  )}

                  {hasScraperBadge && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse z-10" />
                  )}
                </div>

                <span className="relative z-10 text-[9px] tracking-tight leading-tight mt-0.5 truncate max-w-[46px]">
                  {item.shortLabel || item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Global Toast Renderer ── */}
      <div
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <GlobalToast
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
              onView={(path) => {
                dismissToast(toast.id);
                navigate(path);
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ── Sign Out Confirmation Modal ── */}
      <SignOutModal
        isOpen={signOutModalOpen}
        onClose={() => {
          if (!isSigningOut) setSignOutModalOpen(false);
        }}
        onConfirm={handleConfirmSignOut}
        isLoading={isSigningOut}
        user={user}
      />

      {/* ── Delete Notification Confirmation Modal ── */}
      <DeleteNotificationModal
        isOpen={confirmDeleteTarget !== null}
        target={confirmDeleteTarget}
        notification={
          typeof confirmDeleteTarget === 'string'
            ? notifications.find((n) => n.id === confirmDeleteTarget)
            : null
        }
        onClose={() => setConfirmDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

// ── NotificationRow ───────────────────────────────────────────────────────────

function NotificationRow({
  notification: n,
  isViewed = false,
  onClick,
  onDelete,
}: {
  notification: AppNotification;
  isViewed?: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const isPriority = n.type === 'priority' || n.isPriority;
  const isMessenger = n.type === 'messenger';
  const timeAgo = formatTimeAgo(n.timestamp);

  return (
    <motion.div
      data-notif-id={n.id}
      data-unread={!n.read}
      data-viewed={isViewed}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: APPLE_DECEL_EASE }}
      className={`group relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors duration-150 active:scale-[0.99] select-none ${
        !n.read
          ? isPriority
            ? 'bg-red-500/[0.04] dark:bg-red-500/[0.08] hover:bg-red-500/[0.08] dark:hover:bg-red-500/[0.12]'
            : 'bg-[#0071E3]/[0.03] dark:bg-[#0071E3]/[0.06] hover:bg-[#0071E3]/[0.07] dark:hover:bg-[#0071E3]/[0.1]'
          : 'bg-transparent hover:bg-slate-500/[0.04] dark:hover:bg-white/[0.03] opacity-80 hover:opacity-100'
      }`}
      onClick={onClick}
      onMouseEnter={() => prefetchRoute(n.targetPath)}
      onPointerDown={() => prefetchRoute(n.targetPath)}
    >
      {/* Icon squircle with micro-lift */}
      <div
        className={`shrink-0 mt-0.5 w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:-translate-y-0.5 ${
          !n.read
            ? isPriority
              ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 ring-1 ring-red-500/20 shadow-xs'
              : isMessenger
              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 ring-1 ring-purple-500/20 shadow-xs'
              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 ring-1 ring-blue-500/20 shadow-xs'
            : 'bg-slate-100/80 dark:bg-white/5 text-slate-400 dark:text-slate-500'
        }`}
      >
        {isPriority ? (
          <Siren className="w-4 h-4 text-red-600 dark:text-red-400" />
        ) : isMessenger ? (
          <MessageCircle className="w-4 h-4" />
        ) : (
          <Globe2 className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <p
            className={`text-xs truncate tracking-tight transition-colors ${
              !n.read
                ? isPriority
                  ? 'font-bold text-red-950 dark:text-red-100'
                  : 'font-bold text-slate-900 dark:text-white'
                : 'font-medium text-slate-500 dark:text-slate-400'
            }`}
          >
            {n.title}
          </p>

          {!n.read && (
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isPriority
                  ? 'bg-red-600 ring-2 ring-red-500/30 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                  : 'bg-[#0071E3] ring-2 ring-blue-500/30 shadow-[0_0_6px_rgba(0,113,227,0.6)]'
              }`}
            />
          )}

          {isPriority ? (
            <span
              className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full transition-colors flex items-center gap-1 font-semibold ${
                !n.read
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-normal border border-slate-200/50 dark:border-slate-700/50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
              Priority
            </span>
          ) : isMessenger ? (
            <span
              className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full transition-colors font-semibold ${
                !n.read
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-normal border border-slate-200/50 dark:border-slate-700/50'
              }`}
            >
              Messenger
            </span>
          ) : (
            <span
              className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full transition-colors font-semibold ${
                !n.read
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-[#0071E3] dark:text-blue-300 border border-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-normal border border-slate-200/50 dark:border-slate-700/50'
              }`}
            >
              Scraper
            </span>
          )}
        </div>

        {/* Barangay / Sender meta */}
        {(n.barangay || n.sender) && (
          <p
            className={`text-[11px] mb-1 transition-colors ${
              !n.read
                ? 'font-medium text-slate-700 dark:text-slate-300'
                : 'font-normal text-slate-400 dark:text-slate-500'
            }`}
          >
            {n.barangay ? `📍 ${n.barangay}` : `👤 ${n.sender}`}
          </p>
        )}

        {/* Message snippet */}
        <p
          className={`text-xs line-clamp-2 leading-relaxed transition-colors ${
            !n.read
              ? 'font-medium text-slate-800 dark:text-slate-200'
              : 'font-normal text-slate-400 dark:text-slate-500'
          }`}
        >
          {n.message}
        </p>

        <p
          className={`text-[10px] mt-1.5 transition-colors tabular-nums ${
            !n.read
              ? 'font-semibold text-[#0071E3] dark:text-blue-400'
              : 'font-normal text-slate-400/70 dark:text-slate-500'
          }`}
        >
          {timeAgo}
        </p>
      </div>

      {/* Dismiss / Delete button - Minimalist iOS hover style */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 p-1.5 rounded-xl text-red-500 dark:text-red-400 bg-red-50/90 dark:bg-red-950/40 border border-red-200/70 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/60 hover:text-red-600 dark:hover:text-red-300 shadow-2xs transition-all cursor-pointer active:scale-90"
        title="Delete notification"
        aria-label="Delete notification"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ── GlobalToast ───────────────────────────────────────────────────────────────

function GlobalToast({
  toast,
  onDismiss,
  onView,
}: {
  toast: ToastNotification;
  onDismiss: (id: number) => void;
  onView: (path: string) => void;
}) {
  const isPriority = toast.isPriority || toast.type === 'priority';
  const isMessenger = toast.type === 'messenger';
  const duration = isPriority ? 10000 : 5500;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss, duration]);

  const cleanTitle = useMemo(() => {
    let t = toast.title || '';
    t = t.replace(/^[🚨\s]*/g, '').replace(/^PRIORITY ALERT:\s*/i, '').trim();
    if (!t || t.toLowerCase() === 'high-urgency incident') {
      return toast.incidentType
        ? `${toast.incidentType} Emergency Alert`
        : 'High-Urgency Incident';
    }
    return t;
  }, [toast.title, toast.incidentType]);

  if (isPriority) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.96 }}
        transition={{ duration: 0.32, ease: APPLE_DECEL_EASE }}
        className="pointer-events-auto relative w-full sm:w-[420px] rounded-3xl p-4.5 bg-white/95 dark:bg-[#150a0d]/95 backdrop-blur-2xl border border-red-500/25 dark:border-red-500/35 border-t-white/80 dark:border-t-red-400/20 shadow-[0_20px_50px_-10px_rgba(239,68,68,0.28),0_0_0_1px_rgba(239,68,68,0.08)] overflow-hidden"
      >
        {/* Ambient radial emergency glow in top-left */}
        <div className="pointer-events-none absolute -top-12 -left-12 w-40 h-40 bg-red-500/15 dark:bg-red-500/20 rounded-full blur-2xl" />

        {/* Header Row: Beacon + Pill Badges + Close Button */}
        <div className="flex items-start gap-3 relative z-10">
          {/* Apple-style Concentric Glowing Beacon */}
          <div className="relative shrink-0 mt-0.5">
            <span className="absolute -inset-1 rounded-2xl bg-red-500/20 dark:bg-red-500/30 blur-xs" />
            <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30">
              <Siren className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Details & Badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Priority Pill */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                Priority Alert
              </span>

              {/* Barangay Pill */}
              {toast.barangay && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200/80 dark:border-red-900/60">
                  <MapPin className="w-2.5 h-2.5 text-red-500" />
                  {toast.barangay}
                </span>
              )}

              {/* Incident Type Pill */}
              {toast.incidentType && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 border border-slate-200/70 dark:border-white/10">
                  {toast.incidentType}
                </span>
              )}
            </div>

            {/* Headline */}
            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight mt-1.5 leading-snug">
              {cleanTitle}
            </h4>
          </div>

          {/* Frosted Circular Close Button */}
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
            title="Dismiss alert"
            aria-label="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Message Bubble: Frosted, high legibility */}
        {toast.message && (
          <div className="mt-2.5 p-3 rounded-2xl bg-slate-50/90 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-normal line-clamp-2 select-text relative z-10">
            &ldquo;{toast.message}&rdquo;
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="mt-3.5 flex items-center gap-2 relative z-10">
          <button
            onClick={() => onView(toast.targetPath)}
            onMouseEnter={() => prefetchRoute(toast.targetPath)}
            onPointerDown={() => prefetchRoute(toast.targetPath)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] transition-all duration-150 shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/35 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>View Immediate Incident</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => onDismiss(toast.id)}
            className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.97] transition-all cursor-pointer"
          >
            Dismiss
          </button>
        </div>

        {/* Sleek Sub-millimeter Countdown Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-red-100 dark:bg-red-950/40 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 10, ease: 'linear' }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ duration: 0.32, ease: APPLE_DECEL_EASE }}
      className="pointer-events-auto relative flex items-start gap-3 pl-4 pr-3 pt-3.5 pb-5 rounded-2xl border shadow-xl min-w-[310px] max-w-97.5 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-2xl border-slate-200/80 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden"
    >
      {/* Icon */}
      <div
        className={`shrink-0 mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ${
          isMessenger
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
            : 'bg-blue-100 dark:bg-blue-900/30 text-[#0071E3] dark:text-sky-400'
        }`}
      >
        {isMessenger ? (
          <MessageCircle className="w-4 h-4" />
        ) : (
          <Globe2 className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{toast.title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
          {toast.message}
        </p>
        {/* View button */}
        <button
          onClick={() => onView(toast.targetPath)}
          onMouseEnter={() => prefetchRoute(toast.targetPath)}
          onPointerDown={() => prefetchRoute(toast.targetPath)}
          className={`mt-2 flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
            isMessenger
              ? 'text-purple-600 dark:text-purple-400 hover:text-purple-700'
              : 'text-[#0071E3] dark:text-sky-400 hover:text-[#0077ED]'
          }`}
        >
          View
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 mt-0.5 p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 rounded-lg transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      <motion.div
        className={`absolute bottom-0 left-0 h-[3px] ${isMessenger ? 'bg-purple-500' : 'bg-[#0071E3]'}`}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 5.5, ease: 'linear' }}
      />
    </motion.div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Delete Notification Confirmation Modal ─────────────────────────────────────

function DeleteNotificationModal({
  isOpen,
  target,
  notification,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  target: 'all' | string | null;
  notification?: AppNotification | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isAll = target === 'all';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="delete-notification-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: APPLE_DECEL_EASE }}
          className="fixed inset-0 z-[220] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            key="delete-notification-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-notification-title"
            aria-describedby="delete-notification-desc"
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{
              scale: 0.94,
              opacity: 0,
              y: 8,
              transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
            }}
            transition={{
              opacity: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
              scale: { type: 'spring', stiffness: 220, damping: 26, mass: 0.8 },
              y: { type: 'spring', stiffness: 220, damping: 26, mass: 0.8 },
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-[0_24px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.9)] p-5 sm:p-6 text-center relative overflow-hidden"
          >
            {/* Ambient Red Glow */}
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-red-500/10 dark:bg-red-500/15 rounded-full blur-xl pointer-events-none" />

            {/* Icon */}
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>

            {/* Title */}
            <h3
              id="delete-notification-title"
              className="text-base sm:text-lg font-bold text-slate-800 dark:text-white tracking-tight"
            >
              {isAll ? 'Clear All Notifications?' : 'Delete Notification?'}
            </h3>

            {/* Description */}
            <p
              id="delete-notification-desc"
              className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed"
            >
              {isAll
                ? 'Are you sure you want to clear all notifications? This action cannot be undone.'
                : notification
                  ? `Are you sure you want to delete "${notification.title}"?`
                  : 'Are you sure you want to delete this notification?'}
            </p>

            {/* Preview snippet for single item */}
            {!isAll && notification && (
              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-white/5 text-left flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5 text-xs">
                  {notification.type === 'messenger' ? '💬' : '🌐'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {notification.title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {notification.message}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-slate-700/80 transition-all active:scale-[0.98] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-[0.98] transition-all shadow-[0_2px_10px_rgba(220,38,38,0.3)] cursor-pointer"
              >
                {isAll ? 'Clear All' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
