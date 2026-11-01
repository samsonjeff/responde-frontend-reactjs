import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../components/ThemeContent';
import { useAuth } from '../context/AuthContext';
import {
  Settings as SettingsIcon,
  UserCircle,
  Shield,
  Lock,
  Bell,
  Pencil,
  Trash2,
  RefreshCw,
  UserPlus,
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
} from 'lucide-react';
import SignOutModal from '../components/SignOutModal';
import { StaggerContainer, StaggerItem } from '../components/Stagger';
import { authService, type AuthUser, type UserRole, AuthError } from '../services/authService';
import { motion } from 'framer-motion';
import { formatPhilippineDateTime } from '../utils/dateUtils';

const APPLE_SLIDE_SPRING = { type: 'spring', stiffness: 400, damping: 32, mass: 0.8 } as const;

type TabKey = 'profile' | 'team' | 'security' | 'preferences';

type AuditAction = 'invite' | 'signup' | 'role_change' | 'user_deleted' | 'password_change' | 'login';

type AuditEntry = {
  id: string;
  actor: string;
  action: AuditAction;
  target: string;
  timestamp: string;
};

/* Calm, low-saturation neutral badges with micro-dot indicator */
const AUDIT_META: Record<AuditAction, { label: string; dotColor: string }> = {
  invite: { label: 'Invite Generated', dotColor: 'bg-purple-500' },
  signup: { label: 'Personnel Sign Up', dotColor: 'bg-emerald-500' },
  role_change: { label: 'Role Changed', dotColor: 'bg-sky-500' },
  user_deleted: { label: 'User Deleted', dotColor: 'bg-rose-500' },
  password_change: { label: 'Password Changed', dotColor: 'bg-indigo-500' },
  login: { label: 'Sign In', dotColor: 'bg-slate-400' },
};

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
      className={`rounded-2xl border transition-all duration-300 p-6 sm:p-7 ${className}`}
      style={{
        backgroundColor: 'var(--soft-surface)',
        borderColor: 'var(--soft-border)',
        boxShadow: 'var(--soft-shadow-card)',
      }}
    >
      {children}
    </div>
  );
}

/**
 * CleanButton: Tactile button with subtle borders and gentle scale feedback.
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
    styles = 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 shadow-xs';
  } else if (variant === 'secondary') {
    styles = 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/70 border border-slate-200/80 dark:border-slate-700/80 shadow-xs';
  } else if (variant === 'danger') {
    styles = 'bg-rose-50 text-rose-700 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40 border border-rose-200/70 dark:border-rose-900/50';
  } else {
    styles = 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60';
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 min-h-[42px] sm:min-h-[38px] text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none ${styles} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
      <span>{children}</span>
    </button>
  );
}

/**
 * SoftToggle: Clean, simple toggle with smooth track transition.
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 border ${
        checked
          ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500'
          : 'bg-slate-200 dark:bg-slate-700 border-slate-300/80 dark:border-slate-600/80'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition duration-200 ease-in-out ${
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
function UserRoleBadge({ role }: { role: string }) {
  let dotColor = 'bg-slate-400';
  let label = 'Staff';

  if (role === 'super_admin') {
    dotColor = 'bg-purple-500';
    label = 'Super Admin';
  } else if (role === 'admin') {
    dotColor = 'bg-sky-500';
    label = 'Admin';
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      <span>{label}</span>
    </span>
  );
}

/**
 * AuditActionBadge: Neutral pill badge with a 6px semantic color indicator dot.
 */
