import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FileText, MessageSquare, Globe, Map,
  BarChart3, Settings, Search, Bell, LogOut, Menu, X,
  Globe2, MessageCircle, CheckCheck, Trash2, BellOff, ArrowRight,
  Sun, Moon, Copy, Check,
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

type FilterTab = 'all' | NotificationType;

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

export default function Layout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
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
    markNotificationRead,
    deleteNotification,
    clearAll,
    dismissToast,
  } = useNotifications();

  const { incompleteCount } = useBotConversations();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Close mobile sidebar and profile dropdown on route change
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
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

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const formattedDate = currentTime.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const isActive = (p: string) => location.pathname === p;

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
      : notifications.filter((n) => n.type === activeTab);

  const scraperUnread = notifications.filter((n) => n.type === 'scraper' && !n.read).length;
  const messengerUnread = notifications.filter((n) => n.type === 'messenger' && !n.read).length;

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
          w-18 ${collapsed ? 'lg:w-18' : 'lg:w-56'}
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
          <img
            src="/Responde_Logo.png"
            alt="Responde"
            className="w-8 h-8 rounded-lg object-cover shrink-0"
          />
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
                onClick={() => setMobileOpen(false)}
                onMouseEnter={() => {
                  setHoveredNav(item.path);
                  prefetchRoute(item.path);
                }}
                onPointerDown={() => prefetchRoute(item.path)}
                className={`
                  relative group flex items-center rounded-xl px-4 py-2.5 transition-colors duration-150 active:scale-[0.97]
                  md:justify-center md:px-0 md:gap-0 select-none
                  ${isCollapsed ? 'lg:justify-center lg:px-0 lg:gap-0' : 'gap-3.5 lg:justify-start lg:px-4 lg:gap-3.5'}
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
                    <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#111827] animate-pulse md:block ${isCollapsed ? 'lg:block' : 'lg:hidden'}`} />
                  )}
                </motion.div>
                <span className={`
                  relative z-10 text-[13px] transition-all duration-300 overflow-hidden whitespace-nowrap
                  block md:hidden lg:block
                  ${active
                    ? 'text-blue-700 dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:hover:text-white font-medium'
                  }
                  ${isCollapsed ? 'lg:w-0 lg:opacity-0' : 'lg:w-auto lg:opacity-100'}
                `}>
                  {item.label}
                </span>
                {item.path === '/messenger-bot-logs' && incompleteCount > 0 && (
                  <span className={`relative z-10 ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 tabular-nums block md:hidden ${isCollapsed ? 'lg:hidden' : 'lg:block'}`}>
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
        <div className="px-2.5 py-3 shrink-0">
          <button
            id="sidebar-signout-btn"
            onClick={() => {
              setMobileOpen(false);
              setSignOutModalOpen(true);
            }}
            className={`
              group relative flex items-center w-full rounded-xl px-4 py-2.5 transition-colors duration-150 active:scale-[0.97] select-none
              md:justify-center md:px-0 md:gap-0
              ${collapsed && !mobileOpen ? 'lg:justify-center lg:px-0 lg:gap-0' : 'gap-3.5 lg:justify-start lg:px-4 lg:gap-3.5'}
              text-slate-600 dark:text-slate-300 hover:bg-red-500/10 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 border border-transparent cursor-pointer
            `}
            title="Sign Out"
          >
            <div className="shrink-0 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-red-500 transition-colors duration-200">
              <LogOut className="w-5.5 h-5.5" strokeWidth={1.75} />
            </div>
            <span className={`
              text-[13px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-red-500
              transition-all duration-300 overflow-hidden whitespace-nowrap
              block md:hidden lg:block
              ${collapsed && !mobileOpen ? 'lg:w-0 lg:opacity-0' : 'lg:w-auto lg:opacity-100'}
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
          ml-0 md:ml-[calc(16px+72px+8px)] ${collapsed ? 'lg:ml-[calc(16px+72px+8px)]' : 'lg:ml-[calc(16px+225px+8px)]'}
        `}
      >
        {/* ─── FLOATING HEADER (Frosted Glass) ─── */}
        <div className="shrink-0 px-2 sm:px-4 pt-3 sm:pt-4 z-[100] relative">
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
              <div className="hidden sm:flex items-center relative flex-1 max-w-sm">
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
                  <Search className="shrink-0 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search incidents, logs, or barangays..."
                    className="w-full py-2 bg-transparent border-0 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* ── Notification Bell ── */}
              <div ref={notifRef} className="relative z-10">
                <button
                  id="notification-bell-btn"
                  onClick={handleBellClick}
                  className="relative p-2.5 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition-colors active:scale-95"
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
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#0F1525]"
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                {/* ── Notification Dropdown ── */}
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      id="notification-dropdown"
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-20 sm:top-full mt-0 sm:mt-2 w-auto sm:w-100 max-w-[calc(100vw-1.5rem)] sm:max-w-none backdrop-blur-2xl backdrop-saturate-180 bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-white/70 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.18),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-black/70 z-[110] overflow-hidden flex flex-col"
                    >
                      {/* ── Header ── */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Notifications
                          </span>
                          {notifications.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-medium rounded-full">
                              {notifications.length}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {notifications.length > 0 && (
                            <>
                              <button
                                onClick={markAllRead}
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors cursor-pointer"
                                title="Mark all as read"
                                aria-label="Mark all as read"
                              >
                                <CheckCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteTarget('all')}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                                title="Clear all notifications"
                                aria-label="Clear all notifications"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* ── Filter Tabs ── */}
                      <div className="flex gap-1 px-3 pt-2.5 pb-1">
                        {([
                          { key: 'all', label: 'All', count: notifications.length },
                          { key: 'scraper', label: 'Scraper', count: scraperUnread },
                          { key: 'messenger', label: 'Messenger', count: messengerUnread },
                        ] as { key: FilterTab; label: string; count: number }[]).map((tab) => (
                          <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer
                            ${activeTab === tab.key
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }
                          `}
                          >
                            {tab.label}
                            {tab.count > 0 && (
                              <span className={`text-[10px] font-bold px-1 rounded-full ${activeTab === tab.key
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}>
                                {tab.count}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* ── Notification List ── */}
                      <div className="max-h-[min(24rem,calc(100dvh-16rem))] sm:max-h-90 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                        <AnimatePresence initial={false}>
                          {filteredNotifications.length === 0 ? (
                            <motion.div
                              key="empty"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400"
                            >
                              <BellOff className="w-8 h-8" />
                              <p className="text-sm font-medium">No notifications yet</p>
                              <p className="text-xs text-slate-300 dark:text-slate-600">
                                New scraper &amp; messenger events will appear here in real-time
                              </p>
                            </motion.div>
                          ) : (
                            filteredNotifications.map((n) => (
                              <NotificationRow
                                key={n.id}
                                notification={n}
                                onClick={() => handleNotifClick(n)}
                                onDelete={() => setConfirmDeleteTarget(n.id)}
                              />
                            ))
                          )}
                        </AnimatePresence>
                      </div>

                      {/* ── Footer ── */}
                      {filteredNotifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            {filteredNotifications.length} notification
                            {filteredNotifications.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div ref={profileRef} className="relative flex items-center gap-3 pl-4 border-l border-white/60 dark:border-white/10 z-10">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">{formattedTime}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{formattedDate}</div>
                </div>
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="w-9 h-9 rounded-full ring-2 ring-white/80 dark:ring-white/10 hover:ring-blue-500/50 dark:hover:ring-blue-400/50 shadow-sm transition-all active:scale-95 cursor-pointer focus:outline-none flex items-center justify-center overflow-hidden"
                  aria-label="User profile menu"
                  aria-expanded={profileOpen}
                >
                  <UserAvatar
                    src={user?.avatar_url}
                    name={user?.full_name}
                    username={user?.username}
                    size="md"
                  />
                </button>

                {/* Profile Dropdown */}
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      id="profile-dropdown-menu"
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-2 w-72 backdrop-blur-2xl backdrop-saturate-180 bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-white/70 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-black/70 z-[110] p-2.5 overflow-hidden flex flex-col"
                    >
                      {/* Identity Card */}
                      <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 mb-2">
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
                          <div className="mt-2.5 flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-white/5">
                            <span
                              className="text-[11px] text-slate-600 dark:text-slate-300 truncate font-mono select-all"
                              title={user.email}
                            >
                              {user.email}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyEmail}
                              className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
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
                      </div>

                      {/* Quick Actions */}
                      <div className="space-y-0.5">
                        <Link
                          to="/settings"
                          onClick={() => setProfileOpen(false)}
                          onMouseEnter={() => prefetchRoute('/settings')}
                          onPointerDown={() => prefetchRoute('/settings')}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/10 rounded-xl transition-colors"
                        >
                          <Settings className="w-4 h-4 text-slate-400" />
                          <span>Account Settings</span>
                        </Link>

                        <button
                          type="button"
                          onClick={toggleTheme}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
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
                      </div>

                      {/* Sign Out */}
                      <div className="border-t border-slate-100 dark:border-slate-800/80 mt-1 pt-1">
                        <button
                          type="button"
                          id="header-signout-btn"
                          onClick={() => {
                            setProfileOpen(false);
                            setSignOutModalOpen(true);
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors cursor-pointer text-left w-full"
                        >
                          <LogOut className="w-4 h-4 text-red-500" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-3.5 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-5 sm:pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] md:pb-5 md:pt-4 lg:px-6 lg:pb-6 lg:pt-4">
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
              className="flex flex-col min-h-full w-full"
            >
              <Outlet />
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
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 animate-pulse z-10" />
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
  onClick,
  onDelete,
}: {
  notification: AppNotification;
  onClick: () => void;
  onDelete: () => void;
}) {
  const isMessenger = n.type === 'messenger';
  const timeAgo = formatTimeAgo(n.timestamp);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.2 }}
      className={
        'group relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ' +
        (!n.read ? 'bg-blue-50/60 dark:bg-blue-950/10 ' : '') +
        'hover:bg-slate-50 dark:hover:bg-slate-800/40'
      }
      onClick={onClick}
      onMouseEnter={() => prefetchRoute(n.targetPath)}
      onPointerDown={() => prefetchRoute(n.targetPath)}
    >
      {/* Left blue unread bar */}
      {!n.read && (
        <span className="absolute left-0 top-3 bottom-3 w-0.75 bg-blue-500 rounded-r-full" />
      )}

      {/* Icon */}
      <div
        className={
          'shrink-0 mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ' +
          (isMessenger
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-500'
            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500')
        }
      >
        {isMessenger ? (
          <MessageCircle className="w-4 h-4" />
        ) : (
          <Globe2 className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
            {n.title}
          </p>
          {isMessenger ? (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              Messenger
            </span>
          ) : (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              Scraper
            </span>
          )}
        </div>

        {/* Barangay / Sender meta */}
        {(n.barangay || n.sender) && (
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">
            {n.barangay ? `📍 ${n.barangay}` : `👤 ${n.sender}`}
          </p>
        )}

        {/* Message snippet */}
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {n.message}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">{timeAgo}</p>
      </div>

      {/* Dismiss / Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer active:scale-90"
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
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isMessenger = toast.type === 'messenger';

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.94 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto relative flex items-start gap-3 pl-4 pr-3 pt-3.5 pb-5 rounded-2xl border shadow-xl min-w-[310px] max-w-97.5 bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-700 overflow-hidden"
    >
      {/* Accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${isMessenger ? 'bg-purple-500' : 'bg-blue-500'
          }`}
      />

      {/* Icon */}
      <div
        className={`shrink-0 mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ${isMessenger
          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-500'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'
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
          className={`mt-2 flex items-center gap-1 text-xs font-semibold transition-colors ${isMessenger
            ? 'text-purple-500 hover:text-purple-600'
            : 'text-blue-500 hover:text-blue-600'
            }`}
        >
          View
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 mt-0.5 p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      <motion.div
        className={`absolute bottom-0 left-0 h-[3px] ${isMessenger ? 'bg-purple-400' : 'bg-blue-400'
          }`}
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
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[220] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            key="delete-notification-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-notification-title"
            aria-describedby="delete-notification-desc"
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/80 dark:border-white/10 shadow-[0_24px_50px_rgba(0,0,0,0.25)] p-5 sm:p-6 text-center relative overflow-hidden"
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
