import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { LayoutOutletContext } from '../components/Layout';
import { useTheme } from '../components/ThemeContent';
import { useAuth } from '../context/AuthContext';
import {
  Menu,
  Settings as SettingsIcon,
  UserCircle,
  Shield,
  Lock,
  Bell,
  Pencil,
  Trash2,
  RefreshCw,
  UserPlus,
  Users,
  Search,
  Eye,
  EyeOff,
  Check,
  X,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Mail,
  Sun,
  Moon,
  Volume2,
  Globe,
  Copy,
  Loader2,
  ChevronDown,
  Wifi,
  Bot,
} from 'lucide-react';
import SignOutModal from '../components/SignOutModal';
import { StaggerContainer, StaggerItem } from '../components/Stagger';
import { authService, type AuthUser, type UserRole, AuthError } from '../services/authService';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { formatPhilippineDateTime } from '../utils/dateUtils';

const APPLE_SLIDE_SPRING = { type: 'spring', stiffness: 400, damping: 32, mass: 0.8 } as const;

const LOCK_BTN_VARIANTS: Variants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.12,
    y: -1,
    transition: { type: 'spring', stiffness: 500, damping: 18 },
  },
};

const MOON_BTN_VARIANTS: Variants = {
  rest: { scale: 1, rotate: 0 },
  hover: {
    scale: [1, 1.2, 1.12],
    rotate: [0, -20, 10, -5, 0],
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
};

const SUN_BTN_VARIANTS: Variants = {
  rest: { scale: 1, rotate: 0 },
  hover: {
    scale: [1, 1.25, 1.15],
    rotate: [0, 45, 90],
    transition: { duration: 0.55, ease: 'easeInOut' },
  },
};

type TabKey = 'profile' | 'team' | 'security' | 'preferences';

/**
 * Tailored micro-animations for each tab based on its iconic personality:
 * - Profile (User): Buoyant upward head-nod & avatar scale
 * - Team (Shield): Sturdy protective deflective pop & tilt
 * - Security (Lock): Tactile mechanical padlock click & shackle wiggle
 * - Preferences (Bell): Authentic chime bell ringing from top apex
 */
const TAB_ICON_ANIMATIONS: Record<TabKey, { rest: Record<string, any>; hover: Record<string, any> }> = {
  profile: {
    rest: { scale: 1, y: 0 },
    hover: {
      scale: 1.18,
      y: -1.5,
      transition: { type: 'spring', stiffness: 500, damping: 15 }
    }
  },
  team: {
    rest: { scale: 1, rotate: 0 },
    hover: {
      scale: [1, 1.2, 1.12],
      rotate: [0, -12, 10, -5, 0],
      transition: { duration: 0.45, ease: 'easeInOut' }
    }
  },
  security: {
    rest: { scale: 1, y: 0, rotate: 0 },
    hover: {
      scale: 1.15,
      y: [0, -2, 0],
      rotate: [0, -14, 12, -6, 0],
      transition: { duration: 0.4, ease: 'easeOut' }
    }
  },
  preferences: {
    rest: { rotate: 0, scale: 1 },
    hover: {
      rotate: [0, -24, 20, -14, 10, -4, 0],
      scale: 1.12,
      transition: { duration: 0.55, ease: 'easeInOut' }
    }
  }
};

type AuditAction = 'invite' | 'signup' | 'role_change' | 'user_deleted' | 'password_change' | 'login';

type AuditEntry = {
  id: string;
  actor: string;
  action: AuditAction;
  target: string;
  timestamp: string;
};

/* Calm, low-saturation neutral badges with micro-dot indicator */
const AUDIT_META: Record<
  AuditAction,
  { label: string; dotColor: string; badgeClasses: string }
> = {
  invite: {
    label: 'Invite Generated',
    dotColor: 'bg-purple-500',
    badgeClasses:
      'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/20 dark:border-purple-500/30',
  },
  signup: {
    label: 'Personnel Sign Up',
    dotColor: 'bg-emerald-500',
    badgeClasses:
      'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30',
  },
  role_change: {
    label: 'Role Changed',
    dotColor: 'bg-[#0071E3]',
    badgeClasses:
      'bg-blue-500/10 text-[#0071E3] dark:bg-blue-500/20 dark:text-sky-400 border-blue-500/20 dark:border-blue-500/30',
  },
  user_deleted: {
    label: 'User Deleted',
    dotColor: 'bg-rose-500',
    badgeClasses:
      'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/30',
  },
  password_change: {
    label: 'Password Changed',
    dotColor: 'bg-indigo-500',
    badgeClasses:
      'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-500/20 dark:border-indigo-500/30',
  },
  login: {
    label: 'Sign In',
    dotColor: 'bg-slate-400',
    badgeClasses:
      'bg-slate-500/10 text-slate-600 dark:bg-slate-400/20 dark:text-slate-300 border-slate-500/20 dark:border-slate-500/30',
  },
};

const AUDIT_FILTER_OPTIONS: Array<{ value: AuditAction | 'all'; label: string; dotColor: string }> = [
  { value: 'all', label: 'All Events', dotColor: 'bg-slate-400' },
  { value: 'invite', label: 'Invites', dotColor: 'bg-purple-500' },
  { value: 'signup', label: 'Signups', dotColor: 'bg-emerald-500' },
  { value: 'role_change', label: 'Role Changes', dotColor: 'bg-sky-500' },
  { value: 'password_change', label: 'Password Updates', dotColor: 'bg-indigo-500' },
  { value: 'user_deleted', label: 'Deletions', dotColor: 'bg-rose-500' },
];

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const formatRelative = (iso: string) => {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return formatPhilippineDateTime(iso, { includeYear: true });
};

/* =========================================================================
   CLEAN MINIMALIST SOFT UI BUILDING BLOCKS
   ========================================================================= */

/**
 * SoftCard: Clean surface card with subtle border and soft ambient shadow.
 */
function SoftCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-300 p-6 sm:p-7 md:p-8 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * CleanButton: Tactile Apple-grade button with subtle borders, elevation lift, and tactile feedback (NO tilt).
 */
function CleanButton({
  variant = 'primary',
  icon: Icon,
  children,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  title,
}: {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  let styles = '';
  if (variant === 'primary') {
    styles = 'bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062C4] text-white shadow-[0_2px_8px_rgba(0,113,227,0.25)] hover:shadow-[0_4px_14px_rgba(0,113,227,0.35)] border border-transparent';
  } else if (variant === 'secondary') {
    styles = 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15 border border-slate-200/60 dark:border-white/10 shadow-2xs hover:shadow-xs';
  } else if (variant === 'danger') {
    styles = 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/40 border border-rose-200/70 dark:border-rose-900/50 shadow-2xs hover:shadow-xs';
  } else {
    styles = 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/5';
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 sm:py-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none select-none ${styles} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105" strokeWidth={1.75} />}
      <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">{children}</span>
    </button>
  );
}

/**
 * SoftToggle: Apple-style fluid spring toggle switch.
 */
function SoftToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || 'Toggle switch'}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25 active:scale-95 border ${
        checked
          ? 'bg-[#0071E3] border-[#0071E3] shadow-[0_2px_6px_rgba(0,113,227,0.3)]'
          : 'bg-slate-200 dark:bg-slate-700 border-slate-300/80 dark:border-slate-600/80 hover:bg-slate-300/80 dark:hover:bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transform transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
        style={{ marginTop: '1px' }}
      />
    </button>
  );
}

/**
 * UserRoleBadge: Clean, low-saturation pill badge with a subtle 6px status dot.
 */
/**
 * TeamMemberAvatar: Robust avatar component with error fallback and referrerPolicy.
 * Prevents broken image icons if Google CDN blocks referrers or if a stored image URL expires/404s.
 */