function AuditActionBadge({ action }: { action: AuditAction }) {
  const meta = AUDIT_META[action] || { label: action, dotColor: 'bg-slate-400' };

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor} shrink-0`} />
      <span>{meta.label}</span>
    </span>
  );
}

export default function Settings() {
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
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

    const q = searchQuery.toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="settings-soft w-full">
      <StaggerContainer className="space-y-6 max-w-6xl mx-auto pb-24 md:pb-0">

        {/* ── UNIFIED APPLE macOS / iOS PAGE HEADER WITH INTEGRATED SEGMENTED TABS ── */}
        <StaggerItem>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
                <SettingsIcon className="w-5 h-5 sm:w-5.5 sm:h-5.5" strokeWidth={1.75} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg sm:text-[22px] font-semibold tracking-[-0.025em] leading-tight text-slate-900 dark:text-white">
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

            {/* ── Apple iOS / macOS Fluid Segmented Navigation Tabs ── */}
            <div className="overflow-x-auto scrollbar-none -mx-1 px-1 py-0.5 shrink-0">
              <div className="p-1 bg-slate-200/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/5 inline-flex items-center gap-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
                {settingsTabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative px-3.5 py-1.5 sm:px-4 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 inline-flex items-center justify-center gap-2 select-none active:scale-[0.97] cursor-pointer whitespace-nowrap ${
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
                      <Icon className={`w-4 h-4 relative z-10 transition-colors ${isActive ? "text-[#0071E3] dark:text-sky-400" : "text-slate-500 dark:text-slate-400"}`} strokeWidth={1.75} />
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* 3. TAB PANELS */}

        {/* TAB 1: PROFILE */}
        {activeTab === 'profile' && (
          <StaggerItem>
            <div className="space-y-6">
              <SoftCard>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                      Profile Information
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Personal information associated with your command center account.
                    </p>
                  </div>

                  {!isEditingProfile && (
                    <CleanButton
                      variant="secondary"
                      icon={Pencil}
                      onClick={() => { setProfileDraft(profile); setIsEditingProfile(true); }}
                    >
                      Edit Profile
                    </CleanButton>
                  )}
                </div>

                {/* Profile Details Body */}
                <div className="pt-6 flex flex-col md:flex-row gap-6 items-start">
                  {/* Avatar & Role Tag */}
                  <div className="flex sm:flex-row md:flex-col items-center gap-4 shrink-0">
                    <div className="relative">
                      {currentUser?.avatar_url ? (
                        <img
                          src={currentUser.avatar_url}
                          alt={profile.fullName || 'User'}
                          className="w-20 h-20 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 border border-blue-500/20 font-bold text-2xl flex items-center justify-center shadow-xs">
                          {(profile.fullName || currentUser?.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <span
                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                        title="Active Status"
                      />
                    </div>
                    <div className="text-left md:text-center">
                      <UserRoleBadge role={userRole} />
                      <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1.5 whitespace-nowrap">
                        ID: {currentUser?.user_id ? String(currentUser.user_id).slice(0, 8) : 'ACTIVE'}
                      </p>
                    </div>
                  </div>

                  {/* Form or Info Display */}
                  <div className="flex-1 w-full">
                    {isEditingProfile ? (
                      <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                              Full Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={profileDraft.fullName}
                              onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })}
                              required
                              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 focus:bg-white dark:bg-slate-800/50 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-colors"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                              Username
                            </label>
                            <input
                              type="text"
                              value={usernameDisplay}
                              disabled
                              readOnly
                              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono bg-slate-100/70 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800 text-slate-500 cursor-not-allowed select-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                              Email Address
                            </label>
                            <input
                              type="email"
                              value={currentUser?.email || ''}
                              disabled
                              readOnly
                              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono bg-slate-100/70 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800 text-slate-500 cursor-not-allowed select-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                              Phone Number
                            </label>
                            <input
                              type="tel"
                              value={profileDraft.phone}
                              onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })}
                              placeholder="09XX-XXX-XXXX"
                              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 focus:bg-white dark:bg-slate-800/50 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-colors"
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                              Title &amp; Unit
                            </label>
                            <input
                              type="text"
                              value={profileDraft.position}
                              onChange={(e) => setProfileDraft({ ...profileDraft, position: e.target.value })}
                              placeholder="e.g. Lead Dispatcher • MDRRMO Command"
                              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 focus:bg-white dark:bg-slate-800/50 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-colors"
                            />
                          </div>
                        </div>

                        {profileError && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/70 text-xs text-rose-700 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                            <span>{profileError}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 justify-end">
                          <CleanButton
                            variant="secondary"
                            onClick={() => { setIsEditingProfile(false); setProfileError(null); }}
                            disabled={isSavingProfile}
                          >
                            Cancel
                          </CleanButton>
                          <CleanButton
                            type="submit"
                            variant="primary"
                            disabled={isSavingProfile}
                          >
                            {isSavingProfile ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              'Save Changes'
                            )}
                          </CleanButton>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            Full Name
                          </span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                            {profile.fullName || 'Not provided'}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            Username
                          </span>
                          <span className="text-sm font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                            @{usernameDisplay}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            Email Address
                          </span>
                          <span className="text-sm font-mono text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                            {currentUser?.email || 'No email attached'}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            Contact Phone
                          </span>
                          <span className="text-sm font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                            {profile.phone || 'None recorded'}
                          </span>
                        </div>

                        <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            Official Role &amp; Unit
                          </span>
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">
                            {profile.position}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </SoftCard>

              {/* Danger Zone: Account Deletion */}
              <SoftCard className="border-rose-200/60 dark:border-rose-900/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-rose-700 dark:text-rose-400">
                      Delete Account
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Permanently delete your profile and revoke system access. Requires password &amp; email OTP verification.
                    </p>
                  </div>
                  <CleanButton
                    variant="danger"
                    icon={Trash2}
                    onClick={openDeleteMyAccountModal}
                  >
                    Delete Account
                  </CleanButton>
                </div>
              </SoftCard>
            </div>
          </StaggerItem>
        )}

        {/* TAB 2: TEAM & ACCESS (Admin / Super Admin Only) */}
        {activeTab === 'team' && canViewUsers && (
          <StaggerItem>
            <div className="space-y-6">
              <SoftCard>
                {/* Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                      Team Members
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Manage registered personnel accounts and role permissions.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchUsers}
                      disabled={loadingUsers}
                      className="p-2.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      title="Refresh user list"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} strokeWidth={1.75} />
                    </button>

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

                {/* Search Bar */}
                <div className="pt-4 pb-2">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" strokeWidth={1.75} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, email, or username..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50/70 focus:bg-white dark:bg-slate-800/40 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-colors"
                    />
                  </div>
                </div>

                {userError && (
                  <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200/70 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>{userError}</span>
                  </div>
                )}

                {/* Clean, Non-Glaring User Table */}
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                  <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200/70 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] whitespace-nowrap">
                          User
                        </th>
                        <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] whitespace-nowrap">
                          Role
                        </th>
                        <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] hidden md:table-cell whitespace-nowrap">
                          Last Login
                        </th>
                        <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {loadingUsers ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
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
                            <tr key={u.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {u.avatar_url ? (
                                    <img
                                      src={u.avatar_url}
                                      alt={u.full_name}
                                      className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-[#0071E3] dark:text-sky-400 font-semibold text-xs flex items-center justify-center border border-blue-500/20">
                                      {(u.full_name || u.email || 'U')[0].toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                      <span>{u.full_name || 'Unnamed Personnel'}</span>
                                      {isSelf && (
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                      {u.username && <span>@{u.username} •</span>}
                                      <span className="truncate max-w-xs">{u.email}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <UserRoleBadge role={u.role} />
                              </td>

                              <td className="px-4 py-3 text-xs text-slate-400 font-mono hidden md:table-cell whitespace-nowrap">
                                {u.last_login_at
                                  ? formatPhilippineDateTime(u.last_login_at, { includeYear: true })
                                  : 'Never'}
                              </td>

                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
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
                                      className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                    >
                                      Edit Role
                                    </button>
                                  )}

                                  {currentUser?.role === 'super_admin' && !isSelf && u.role !== 'super_admin' && (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteModalUser(u)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer active:scale-95"
                                      title="Delete personnel account"
                                    >
                                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                                    </button>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                      Activity Log
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      System records of logins, credential updates, and permission changes.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Filter:</span>
                    <select
                      value={auditFilter}
                      onChange={(e) => setAuditFilter(e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Events</option>
                      <option value="invite">Invites</option>
                      <option value="signup">Signups</option>
                      <option value="role_change">Role Changes</option>
                      <option value="password_change">Password Updates</option>
                      <option value="user_deleted">Deletions</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                  <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200/70 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] whitespace-nowrap">
                          Action
                        </th>
                        <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] whitespace-nowrap">
                          Details
                        </th>
                        <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] hidden sm:table-cell whitespace-nowrap">
                          Actor
                        </th>
                        <th className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">
                          When
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {visibleAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No logs found for this filter.
                          </td>
                        </tr>
                      ) : (
                        visibleAuditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
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
                    </tbody>
                  </table>
                </div>
              </SoftCard>
            </div>
          </StaggerItem>
        )}

        {/* TAB 3: SECURITY */}
        {activeTab === 'security' && (
          <StaggerItem>
            <div className="space-y-6">
              <SoftCard>
                <div className="pb-5 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                    Password &amp; Authentication
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Update your account password to protect access to the incident dispatch console.
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="pt-6 max-w-lg space-y-4">
                  {/* Current Password */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Current Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs sm:text-sm bg-slate-50/70 focus:bg-white dark:bg-slate-800/50 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs sm:text-sm bg-slate-50/70 focus:bg-white dark:bg-slate-800/50 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Confirm New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs sm:text-sm bg-slate-50/70 focus:bg-white dark:bg-slate-800/50 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/70 text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/70 text-xs text-emerald-700 flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" strokeWidth={2} />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <CleanButton
                      type="submit"
                      variant="primary"
                      disabled={isSubmittingPassword}
                    >
                      {isSubmittingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </CleanButton>
                  </div>
                </form>
              </SoftCard>
            </div>
          </StaggerItem>
        )}

        {/* TAB 4: PREFERENCES */}
        {activeTab === 'preferences' && (
          <StaggerItem>
            <div className="space-y-6">
              <SoftCard>
                <div className="pb-5 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                    System Preferences
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Customize your local display mode, alert triggers, and refresh intervals.
                  </p>
                </div>

                <div className="pt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Theme Mode */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        {isDark ? <Moon className="w-5 h-5" strokeWidth={1.75} /> : <Sun className="w-5 h-5" strokeWidth={1.75} />}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">
                          Appearance Mode
                        </span>
                        <span className="text-xs text-slate-400 block">
                          {isDark ? 'Dark theme active' : 'Light theme active'}
                        </span>
                      </div>
                    </div>
                    <CleanButton
                      variant="secondary"
                      onClick={toggleTheme}
                    >
                      {isDark ? 'Switch to Light' : 'Switch to Dark'}
                    </CleanButton>
                  </div>

                  {/* Push Notifications */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Bell className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">
                          Desktop Notifications
                        </span>
                        <span className="text-xs text-slate-400 block">
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

                  {/* Sound Alerts */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Volume2 className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">
                          Audio Alerts for Critical Incidents
                        </span>
                        <span className="text-xs text-slate-400 block">
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

                  {/* Live Auto-Refresh */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Globe className="w-5 h-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">
                          Live Auto-Refresh
                        </span>
                        <span className="text-xs text-slate-400 block">
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
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-6 sm:p-7 shadow-[0_24px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)] space-y-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center border border-rose-200/70 dark:border-rose-900/50">
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
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Please confirm your password. An email verification code will be dispatched to your registered address to confirm deletion.
                </p>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Your Password
                  </label>
                  <div className="relative">
                    <input
                      type={showDeleteSelfPassword ? 'text' : 'password'}
                      value={deleteSelfPassword}
                      onChange={(e) => setDeleteSelfPassword(e.target.value)}
                      placeholder="Enter account password"
                      required
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeleteSelfPassword(!showDeleteSelfPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showDeleteSelfPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                    </button>
                  </div>
                </div>

                {deleteSelfPasswordError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/70 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>{deleteSelfPasswordError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
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
                  >
                    {isRequestingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                      </>
                    )}
                  </CleanButton>
                </div>
              </form>
            )}

            {/* STEP 2: EMAIL OTP VERIFICATION */}
            {deleteSelfStep === 'otp' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2">
                  <Mail className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" strokeWidth={1.75} />
                  <div>
                    A 6-digit confirmation code was sent to <strong className="font-semibold">{deleteSelfMaskedEmail}</strong>.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 text-center">
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
                        className="w-10 h-12 text-center text-lg font-bold font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ))}
                  </div>

                  {deleteSelfOtpError && (
                    <p className="text-xs text-rose-500 mt-2 text-center flex items-center justify-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> {deleteSelfOtpError}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 mt-3 px-1">
                    <span>Didn&apos;t receive code?</span>
                    {otpCooldown > 0 ? (
                      <span className="font-mono">Resend in {otpCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendDeleteOtp}
                        disabled={isRequestingOtp}
                        className="text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {isRequestingOtp ? 'Sending...' : 'Resend Code'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteSelfStep('password');
                      setDeleteSelfOtpError(null);
                    }}
                    disabled={isConfirmingDelete}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer p-1 active:scale-95 transition-transform"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
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
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Deleting...</span>
                        </>
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
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
                  Account Deleted
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Your credentials have been cleared. Redirecting to sign-in page...
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing out...</span>
                </div>
              </div>
            )}
          </div>
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
