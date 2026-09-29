import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FileText, MessageSquare, Globe, Map,
  BarChart3, Settings, Search, Bell, UserCircle, LogOut, Menu, X,
  Globe2, MessageCircle, CheckCheck, Trash2, BellOff, ArrowRight,
} from 'lucide-react';
import PageTransition from './Transition';
import {
  useNotifications,
  type AppNotification,
  type ToastNotification,
  type NotificationType,
} from '../context/NotificationContext';
import { useBotConversations } from '../context/BotConversationsContext';
import { useTheme } from './ThemeContent';

type FilterTab = 'all' | NotificationType;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const notifRef = useRef<HTMLDivElement>(null);

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

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Handle escape key and desktop resize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setNotifOpen(false);
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

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const formattedDate = currentTime.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const isActive = (p: string) => location.pathname === p;

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/incident-reports', label: 'Incident Reports', icon: FileText },
    { path: '/messenger-bot-logs', label: 'Messenger Logs', icon: MessageSquare },
    { path: '/scraper-feed', label: 'Scraper Feed', icon: Globe },
    { path: '/geospatial-map', label: 'Geospatial Map', icon: Map },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
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

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs z-50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── SIDEBAR (Frosted Glass) ─── */}
      <aside
        id="app-sidebar"
        className={`
          fixed z-[60] flex flex-col
          top-0 bottom-0 left-0 sm:top-4 sm:bottom-4 sm:left-4
          w-64 md:w-18 ${collapsed ? 'lg:w-18' : 'lg:w-56'}
          backdrop-blur-2xl backdrop-saturate-180
          bg-white/95 dark:bg-slate-900/95
          lg:bg-white/45 lg:dark:bg-slate-900/60
          rounded-r-2xl sm:rounded-2xl
          border-r sm:border border-white/60 dark:border-white/10
          border-r-white/80
          shadow-[0_8px_32px_0_rgba(31,38,135,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.9)]
          dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.1)]
          transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className={`
          h-16 flex items-center shrink-0
          px-4 gap-3 md:justify-center md:px-0 md:gap-0
          ${collapsed && !mobileOpen ? 'lg:justify-center lg:px-0 lg:gap-0' : 'lg:justify-start lg:px-4 lg:gap-3'}
        `}>
          <img
            src="/Responde_Logo.png"
            alt="Responde"
            className="w-8 h-8 rounded-lg object-cover shrink-0"
          />
          <span className={`
            font-bold text-slate-800 dark:text-white text-base tracking-tight
            transition-all duration-300 overflow-hidden whitespace-nowrap
            block md:hidden lg:block
            ${collapsed && !mobileOpen ? 'lg:w-0 lg:opacity-0' : 'lg:w-auto lg:opacity-100'}
          `}>
            RESPONDE
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 md:hidden transition-colors active:scale-95"
            title="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* thin divider */}
        <div className="mx-3 h-px bg-white/60 dark:bg-white/10 shrink-0 shadow-[0_1px_0_rgba(0,0,0,0.03)]" />

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2.5 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const isCollapsed = collapsed && !mobileOpen;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  group flex items-center rounded-xl px-4 py-2.5 transition-all duration-200 active:scale-[0.98]
                  md:justify-center md:px-0 md:gap-0
                  ${isCollapsed ? 'lg:justify-center lg:px-0 lg:gap-0' : 'gap-3.5 lg:justify-start lg:px-4 lg:gap-3.5'}
                  ${active
                    ? 'bg-white/80 dark:bg-white/20 shadow-sm border border-white/90 dark:border-white/10 font-semibold text-blue-700 dark:text-blue-300 backdrop-blur-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-transparent'
                  }
                `}
                title={item.label}
              >
                <div className={`
                  relative shrink-0 flex items-center justify-center transition-colors duration-200
                  ${active
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                  }
                `}>
                  <item.icon className="w-5.5 h-5.5" strokeWidth={active ? 2.5 : 1.75} />
                  {item.path === '/messenger-bot-logs' && incompleteCount > 0 && (
                    <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#111827] animate-pulse md:block ${isCollapsed ? 'lg:block' : 'lg:hidden'}`} />
                  )}
                </div>
                <span className={`
                  text-[13px] transition-all duration-300 overflow-hidden whitespace-nowrap
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
                  <span className={`ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 tabular-nums block md:hidden ${isCollapsed ? 'lg:hidden' : 'lg:block'}`}>
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
            onClick={() => navigate('/login')}
            className={`
              group flex items-center w-full rounded-xl px-4 py-2.5 transition-all duration-200 active:scale-[0.98]
              md:justify-center md:px-0 md:gap-0
              ${collapsed && !mobileOpen ? 'lg:justify-center lg:px-0 lg:gap-0' : 'gap-3.5 lg:justify-start lg:px-4 lg:gap-3.5'}
              text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10 hover:text-red-600 dark:hover:text-red-400 border border-transparent
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
          flex-1 flex flex-col min-w-0 transition-all duration-300
          ml-0 md:ml-[calc(16px+72px+8px)] ${collapsed ? 'lg:ml-[calc(16px+72px+8px)]' : 'lg:ml-[calc(16px+225px+8px)]'}
        `}
      >
        {/* ─── FLOATING HEADER (Frosted Glass) ─── */}
        <div className="shrink-0 px-2 sm:px-4 pt-3 sm:pt-4 z-20 relative">
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
              <button
                id="sidebar-toggle-btn"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setMobileOpen((prev) => !prev);
                  } else {
                    setCollapsed((prev) => !prev);
                  }
                }}
                className="shrink-0 p-2 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition-colors active:scale-95"
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
              <div ref={notifRef} className="relative">
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
                      className="absolute right-0 top-full mt-2 w-90 sm:w-100 backdrop-blur-xl backdrop-saturate-180 bg-white/80 dark:bg-slate-900/85 rounded-2xl border border-white/70 dark:border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-black/50 z-60 overflow-hidden flex flex-col"
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
                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Mark all as read"
                              >
                                <CheckCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={clearAll}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Clear all"
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
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
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
                      <div className="max-h-90 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60">
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
                                onDelete={() => deleteNotification(n.id)}
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
                          <button
                            onClick={() => {
                              setNotifOpen(false);
                              navigate(activeTab === 'messenger' ? '/messenger-bot-logs' : '/scraper-feed');
                            }}
                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                          >
                            View feed
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-white/60 dark:border-white/10">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">{formattedTime}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{formattedDate}</div>
                </div>
                <div className="w-9 h-9 bg-white/70 dark:bg-slate-800/80 border border-white/80 dark:border-white/10 shadow-sm rounded-full flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </div>
          </header>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-4 pb-20 pt-4 sm:px-5 sm:pb-20 md:pb-5 md:pt-4 lg:px-6 lg:pb-6 lg:pt-4">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </main>

      {/* ── Mobile Fixed Bottom Navigation Bar (<768px) ── */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden backdrop-blur-2xl backdrop-saturate-180 bg-white/90 dark:bg-slate-900/95 border-t border-slate-200/80 dark:border-white/10 px-3 py-2 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] transition-colors duration-300"
      >
        {[
          { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/incident-reports', label: 'Incident Reports', icon: FileText },
          { path: '/messenger-bot-logs', label: 'Messenger Bot', icon: MessageSquare },
          { path: '/geospatial-map', label: 'Geospatial Map', icon: Map },
          { path: '/settings', label: 'Settings', icon: Settings },
        ].map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-150 active:scale-90 min-w-[44px] min-h-[44px] ${active
                  ? 'text-[#0071E3] dark:text-sky-400 bg-[#0071E3]/10 dark:bg-white/10 border border-[#0071E3]/20 dark:border-white/10 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              title={item.label}
              aria-label={item.label}
            >
              <item.icon className="w-5.5 h-5.5" strokeWidth={active ? 2.25 : 1.75} />
              {item.path === '/messenger-bot-logs' && incompleteCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </Link>
          );
        })}
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

      {/* Hover dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 rounded-lg transition-all"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
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