function TeamMemberAvatar({
  avatarUrl,
  name,
  email,
}: {
  avatarUrl?: string | null;
  name?: string;
  email?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const initial = (name || email || 'U')[0].toUpperCase();

  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  if (!avatarUrl || hasError) {
    return (
      <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 font-semibold text-xs flex items-center justify-center border border-blue-500/20 shrink-0 select-none">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name || 'User avatar'}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-white/10 shrink-0"
    />
  );
}

function UserRoleBadge({ role }: { role: string }) {
  let badgeClasses = 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30';
  let dotColor = 'bg-emerald-500';
  let label = 'Staff';

  if (role === 'super_admin') {
    badgeClasses = 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/20 dark:border-purple-500/30';
    dotColor = 'bg-purple-500';
    label = 'Super Admin';
  } else if (role === 'admin') {
    badgeClasses = 'bg-blue-500/10 text-[#0071E3] dark:bg-blue-500/20 dark:text-sky-400 border-blue-500/20 dark:border-blue-500/30';
    dotColor = 'bg-[#0071E3]';
    label = 'Admin';
  }

  return (
    <span className={`inline-flex items-center justify-start gap-1.5 w-[116px] px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap shadow-2xs ${badgeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * AuditActionBadge: Neutral pill badge with a 6px semantic color indicator dot.
 */
function AuditActionBadge({ action }: { action: AuditAction }) {
  const meta = AUDIT_META[action] || {
    label: action,
    dotColor: 'bg-slate-400',
    badgeClasses:
      'bg-slate-500/10 text-slate-600 dark:bg-slate-400/20 dark:text-slate-300 border-slate-500/20 dark:border-slate-500/30',
  };

  return (
    <span
      className={`inline-flex items-center justify-start gap-2 w-[148px] px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap shadow-2xs ${meta.badgeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor} shrink-0`} />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
        active
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 shadow-2xs'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 shadow-2xs'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
      <Wifi className="w-3 h-3" strokeWidth={2} />
      <span>{active ? 'Connected' : 'Disconnected'}</span>
    </span>
  );
}

export default function Settings() {
  const { collapsed, toggleSidebar } = useOutletContext<LayoutOutletContext>() || {};
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { user: currentUser, logout, setUser, refreshUser } = useAuth();
  const userRole = (currentUser?.role || '').toLowerCase().trim();
  const canViewUsers = userRole === 'super_admin' || userRole === 'admin';

  const settingsTabs = [
    { key: 'profile' as const, label: 'Profile', icon: UserCircle },
    ...(canViewUsers ? [{ key: 'team' as const, label: 'Team & Access', icon: Shield }] : []),
    { key: 'security' as const, label: 'Security', icon: Lock },
    { key: 'preferences' as const, label: 'Preferences', icon: Bell },
  ];

  // Navigation Tab State (defaults to Profile)
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // Preferences State
  const [pushNotif, setPushNotif] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [botConnected] = useState(true);
  const [scraperConnected] = useState(true);
  const [nlpConnected] = useState(true);

  // User Management State
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<'staff' | 'admin'>('staff');
  const [generatedInvite, setGeneratedInvite] = useState<{ invite_url: string; expires_in: string } | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Role Edit Modal State
  const [roleModalUser, setRoleModalUser] = useState<AuthUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [rolePassword, setRolePassword] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [userAvatarError, setUserAvatarError] = useState(false);

  const getInitialPosition = () => {
    try {
      const savedPos = localStorage.getItem('responde_user_position');
      if (savedPos) return savedPos;
    } catch {}
    if (currentUser?.role) {
      const roleTitle = currentUser.role === 'super_admin' ? 'Super Admin' : currentUser.role === 'admin' ? 'Admin' : 'Staff';
      return `${roleTitle} • MDRRMO`;
    }
    return 'MDRRMO Personnel';
  };

  const [profile, setProfile] = useState({
    fullName: currentUser?.full_name || '',
    phone: currentUser?.phone_number || '',
    position: getInitialPosition(),
  });
  const [profileDraft, setProfileDraft] = useState(profile);

  useEffect(() => {
    if (currentUser) {
      const currentPhone = currentUser.phone_number || '';
      const currentName = currentUser.full_name || '';
      setProfile(prev => ({
        ...prev,
        fullName: currentName,
        phone: currentPhone,
      }));
      setProfileDraft(prev => ({
        ...prev,
        fullName: currentName,
        phone: currentPhone,
      }));
    }
  }, [currentUser]);

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);

    try {
      const res = await authService.updateProfile({
        full_name: profileDraft.fullName,
        phone_number: profileDraft.phone,
      });

      if (res.user) {
        setUser(res.user);
      } else {
        await refreshUser();
      }

      setProfile(profileDraft);
      try {
        localStorage.setItem('responde_user_position', profileDraft.position);
      } catch {}

      setIsEditingProfile(false);
      showSuccessFeedback('Profile updated successfully.');
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([
    { id: 'a1', actor: currentUser?.full_name || 'Super Admin', action: 'login', target: 'Signed in from Windows PC', timestamp: minutesAgo(5) },
    { id: 'a2', actor: 'Sedrick Amote', action: 'signup', target: 'Joined team via Staff invite', timestamp: minutesAgo(40) },
    { id: 'a3', actor: currentUser?.full_name || 'Super Admin', action: 'role_change', target: 'Updated Juan Dela Cruz to Admin', timestamp: minutesAgo(120) },
    { id: 'a4', actor: currentUser?.full_name || 'Super Admin', action: 'invite', target: 'Generated 24h Staff invitation link', timestamp: minutesAgo(180) },
    { id: 'a5', actor: 'Maria Santos', action: 'password_change', target: 'Password updated securely', timestamp: minutesAgo(480) },
    { id: 'a6', actor: currentUser?.full_name || 'Super Admin', action: 'invite', target: 'Generated 24h Admin invitation link', timestamp: minutesAgo(1440) },
  ]);
  const [auditFilter, setAuditFilter] = useState<AuditAction | 'all'>('all');
  const [auditFilterOpen, setAuditFilterOpen] = useState(false);
  const auditFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (auditFilterRef.current && !auditFilterRef.current.contains(e.target as Node)) {
        setAuditFilterOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && auditFilterOpen) {
        setAuditFilterOpen(false);
      }
    };
    if (auditFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [auditFilterOpen]);

  const visibleAuditLogs = auditFilter === 'all' ? auditLogs : auditLogs.filter(l => l.action === auditFilter);

  // Delete User Modal State (Super Admin Only)
  const [deleteModalUser, setDeleteModalUser] = useState<AuthUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const handleDeleteUser = async () => {
    if (!deleteModalUser) return;
    if (deleteModalUser.role === 'super_admin') {
      alert('Super Admin accounts are protected and cannot be deleted.');
      return;
    }

    setIsDeletingUser(true);
    try {
      await authService.deleteUser(deleteModalUser.user_id);
      const deletedName = deleteModalUser.full_name || deleteModalUser.username || 'Personnel';
      setUsers(prev => prev.filter(u => u.user_id !== deleteModalUser.user_id));
      setAuditLogs(prev => [{
        id: `a${Date.now()}`,
        actor: currentUser?.full_name || 'Super Admin',
        action: 'user_deleted',
        target: `${deletedName} (${deleteModalUser.role === 'admin' ? 'Admin' : 'Staff'})`,
        timestamp: new Date().toISOString(),
      }, ...prev]);
      showSuccessFeedback(`${deletedName} has been deleted.`);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setIsDeletingUser(false);
      setDeleteModalUser(null);
    }
  };

  // Sign Out State
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  // Delete Account (Self-Deletion via Password & Email OTP)
  const [deleteSelfModalOpen, setDeleteSelfModalOpen] = useState(false);
  const [deleteSelfStep, setDeleteSelfStep] = useState<'password' | 'otp' | 'success'>('password');
  const [deleteSelfPassword, setDeleteSelfPassword] = useState('');
  const [showDeleteSelfPassword, setShowDeleteSelfPassword] = useState(false);
  const [deleteSelfPasswordError, setDeleteSelfPasswordError] = useState<string | null>(null);

  const [deleteSelfOtp, setDeleteSelfOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [deleteSelfOtpError, setDeleteSelfOtpError] = useState<string | null>(null);
  const [deleteSelfChallengeToken, setDeleteSelfChallengeToken] = useState<string>('');
  const [deleteSelfMaskedEmail, setDeleteSelfMaskedEmail] = useState<string>('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const maskEmailAddress = (email?: string) => {
    if (!email) return 'your registered email';
    const [userPart, domain] = email.split('@');
    if (!domain) return email;
    const maskedUser = userPart.length <= 2 ? userPart : `${userPart.slice(0, 2)}***${userPart.slice(-1)}`;
    return `${maskedUser}@${domain}`;
  };

  const openDeleteMyAccountModal = () => {
    setDeleteSelfModalOpen(true);
    setDeleteSelfStep('password');
    setDeleteSelfPassword('');
    setShowDeleteSelfPassword(false);
    setDeleteSelfPasswordError(null);
    setDeleteSelfOtp(['', '', '', '', '', '']);
    setDeleteSelfOtpError(null);
    setDeleteSelfChallengeToken('');
    setDeleteSelfMaskedEmail(maskEmailAddress(currentUser?.email));
    setOtpCooldown(0);
  };

  const closeDeleteMyAccountModal = () => {
    if (isConfirmingDelete) return;
    setDeleteSelfModalOpen(false);
    setDeleteSelfStep('password');
    setDeleteSelfPassword('');
    setDeleteSelfOtp(['', '', '', '', '', '']);
    setDeleteSelfOtpError(null);
    setDeleteSelfPasswordError(null);
  };

  const handlePasswordConfirmAndRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteSelfPasswordError(null);

    if (!deleteSelfPassword.trim()) {
      setDeleteSelfPasswordError('Please enter your account password.');
      return;
    }
    if (deleteSelfPassword.length < 6) {
      setDeleteSelfPasswordError('Password must be at least 6 characters.');
      return;
    }

    setIsRequestingOtp(true);
    try {
      const res = await authService.sendVerificationCode('delete_account');
      setDeleteSelfChallengeToken(res.challenge_token);
      setDeleteSelfMaskedEmail(res.masked_email || maskEmailAddress(currentUser?.email));
      setDeleteSelfStep('otp');
      setOtpCooldown(45);
      setDeleteSelfOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setDeleteSelfPasswordError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleResendDeleteOtp = async () => {
    if (otpCooldown > 0 || isRequestingOtp) return;
    setIsRequestingOtp(true);
    setDeleteSelfOtpError(null);

    try {
      const res = await authService.sendVerificationCode('delete_account');
      if (res.challenge_token) setDeleteSelfChallengeToken(res.challenge_token);
      if (res.masked_email) setDeleteSelfMaskedEmail(res.masked_email);
      setOtpCooldown(45);
      setDeleteSelfOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setDeleteSelfOtpError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      const updated = [...deleteSelfOtp];
      updated[index] = '';
      setDeleteSelfOtp(updated);
      return;
    }
    const char = clean.slice(-1);
    const updated = [...deleteSelfOtp];
    updated[index] = char;
    setDeleteSelfOtp(updated);
    setDeleteSelfOtpError(null);

    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !deleteSelfOtp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const digits = pasted.split('');
    const updated = ['', '', '', '', '', ''];
    for (let i = 0; i < 6; i++) {
      updated[i] = digits[i] || '';
    }
    setDeleteSelfOtp(updated);
    const nextIdx = Math.min(digits.length, 5);
    otpInputRefs.current[nextIdx]?.focus();
  };

  const handleFinalDeleteSelf = async () => {
    const fullCode = deleteSelfOtp.join('');
    if (fullCode.length !== 6) {
      setDeleteSelfOtpError('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsConfirmingDelete(true);
    setDeleteSelfOtpError(null);

    try {
      if (deleteSelfChallengeToken) {
        await authService.verifyCode(deleteSelfChallengeToken, fullCode, 'delete_account');
      }

      await authService.deleteAccount({
        password: deleteSelfPassword,
        code: fullCode,
        challenge_token: deleteSelfChallengeToken,
      });

      const actorName = currentUser?.full_name || currentUser?.username || 'Super Admin';
      const userDisplayRole = userRole === 'super_admin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : 'Staff';
      setAuditLogs(prev => [{
        id: `a${Date.now()}`,
        actor: actorName,
        action: 'user_deleted',
        target: `${actorName} (${userDisplayRole} self-deleted account)`,
        timestamp: new Date().toISOString(),
      }, ...prev]);

      if (currentUser?.user_id) {
        setUsers(prev => prev.filter(u => u.user_id !== currentUser.user_id));
      }

      setDeleteSelfStep('success');
      setTimeout(async () => {
        await logout();
        navigate('/login', { replace: true });
      }, 1800);

    } catch (err) {
      setDeleteSelfOtpError(err instanceof Error ? err.message : 'Failed to delete account. Please try again.');
      setIsConfirmingDelete(false);
    }
  };

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setPasswordSuccess(res.message || 'Password updated successfully.');
      setAuditLogs(prev => [{
        id: `a${Date.now()}`,
        actor: currentUser?.full_name || 'Super Admin',
        action: 'password_change',
        target: 'User changed account password',
        timestamp: new Date().toISOString(),
      }, ...prev]);
      showSuccessFeedback('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    if (!canViewUsers) return;
    setLoadingUsers(true);
    setUserError(null);
    try {
      const data = await authService.getUsers();
      setUsers(data);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to fetch user list');
    } finally {
      setLoadingUsers(false);
    }
  }, [canViewUsers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showSuccessFeedback = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // Generate Invite Link
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingInvite(true);
    try {
      const res = await authService.generateInvite(inviteRole);
      setGeneratedInvite({ invite_url: res.invite_url, expires_in: res.expires_in });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate invite');
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedInvite?.invite_url) {
      navigator.clipboard.writeText(generatedInvite.invite_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Role Edit Handlers
  const openRoleModal = (u: AuthUser) => {
    if (currentUser?.role === 'staff') return;

    setRoleModalUser(u);
    setSelectedRole(u.role);
    setRolePassword('');
    setRoleError(null);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser) return;
    if (currentUser?.role === 'staff') return;
    if (roleModalUser.user_id === currentUser?.user_id) {
      setRoleError('You cannot edit your own role.');
      return;
    }
    if (currentUser?.role === 'admin' && roleModalUser.role === 'super_admin') {
      setRoleError('Insufficient permissions.');
      return;
    }
    if (!rolePassword) {
      setRoleError('Please confirm your administrator password.');
      return;
    }

    setIsUpdatingRole(true);
    setRoleError(null);
    try {
      await authService.updateUserRole(
        roleModalUser.user_id,
        selectedRole,
        rolePassword
      );
      showSuccessFeedback(`Role for ${roleModalUser.full_name || roleModalUser.username} updated to ${selectedRole}.`);
      setAuditLogs(prev => [{
        id: `a${Date.now()}`,
        actor: currentUser?.full_name || 'Super Admin',
        action: 'role_change',
        target: `${roleModalUser.full_name || roleModalUser.username}: role updated to ${selectedRole}`,
        timestamp: new Date().toISOString(),
      }, ...prev]);
      setRoleModalUser(null);
      fetchUsers();
    } catch (err) {
      if (err instanceof AuthError) {
        setRoleError(err.message);
      } else if (err instanceof Error) {
        setRoleError(err.message);
      } else {
        setRoleError('Failed to change role.');
      }
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Filtered Users List
  const selfUser = users.find((u) => u.user_id === currentUser?.user_id);
  const effectiveRole = (selfUser?.role || currentUser?.role || userRole || '').toLowerCase().trim();
  const usernameDisplay = currentUser?.username || selfUser?.username || (currentUser?.email ? currentUser.email.split('@')[0] : 'Not set');

  const filteredUsers = users.filter((u) => {
    const targetRole = (u.role || '').toLowerCase().trim();
    const isTargetSuperAdmin = targetRole === 'super_admin' || targetRole.includes('super_admin') || targetRole.includes('super admin');

    if (effectiveRole !== 'super_admin' && isTargetSuperAdmin) {
      return false;
    }

    const q = searchQuery.trim().toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="settings-soft flex flex-col flex-1 min-h-0 w-full h-full pb-8 md:pb-6">
      <StaggerContainer className="flex flex-col flex-1 min-h-0 space-y-5 sm:space-y-6 w-full">

        {/* ── 1. PAGE HEADER IN WHITE GLASS CONTAINER (ALIGNED NAVIGATION BUTTONS) ── */}
        <StaggerItem className="shrink-0 relative z-50 w-full">
          <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl shadow-[0_12px_36px_-8px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] p-4 sm:p-5 md:p-6 w-full transition-all duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left: Hamburger + Settings Icon + Title + Subtitle */}
              <div className="flex items-center gap-3 shrink-0">
                {toggleSidebar && (
                  <button
                    type="button"
                    id="settings-sidebar-toggle-btn"
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    onClick={toggleSidebar}
                    className="hidden md:flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100/80 dark:bg-white/[0.08] hover:bg-slate-200/80 dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/10 shadow-xs backdrop-blur-md transition-all active:scale-95 cursor-pointer shrink-0"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar for full screen'}
                  >
                    <Menu className="w-5 h-5" strokeWidth={1.8} />
                  </button>
                )}
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
                  <SettingsIcon className="w-5 h-5 sm:w-5.5 sm:h-5.5" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-lg sm:text-[22px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em] leading-tight">
                      Settings
                    </h1>
                    {actionSuccess && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 shadow-2xs"
                      >
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                        <span>{actionSuccess}</span>
                      </motion.div>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs font-normal tracking-[0.005em] text-slate-500/90 dark:text-slate-400/90 mt-0.5 leading-relaxed">
                    Personal profile <span className="text-slate-300 dark:text-slate-600 mx-1">·</span> Team access &amp; security preferences
                  </p>
                </div>
              </div>

              {/* Right: The 4 Navigation Buttons aligned on top */}
              <div className="overflow-x-auto scrollbar-none -mx-1 px-1 py-0.5 shrink-0 max-w-full">
                <div className="p-1 bg-slate-100/70 dark:bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] inline-flex items-center gap-1">
                  {settingsTabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const Icon = tab.icon;
                    return (
                      <motion.button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        initial="rest"
                        whileHover="hover"
                        animate="rest"
                        className={`group relative px-3.5 py-1.5 sm:px-4 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-150 inline-flex items-center justify-center gap-2 select-none active:scale-[0.97] cursor-pointer whitespace-nowrap ${
                          isActive
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60 hover:shadow-2xs"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="settingsActiveTabPill"
                            transition={APPLE_SLIDE_SPRING}
                            className="absolute inset-0 bg-white dark:bg-slate-700/90 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-black/4 dark:border-white/10"
                          />
                        )}
                        <motion.span
                          variants={TAB_ICON_ANIMATIONS[tab.key]}
                          className={`relative z-10 inline-flex items-center justify-center transition-colors duration-200 ${
                            isActive
                              ? "text-[#0071E3] dark:text-sky-400"
                              : "text-slate-500 dark:text-slate-400 group-hover:text-[#0071E3] dark:group-hover:text-sky-400"
                          }`}
                          style={{
                            transformOrigin:
                              tab.key === 'preferences' || tab.key === 'security'
                                ? 'top center'
                                : tab.key === 'profile'
                                  ? 'bottom center'
                                  : 'center',
                          }}
                        >
                          <Icon className="w-4 h-4" strokeWidth={1.75} />
                        </motion.span>
                        <span className="relative z-10">{tab.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* 3. TAB PANELS */}

        {/* TAB 1: PROFILE */}
        {activeTab === 'profile' && (
          <StaggerItem>
            <div className="space-y-6">

              {/* 1. Profile Information Card */}
              <div className="rounded-3xl bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02)]">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-white/10">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                      Profile Information
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Personal information associated with your command center account.
                    </p>
                  </div>

                  {!isEditingProfile && (
                    <button
                      type="button"
                      onClick={() => { setProfileDraft(profile); setIsEditingProfile(true); }}
                      className="group/edit self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white hover:bg-blue-50/70 dark:bg-white/10 dark:hover:bg-blue-500/10 text-slate-700 dark:text-slate-200 hover:text-[#0071E3] dark:hover:text-sky-400 border border-slate-200/80 hover:border-blue-300/80 dark:border-white/10 dark:hover:border-sky-500/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(0,113,227,0.12)] active:translate-y-0 active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover/edit:text-[#0071E3] dark:group-hover/edit:text-sky-400 transition-colors duration-200 shrink-0" strokeWidth={2} />
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>

                {/* Body: 40% Profile Area + 60% Details Grid */}
                <div className="pt-6 flex flex-col md:flex-row items-stretch gap-5 lg:gap-6">
                  {/* Left Column: Profile Card (40% width with Glass iOS UI) */}
                  <div className="w-full md:w-[38%] lg:w-[36%] xl:w-[35%] shrink-0">
                    <div className="h-full rounded-2xl sm:rounded-3xl bg-white/75 hover:bg-white/90 dark:bg-slate-900/60 dark:hover:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 hover:border-slate-300/90 dark:border-white/15 dark:hover:border-white/25 p-5 sm:p-6 grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-4 gap-y-4 text-left transition-all duration-200 shadow-[0_4px_20px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_8px_28px_rgba(0,113,227,0.08),inset_0_1px_1px_rgba(255,255,255,1)]">
                      {/* Avatar */}
                      <div className="relative self-start">
                        {currentUser?.avatar_url && !userAvatarError ? (
                          <img
                            src={currentUser.avatar_url}
                            alt={profile.fullName || 'User'}
                            referrerPolicy="no-referrer"
                            onError={() => setUserAvatarError(true)}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-4 ring-white dark:ring-slate-800 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
                          />
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xl sm:text-2xl flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-[0_8px_18px_rgba(37,99,235,0.25)] select-none">
                            {(profile.fullName || currentUser?.email || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <span
                          className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 ring-2.5 ring-white dark:ring-slate-900 shadow-2xs"
                          title="Active Status"
                        />
                      </div>

                      {/* Identity */}
                      <div className="min-w-0 self-center">
                      <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate max-w-full">
                        {profile.fullName || 'Command Center User'}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-full">
                        @{usernameDisplay}
                      </p>

                      </div>

                      {/* Meta badges */}
                      <div className="col-span-2 flex flex-wrap items-center gap-2">

                        <UserRoleBadge role={userRole} />

                        <button
                          type="button"
                          onClick={() => {
                            const id = currentUser?.user_id ? String(currentUser.user_id) : 'e8b29cab';
                            navigator.clipboard.writeText(id);
                            setCopiedId(true);
                            setTimeout(() => setCopiedId(false), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 font-mono text-[11px] transition-colors cursor-pointer border border-slate-200 dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)]"
                          title="Click to copy account ID"
                        >
                          {copiedId ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" strokeWidth={2.5} />
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" strokeWidth={2} />
                              <span>ID: {currentUser?.user_id ? String(currentUser.user_id).slice(0, 8) : 'e8b29cab'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: 5 Information Boxes (60% width) */}
                  <div className="flex-1 w-full min-w-0">
                    {isEditingProfile ? (
                      <form onSubmit={handleSaveProfile} className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Full Name */}
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.95)] space-y-1.5">
                            <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block select-none">
                              Full Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={profileDraft.fullName}
                              onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })}
                              required
                              placeholder="Enter your full name"
                              className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl bg-slate-50/80 focus:bg-white dark:bg-slate-800/80 dark:focus:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
                            />
                          </div>

                          {/* Username */}
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.95)] space-y-1.5">
                            <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block select-none">
                              Username
                            </label>
                            <input
                              type="text"
                              value={`@${usernameDisplay}`}
                              disabled
                              readOnly
                              className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono rounded-xl bg-slate-100/50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none"
                            />
                          </div>

                          {/* Email */}
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.95)] space-y-1.5">
                            <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block select-none">
                              Email Address
                            </label>
                            <input
                              type="email"
                              value={currentUser?.email || ''}
                              disabled
                              readOnly
                              className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono rounded-xl bg-slate-100/50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none truncate"
                            />
                          </div>

                          {/* Contact Phone */}
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.95)] space-y-1.5">
                            <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block select-none">
                              Contact Phone
                            </label>
                            <input
                              type="tel"
                              value={profileDraft.phone}
                              onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })}
                              placeholder="09XX-XXX-XXXX"
                              className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono rounded-xl bg-slate-50/80 focus:bg-white dark:bg-slate-800/80 dark:focus:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
                            />
                          </div>

                          {/* Official Role & Unit */}
                          <div className="sm:col-span-2 p-3.5 sm:p-4 rounded-2xl bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.95)] space-y-1.5">
                            <label className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block select-none">
                              Official Role &amp; Assignment
                            </label>
                            <input
                              type="text"
                              value={profileDraft.position}
                              onChange={(e) => setProfileDraft({ ...profileDraft, position: e.target.value })}
                              placeholder="e.g. Lead Dispatcher • MDRRMO Command"
                              className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl bg-slate-50/80 focus:bg-white dark:bg-slate-800/80 dark:focus:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all"
                            />
                          </div>
                        </div>

                        {profileError && (
                          <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" strokeWidth={2} />
                            <span>{profileError}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => { setIsEditingProfile(false); setProfileError(null); }}
                            disabled={isSavingProfile}
                            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingProfile}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {isSavingProfile ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                                <span>Save Changes</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Viewing Mode: 5 Premium iOS Glass Tiles */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-full">
                        {/* 1. Full Name */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/75 hover:bg-white/95 dark:bg-slate-900/60 dark:hover:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 hover:border-[#0071E3]/40 dark:border-white/15 dark:hover:border-sky-400/40 shadow-[0_2px_10px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.1),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.06)] transition-all duration-200 hover:-translate-y-0.5 group/tile flex flex-col justify-center">
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover/tile:text-[#0071E3] dark:group-hover/tile:text-sky-400 transition-colors duration-150 block mb-1 select-none">
                            Full Name
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white block truncate">
                            {profile.fullName || 'Not provided'}
                          </span>
                        </div>

                        {/* 2. Username */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/75 hover:bg-white/95 dark:bg-slate-900/60 dark:hover:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 hover:border-[#0071E3]/40 dark:border-white/15 dark:hover:border-sky-400/40 shadow-[0_2px_10px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.1),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.06)] transition-all duration-200 hover:-translate-y-0.5 group/tile flex flex-col justify-center">
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover/tile:text-[#0071E3] dark:group-hover/tile:text-sky-400 transition-colors duration-150 block mb-1 select-none">
                            Username
                          </span>
                          <span className="text-xs sm:text-sm font-mono font-medium text-slate-900 dark:text-white block truncate">
                            @{usernameDisplay}
                          </span>
                        </div>

                        {/* 3. Email Address */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/75 hover:bg-white/95 dark:bg-slate-900/60 dark:hover:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 hover:border-[#0071E3]/40 dark:border-white/15 dark:hover:border-sky-400/40 shadow-[0_2px_10px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.1),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.06)] transition-all duration-200 hover:-translate-y-0.5 group/tile flex flex-col justify-center">
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover/tile:text-[#0071E3] dark:group-hover/tile:text-sky-400 transition-colors duration-150 block mb-1 select-none">
                            Email Address
                          </span>
                          <span className="text-xs sm:text-sm font-mono font-medium text-slate-900 dark:text-white block truncate">
                            {currentUser?.email || 'No email attached'}
                          </span>
                        </div>

                        {/* 4. Contact Phone */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/75 hover:bg-white/95 dark:bg-slate-900/60 dark:hover:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 hover:border-[#0071E3]/40 dark:border-white/15 dark:hover:border-sky-400/40 shadow-[0_2px_10px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.1),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.06)] transition-all duration-200 hover:-translate-y-0.5 group/tile flex flex-col justify-center">
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover/tile:text-[#0071E3] dark:group-hover/tile:text-sky-400 transition-colors duration-150 block mb-1 select-none">
                            Contact Phone
                          </span>
                          <span className="text-xs sm:text-sm font-mono font-medium text-slate-900 dark:text-white block truncate">
                            {profile.phone || 'None recorded'}
                          </span>
                        </div>

                        {/* 5. Official Role & Unit */}
                        <div className="sm:col-span-2 p-3.5 sm:p-4 rounded-2xl bg-white/75 hover:bg-white/95 dark:bg-slate-900/60 dark:hover:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 hover:border-[#0071E3]/40 dark:border-white/15 dark:hover:border-sky-400/40 shadow-[0_2px_10px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.1),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.06)] transition-all duration-200 hover:-translate-y-0.5 group/tile flex flex-col justify-center">
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover/tile:text-[#0071E3] dark:group-hover/tile:text-sky-400 transition-colors duration-150 block mb-1 select-none">
                            Official Role &amp; Unit
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white block truncate">
                            {profile.position || 'Super Admin • MDRRMO'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Separate Danger Zone: Delete Account Card (Minimalist Apple Style with Top Red Gradient) */}
              <div className="relative overflow-hidden rounded-3xl bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl border border-rose-200/70 dark:border-rose-900/40 p-6 sm:p-7 shadow-[0_4px_24px_rgba(244,63,94,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:shadow-[0_8px_30px_rgba(244,63,94,0.06)]">
                {/* Top Accent Gradient Line in Red/Rose */}
                <div className="absolute top-0 left-0 right-0 h-1 sm:h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 opacity-100" />

                <div className="relative z-10">
                  <h3 className="text-sm sm:text-base font-semibold text-rose-600 dark:text-rose-400">
                    Delete Account
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Permanently delete your profile and revoke system access. Requires password &amp; email OTP verification.
                  </p>
                </div>

                {/* Non-solid Apple Danger Button - completely static trashbin icon with zero hover tilt/scale */}
                <button
                  type="button"
                  onClick={openDeleteMyAccountModal}
                  className="self-start sm:self-center shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-rose-50/80 hover:bg-rose-100/90 text-rose-600 hover:text-rose-700 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-300 border border-rose-200/80 hover:border-rose-300 dark:border-rose-500/25 dark:hover:border-rose-500/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap relative z-10"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-300" strokeWidth={2} />
                  <span>Delete Account</span>
                </button>
              </div>

            </div>
          </StaggerItem>
        )}

        {/* TAB 2: TEAM & ACCESS (Admin / Super Admin Only) */}
        {activeTab === 'team' && canViewUsers && (
          <StaggerItem>
            <div className="space-y-6">
              <SoftCard>
                {/* Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-white/10">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-xs">
                      <Users className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                        Team Members
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Manage registered personnel accounts and role permissions.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative group/refresh">
                      <button
                        type="button"
                        onClick={fetchUsers}
                        disabled={loadingUsers}
                        aria-label="Refresh user list"
                        className="p-2.5 text-slate-500 hover:text-[#0071E3] dark:text-slate-400 dark:hover:text-sky-400 bg-slate-100/80 hover:bg-[#0071E3]/10 dark:bg-white/10 dark:hover:bg-[#0071E3]/20 border border-slate-200/70 hover:border-[#0071E3]/35 dark:border-white/10 dark:hover:border-[#0071E3]/40 rounded-xl transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-90 disabled:opacity-40 shadow-2xs hover:shadow-xs flex items-center justify-center"
                      >
                        <RefreshCw
                          className={`w-4 h-4 transition-transform duration-500 ease-out group-hover/refresh:rotate-180 ${
                            loadingUsers ? 'animate-spin text-[#0071E3]' : ''
                          }`}
                          strokeWidth={1.85}
                        />
                      </button>
                      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 opacity-0 group-hover/refresh:opacity-100 transition-all duration-200 ease-out translate-y-1 group-hover/refresh:translate-y-0 whitespace-nowrap">
                        <div className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900/90 text-white dark:bg-white/95 dark:text-slate-900 shadow-md backdrop-blur-md border border-white/10 dark:border-slate-200/20">
                          Refresh user list
                        </div>
                      </div>
                    </div>

                    {currentUser?.role === 'super_admin' && (
                      <CleanButton
                        variant="primary"
                        icon={UserPlus}
                        onClick={() => {
                          setInviteModalOpen(true);
                          setGeneratedInvite(null);
                          setCopied(false);
                        }}
                      >
                        Invite User
                      </CleanButton>
                    )}
                  </div>
                </div>

                {/* Search Bar (Glass iOS Style) */}
                <div className="pt-4 pb-2">
                  <div className="relative max-w-sm sm:max-w-md group/search">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, email, or username..."
                      className="w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs sm:text-sm font-medium bg-white/90 hover:bg-white focus:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900/95 dark:focus:bg-slate-900 backdrop-blur-xl border border-slate-300/90 hover:border-slate-400/90 focus:border-[#0071E3] dark:border-white/20 dark:hover:border-white/30 dark:focus:border-sky-400 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[0_2px_12px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07),inset_0_1px_1px_rgba(255,255,255,1)] focus:shadow-[0_4px_20px_rgba(0,113,227,0.16),0_0_0_3px_rgba(0,113,227,0.15),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.06)] dark:focus:shadow-[0_4px_20px_rgba(56,189,248,0.22),0_0_0_3px_rgba(56,189,248,0.2)] focus:outline-none transition-all duration-200 relative z-0"
                    />
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/search:text-[#0071E3] dark:group-focus-within/search:text-sky-400 transition-colors duration-200 pointer-events-none z-10"
                      strokeWidth={2}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-white/20 dark:hover:bg-white/30 text-slate-600 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-90 z-10"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>

                {userError && (
                  <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200/70 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>{userError}</span>
                  </div>
                )}

                {/* Clean Apple Table */}
                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-slate-900/40">
                  <table className="w-full text-xs sm:text-sm text-left border-separate border-spacing-0">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200/70 dark:border-white/10">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px] whitespace-nowrap border-b border-slate-200/70 dark:border-white/10">
                          User
                        </th>
                        <th className="px-4 py-3 font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px] whitespace-nowrap border-b border-slate-200/70 dark:border-white/10">
                          Role
                        </th>
                        <th className="px-4 py-3 font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px] hidden md:table-cell whitespace-nowrap border-b border-slate-200/70 dark:border-white/10">
                          Last Login
                        </th>
                        <th className="px-3.5 py-3 w-32 min-w-[120px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px] text-left whitespace-nowrap sticky top-0 right-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/70 dark:border-white/10 shadow-[-6px_0_10px_-3px_rgba(0,0,0,0.05)] dark:shadow-[-6px_0_10px_-3px_rgba(0,0,0,0.3)] shrink-0">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {loadingUsers ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0071E3] mb-2" />
                            Loading team members...
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400">
                            No team members found.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isSelf = u.user_id === currentUser?.user_id;
                          const isStaff = currentUser?.role === 'staff';

                          let isEditDisabled = false;
                          let disabledReason: string | undefined = undefined;

                          if (isStaff) {
                            isEditDisabled = true;
                            disabledReason = 'Read-only';
                          }

                          return (
                            <tr key={u.user_id} className="group hover:bg-slate-50/70 dark:hover:bg-white/[0.025] transition-colors duration-150">
                              <td className="px-4 py-3.5 border-b border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                  <TeamMemberAvatar
                                    avatarUrl={u.avatar_url}
                                    name={u.full_name}
                                    email={u.email}
                                  />
                                  <div>
                                    <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                      <span>{u.full_name || 'Unnamed Personnel'}</span>
                                      {isSelf && (
                                        <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-blue-500/10 text-[#0071E3] dark:bg-blue-500/20 dark:text-sky-400 border border-blue-500/20 shadow-2xs">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                      {u.username && <span className="font-mono">@{u.username} •</span>}
                                      <span className="truncate max-w-xs">{u.email}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3.5 whitespace-nowrap border-b border-slate-100 dark:border-white/5">
                                <UserRoleBadge role={u.role} />
                              </td>

                              <td className="px-4 py-3.5 text-xs text-slate-400 font-mono hidden md:table-cell whitespace-nowrap border-b border-slate-100 dark:border-white/5">
                                {u.last_login_at
                                  ? formatPhilippineDateTime(u.last_login_at, { includeYear: true })
                                  : 'Never'}
                              </td>

                              <td className="px-3.5 py-2.5 w-32 min-w-[120px] text-left whitespace-nowrap sticky right-0 z-10 bg-white dark:bg-[#111827] group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-white/5 shadow-[-6px_0_10px_-3px_rgba(0,0,0,0.05)] dark:shadow-[-6px_0_10px_-3px_rgba(0,0,0,0.3)] shrink-0">
                                <div className="flex items-center justify-start gap-1.5">
                                  {isEditDisabled ? (
                                    <span className="text-xs text-slate-400 italic">
                                      {disabledReason}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openRoleModal(u)}
                                      title={
                                        isSelf
                                          ? 'You cannot edit your own role'
                                          : currentUser?.role === 'admin' && u.role === 'super_admin'
                                            ? 'Insufficient permissions'
                                            : 'Edit Role'
                                      }
                                      disabled={
                                        isSelf ||
                                        (currentUser?.role === 'admin' && u.role === 'super_admin')
                                      }
                                      className="px-2.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 inline-flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer text-slate-700 dark:text-slate-200 hover:text-[#0071E3] dark:hover:text-sky-400 bg-slate-100/80 hover:bg-blue-50/80 active:bg-blue-100/80 dark:bg-white/10 dark:hover:bg-blue-500/15 dark:active:bg-blue-500/25 border border-slate-200/80 hover:border-blue-300/80 dark:border-white/10 dark:hover:border-sky-400/40 shadow-2xs hover:shadow-[0_4px_12px_rgba(0,113,227,0.12)] disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:bg-slate-100 dark:disabled:bg-white/5 disabled:border-slate-200/60 dark:disabled:border-white/10 disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-slate-100 disabled:hover:border-slate-200/60"
                                    >
                                      Edit Role
                                    </button>
                                  )}

                                  {currentUser?.role === 'super_admin' && (
                                    <div className="w-7 h-7 flex items-center justify-center shrink-0">
                                      {!isSelf && u.role !== 'super_admin' ? (
                                        <button
                                          type="button"
                                          onClick={() => setDeleteModalUser(u)}
                                          className="p-1.5 text-rose-500/80 hover:text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 rounded-lg transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer border-0"
                                          title="Delete personnel account"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                                        </button>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
            </SoftCard>

              {/* Sub-Card: Activity & Audit Log */}
              <SoftCard>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 shadow-xs">
                      <Shield className="w-4.5 h-4.5" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                        Activity Log
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        System records of logins, credential updates, and permission changes.
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-center gap-2.5" ref={auditFilterRef}>
                    <div className="inline-flex items-center p-1 bg-slate-100/70 dark:bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-slate-200/70 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
                      <button
                        type="button"
                        onClick={() => setAuditFilterOpen((prev) => !prev)}
                        aria-haspopup="listbox"
                        aria-expanded={auditFilterOpen}
                        className={`group inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer focus:outline-none select-none ${
                          auditFilterOpen
                            ? 'bg-white dark:bg-slate-800 border-[#0071E3] dark:border-sky-400 text-[#0071E3] dark:text-sky-400 shadow-xs ring-2 ring-[#0071E3]/15'
                            : 'bg-white/90 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900 border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-100 shadow-xs hover:border-[#0071E3]/50'
                        } border`}
                      >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ring-1.5 ring-white dark:ring-slate-900 shadow-2xs ${
                          AUDIT_FILTER_OPTIONS.find((o) => o.value === auditFilter)?.dotColor || 'bg-slate-400'
                        }`}
                      />
                      <span className="tracking-[-0.01em]">
                        {AUDIT_FILTER_OPTIONS.find((o) => o.value === auditFilter)?.label || 'All Events'}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 group-hover:text-[#0071E3] dark:group-hover:text-sky-400 transition-all duration-200 shrink-0 ${
                          auditFilterOpen ? 'rotate-180 text-[#0071E3] dark:text-sky-400' : ''
                        }`}
                        strokeWidth={2.25}
                      />
                    </button>
                    </div>

                    <AnimatePresence>
                      {auditFilterOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                          className="absolute right-0 top-full mt-2 w-52 p-1.5 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-white/15 rounded-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_0_0_1px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_1px_rgba(255,255,255,0.08)] z-50 overflow-hidden"
                          role="listbox"
                        >
                          <div className="space-y-0.5">
                            {AUDIT_FILTER_OPTIONS.map((opt) => {
                              const isSelected = auditFilter === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => {
                                    setAuditFilter(opt.value);
                                    setAuditFilterOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all duration-150 cursor-pointer text-left ${
                                    isSelected
                                      ? 'bg-[#0071E3]/10 text-[#0071E3] dark:bg-[#0071E3]/20 dark:text-sky-400 font-semibold'
                                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.dotColor}`} />
                                    <span>{opt.label}</span>
                                  </div>
                                  {isSelected && (
                                    <Check
                                      className="w-3.5 h-3.5 text-[#0071E3] dark:text-sky-400 shrink-0"
                                      strokeWidth={2.5}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="mt-3 relative rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/40 shadow-xs overflow-hidden">
                  <div
                    className="overflow-x-auto overflow-y-auto max-h-[300px] sm:max-h-[340px] w-full scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
                    style={{
                      maskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)',
                    }}
                  >
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead className="bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/70 dark:border-white/5 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px] whitespace-nowrap">
                            Action
                          </th>
                          <th className="px-4 py-2.5 font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px] whitespace-nowrap">
                            Details
                          </th>
                          <th className="px-4 py-2.5 font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px] hidden sm:table-cell whitespace-nowrap">
                            Actor
                          </th>
                          <th className="px-4 py-2.5 font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">
                            When
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {visibleAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No logs found for this filter.
                          </td>
                        </tr>
                      ) : (
                        visibleAuditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.025] transition-colors duration-150">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <AuditActionBadge action={log.action} />
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 max-w-sm truncate">
                              {log.target}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-medium hidden sm:table-cell whitespace-nowrap">
                              {log.actor}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-400 whitespace-nowrap">
                              {formatRelative(log.timestamp)}
                            </td>
                          </tr>
                        ))
                      )}
                      {visibleAuditLogs.length > 0 && (
                        <tr aria-hidden="true" className="h-6 pointer-events-none border-none">
                          <td colSpan={4} className="p-0 border-0" />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* White gradient overlay indicating more content underneath */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/60 to-transparent dark:from-[#111827] dark:via-[#111827]/60 dark:to-transparent z-25 rounded-b-2xl" />
              </div>
            </SoftCard>
            </div>
          </StaggerItem>
        )}

        {/* TAB 3: SECURITY */}
        {activeTab === 'security' && (
          <StaggerItem>
            <div className="w-full space-y-6">
              <SoftCard className="w-full">
                <div className="flex items-center gap-3.5 pb-5 sm:pb-6 border-b border-slate-200/80 dark:border-white/10">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/10 shadow-2xs">
                    <Lock className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                      Password &amp; Authentication
                    </h2>
                    <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Update your account password to protect access to the incident dispatch console.
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePasswordSubmit} className="pt-6 sm:pt-7">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                    {/* Left/Main Column: Password Fields & Update Button */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* Current Password */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                          Current Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            required
                            className="w-full px-4 py-3 pr-11 rounded-2xl text-xs sm:text-sm bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:focus:bg-white/[0.09] border border-slate-200/70 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
                            aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                          >
                            {showCurrentPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                          </button>
                        </div>
                      </div>

                      {/* New Password & Confirm Password */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                            New Password <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="At least 8 characters"
                              required
                              className="w-full px-4 py-3 pr-11 rounded-2xl text-xs sm:text-sm bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:focus:bg-white/[0.09] border border-slate-200/70 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
                              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                            >
                              {showNewPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                            Confirm New Password <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter new password"
                              required
                              className="w-full px-4 py-3 pr-11 rounded-2xl text-xs sm:text-sm bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:focus:bg-white/[0.09] border border-slate-200/70 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-90"
                              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {passwordError && (
                        <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/70 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" strokeWidth={1.75} />
                          <span>{passwordError}</span>
                        </div>
                      )}

                      {passwordSuccess && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                          <Check className="w-4 h-4 shrink-0 text-emerald-600" strokeWidth={2} />
                          <span>{passwordSuccess}</span>
                        </div>
                      )}

                      <div className="pt-2">
                        <motion.button
                          type="submit"
                          disabled={isSubmittingPassword}
                          initial="rest"
                          whileHover="hover"
                          whileTap={{ scale: 0.97 }}
                          animate="rest"
                          className="group inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] shadow-[0_2px_8px_rgba(0,113,227,0.25)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.42)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                        >
                          {isSubmittingPassword ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                              <span>Updating Password...</span>
                            </>
                          ) : (
                            <>
                              <motion.span variants={LOCK_BTN_VARIANTS} className="inline-flex items-center justify-center">
                                <Lock className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                              </motion.span>
                              <span>Update Password</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>

                    {/* Right Column: iOS Frosted Credential Guidelines Card */}
                    <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-3.5 shadow-2xs">
                      <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-200">
                        <div className="w-7 h-7 rounded-lg bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <Shield className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          Password Security
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        To protect incident records and console operations, please ensure your credentials follow these baseline protocols:
                      </p>
                      <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>Minimum 8 characters in length</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>Avoid sharing with other team members</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>Active sessions refresh automatically</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </form>
              </SoftCard>
            </div>
          </StaggerItem>
        )}

        {/* TAB 4: PREFERENCES */}
        {activeTab === 'preferences' && (
          <StaggerItem>
            <div className="w-full space-y-6">
              <SoftCard className="w-full">
                <div className="pb-5 sm:pb-6 border-b border-slate-200/80 dark:border-white/10">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    System Preferences
                  </h2>
                  <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Customize your local display mode, alert triggers, and refresh intervals.
                  </p>
                </div>

                <div className="pt-1">
                  {/* Theme Mode */}
                  <div className="py-4.5 sm:py-5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-2xl hover:bg-slate-500/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-150 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/5 shadow-2xs">
                        {isDark ? <Moon className="w-5 h-5" strokeWidth={1.75} /> : <Sun className="w-5 h-5" strokeWidth={1.75} />}
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                          Appearance Mode
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          {isDark ? 'Dark theme active' : 'Light theme active'}
                        </span>
                      </div>
                    </div>
                    <motion.button
                      type="button"
                      initial="rest"
                      whileHover="hover"
                      whileTap={{ scale: 0.96 }}
                      animate="rest"
                      onClick={toggleTheme}
                      className="group inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-white/10 hover:bg-slate-200/70 dark:hover:bg-white/15 border border-slate-200/70 dark:border-white/10 hover:border-[#0071E3]/40 dark:hover:border-sky-400/40 hover:text-[#0071E3] dark:hover:text-sky-400 shadow-2xs hover:shadow-xs transition-colors duration-150 cursor-pointer select-none"
                      title={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
                    >
                      <motion.span
                        variants={isDark ? SUN_BTN_VARIANTS : MOON_BTN_VARIANTS}
                        className="inline-flex items-center justify-center"
                      >
                        {isDark ? (
                          <Sun className="w-4 h-4 shrink-0 text-amber-500" strokeWidth={1.75} />
                        ) : (
                          <Moon className="w-4 h-4 shrink-0 text-indigo-500 dark:text-indigo-400" strokeWidth={1.75} />
                        )}
                      </motion.span>
                      <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>
                    </motion.button>
                  </div>

                  {/* Minimal iOS Hairline Separator */}
                  <div className="h-[1px] w-full bg-slate-200/70 dark:bg-white/10" />

                  {/* Push Notifications */}
                  <div className="py-4.5 sm:py-5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-2xl hover:bg-slate-500/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-150 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/5 shadow-2xs">
                        <Bell className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                          Desktop Notifications
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Receive browser notifications when high-priority alerts are received.
                        </span>
                      </div>
                    </div>
                    <SoftToggle
                      checked={pushNotif}
                      onChange={() => setPushNotif(!pushNotif)}
                      label="Toggle Push Notifications"
                    />
                  </div>

                  {/* Minimal iOS Hairline Separator */}
                  <div className="h-[1px] w-full bg-slate-200/70 dark:bg-white/10" />

                  {/* Sound Alerts */}
                  <div className="py-4.5 sm:py-5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-2xl hover:bg-slate-500/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-150 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/5 shadow-2xs">
                        <Volume2 className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                          Audio Alerts for Critical Incidents
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Play an audible alert when high-priority emergencies are filed.
                        </span>
                      </div>
                    </div>
                    <SoftToggle
                      checked={criticalAlerts}
                      onChange={() => setCriticalAlerts(!criticalAlerts)}
                      label="Toggle Audio Alerts"
                    />
                  </div>

                  {/* Minimal iOS Hairline Separator */}
                  <div className="h-[1px] w-full bg-slate-200/70 dark:bg-white/10" />

                  {/* Live Auto-Refresh */}
                  <div className="py-4.5 sm:py-5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-2xl hover:bg-slate-500/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-150 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-white/5 shadow-2xs">
                        <Globe className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                          Live Auto-Refresh
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Automatically sync telemetry and feed every 30 seconds.
                        </span>
                      </div>
                    </div>
                    <SoftToggle
                      checked={autoRefresh}
                      onChange={() => setAutoRefresh(!autoRefresh)}
                      label="Toggle Auto-Refresh"
                    />
                  </div>
                </div>
              </SoftCard>

              {/* Connected Services & Telemetry Status */}
              <SoftCard className="w-full">
                <div className="pb-5 sm:pb-6 border-b border-slate-200/80 dark:border-white/10">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Integration &amp; Services Status
                  </h2>
                  <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Live connection health across automated intake listeners and AI processing engines.
                  </p>
                </div>

                <div className="pt-1 divide-y divide-slate-200/70 dark:divide-white/10">
                  {/* Messenger Bot */}
                  <div className="py-4.5 sm:py-5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-2xl hover:bg-slate-500/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-150 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-2xs">
                        <Bot className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                          Messenger Bot
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Facebook Messenger webhook listener &amp; auto-response dispatch
                        </span>
                      </div>
                    </div>
                    <StatusBadge active={botConnected} />
                  </div>

                  {/* Facebook Scraper */}
                  <div className="py-4.5 sm:py-5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-2xl hover:bg-slate-500/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-150 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-2xs">
                        <Globe className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                          Facebook Scraper
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Social media monitoring worker &amp; MDRRMO page monitor
                        </span>
                      </div>
                    </div>
                    <StatusBadge active={scraperConnected} />
                  </div>

                  {/* NLP Engine */}
                  <div className="py-4.5 sm:py-5 px-3 sm:px-4 -mx-3 sm:-mx-4 rounded-2xl hover:bg-slate-500/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-150 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 shadow-2xs">
                        <Bot className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                          NLP Engine
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          AI disaster triage &amp; automated classification service
                        </span>
                      </div>
                    </div>
                    <StatusBadge active={nlpConnected} />
                  </div>
                </div>
              </SoftCard>
            </div>
          </StaggerItem>
        )}

      </StaggerContainer>

      {/* =========================================================================
          MODALS & DIALOGS (100% Preserved)
          ========================================================================= */}

      {/* 1. INVITE USER MODAL */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-6 sm:p-7 shadow-[0_24px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)] space-y-4 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Invite New Personnel
              </h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate a unique registration link valid for 24 hours. The recipient will complete signup with their assigned role.
            </p>

            {!generatedInvite ? (
              <form onSubmit={handleGenerateInvite} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Assign Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="staff">Staff (Standard Access)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <CleanButton
                    variant="secondary"
                    onClick={() => setInviteModalOpen(false)}
                  >
                    Cancel
                  </CleanButton>
                  <CleanButton
                    type="submit"
                    variant="primary"
                    disabled={isGeneratingInvite}
                  >
                    {isGeneratingInvite ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      'Generate Link'
                    )}
                  </CleanButton>
                </div>
              </form>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                    Invite URL (Expires in {generatedInvite.expires_in})
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInvite.invite_url}
                      className="w-full text-xs font-mono bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg hover:opacity-90 shrink-0 cursor-pointer active:scale-95 transition-transform"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" strokeWidth={2} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <CleanButton
                    variant="secondary"
                    onClick={() => setInviteModalOpen(false)}
                  >
                    Done
                  </CleanButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ROLE EDIT MODAL */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-6 sm:p-7 shadow-[0_24px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)] space-y-4 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Modify Personnel Role
              </h3>
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Updating role for <strong className="text-slate-800 dark:text-slate-200">{roleModalUser.full_name || roleModalUser.username}</strong> ({roleModalUser.email}).
            </p>

            <form onSubmit={handleSaveRole} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Select New Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  <option value="staff">Staff (Standard Responder)</option>
                  <option value="admin">Administrator (Elevated Permissions)</option>
                  {currentUser?.role === 'super_admin' && (
                    <option value="super_admin">Super Admin (System Owner)</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Your Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={rolePassword}
                  onChange={(e) => setRolePassword(e.target.value)}
                  placeholder="Enter your administrator password"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
                />
              </div>

              {roleError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/70 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>{roleError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <CleanButton
                  variant="secondary"
                  onClick={() => setRoleModalUser(null)}
                  disabled={isUpdatingRole}
                >
                  Cancel
                </CleanButton>
                <CleanButton
                  type="submit"
                  variant="primary"
                  disabled={isUpdatingRole}
                >
                  {isUpdatingRole ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    'Confirm Change'
                  )}
                </CleanButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. DELETE USER MODAL */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-6 sm:p-7 shadow-[0_24px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)] space-y-4 relative">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center border border-rose-200/70 dark:border-rose-900/50">
                <AlertTriangle className="w-6 h-6 shrink-0" strokeWidth={1.75} />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Delete Personnel Account
              </h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to permanently delete the account for <strong className="text-slate-800 dark:text-slate-200">{deleteModalUser.full_name || deleteModalUser.username}</strong> ({deleteModalUser.email})? This action cannot be reversed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <CleanButton
                variant="secondary"
                onClick={() => setDeleteModalUser(null)}
                disabled={isDeletingUser}
              >
                Cancel
              </CleanButton>
              <CleanButton
                variant="danger"
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
              >
                {isDeletingUser ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Delete Account'
                )}
              </CleanButton>
            </div>
          </div>
        </div>
      )}

      {/* 4. DELETE MY ACCOUNT MODAL (Self-Deletion 2-Step OTP) */}
      {deleteSelfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-6 sm:p-7 shadow-[0_24px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)] space-y-4 relative"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center border border-rose-200/70 dark:border-rose-900/50 shadow-2xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Permanently Delete My Account
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDeleteMyAccountModal}
                disabled={isConfirmingDelete}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 active:scale-95"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* STEP 1: PASSWORD CONFIRMATION */}
            {deleteSelfStep === 'password' && (
              <form onSubmit={handlePasswordConfirmAndRequestOtp} className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Please confirm your password. An email verification code will be dispatched to your registered address to confirm deletion.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Your Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showDeleteSelfPassword ? 'text' : 'password'}
                      value={deleteSelfPassword}
                      onChange={(e) => setDeleteSelfPassword(e.target.value)}
                      placeholder="Enter account password"
                      required
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs sm:text-sm bg-slate-100/70 hover:bg-slate-100 focus:bg-white dark:bg-white/5 dark:hover:bg-white/[0.08] dark:focus:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeleteSelfPassword(!showDeleteSelfPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
                    >
                      {showDeleteSelfPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                    </button>
                  </div>
                </div>

                {deleteSelfPasswordError && (
                  <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/70 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" strokeWidth={1.75} />
                    <span>{deleteSelfPasswordError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <CleanButton
                    variant="secondary"
                    onClick={closeDeleteMyAccountModal}
                    disabled={isRequestingOtp}
                  >
                    Cancel
                  </CleanButton>
                  <CleanButton
                    type="submit"
                    variant="danger"
                    disabled={isRequestingOtp}
                    className="group/continue min-w-[125px]"
                  >
                    {isRequestingOtp ? (
                      <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Sending OTP...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                        <span className="font-semibold">Continue</span>
                        <ArrowRight className="w-4 h-4 shrink-0 transition-transform duration-200 ease-out group-hover/continue:translate-x-1" strokeWidth={2} />
                      </span>
                    )}
                  </CleanButton>
                </div>
              </form>
            )}

            {/* STEP 2: EMAIL OTP VERIFICATION */}
            {deleteSelfStep === 'otp' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
                  <Mail className="w-4 h-4 shrink-0 mt-0.5 text-[#0071E3] dark:text-sky-400" strokeWidth={1.75} />
                  <div>
                    A 6-digit confirmation code was sent to <strong className="font-semibold">{deleteSelfMaskedEmail}</strong>.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5 text-center">
                    Enter 6-Digit Code
                  </label>
                  <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                    {deleteSelfOtp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpInputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-10 h-12 text-center text-lg font-bold font-mono bg-slate-100/70 hover:bg-slate-100 focus:bg-white dark:bg-white/5 dark:hover:bg-white/[0.08] dark:focus:bg-white/10 border border-slate-200/80 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                      />
                    ))}
                  </div>

                  {deleteSelfOtpError && (
                    <p className="text-xs text-rose-500 mt-2 text-center flex items-center justify-center gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> {deleteSelfOtpError}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 mt-3 px-1">
                    <span>Didn&apos;t receive code?</span>
                    {otpCooldown > 0 ? (
                      <span className="font-mono text-slate-500 dark:text-slate-400">Resend in {otpCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendDeleteOtp}
                        disabled={isRequestingOtp}
                        className="text-[#0071E3] dark:text-sky-400 font-semibold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {isRequestingOtp ? 'Sending...' : 'Resend Code'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteSelfStep('password');
                      setDeleteSelfOtpError(null);
                    }}
                    disabled={isConfirmingDelete}
                    className="group/back inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer active:scale-95"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover/back:-translate-x-1" strokeWidth={2} />
                    <span>Back</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <CleanButton
                      variant="secondary"
                      onClick={closeDeleteMyAccountModal}
                      disabled={isConfirmingDelete}
                    >
                      Cancel
                    </CleanButton>
                    <CleanButton
                      variant="danger"
                      onClick={handleFinalDeleteSelf}
                      disabled={isConfirmingDelete || deleteSelfOtp.join('').length !== 6}
                    >
                      {isConfirmingDelete ? (
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>Deleting...</span>
                        </span>
                      ) : (
                        'Confirm Delete'
                      )}
                    </CleanButton>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS STATE */}
            {deleteSelfStep === 'success' && (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                  Account Deleted
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Your credentials have been cleared. Redirecting to sign-in page...
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing out...</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* 5. SIGN OUT MODAL */}
      <SignOutModal
        isOpen={signOutModalOpen}
        onClose={() => !isSigningOut && setSignOutModalOpen(false)}
        onConfirm={handleConfirmSignOut}
        isLoading={isSigningOut}
        user={currentUser}
      />

    </div>
  );
}
