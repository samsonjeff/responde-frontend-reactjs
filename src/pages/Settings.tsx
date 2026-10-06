import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../components/ThemeContent';
import { useAuth } from '../context/AuthContext';
import {
  Moon, Sun, Bell, Shield, Database, Users,
  RefreshCw, Wifi, Check, X, UserPlus, Copy,
  CheckCircle2, AlertCircle, ShieldCheck,
  Search, Lock, Loader2, Eye, EyeOff, KeyRound,
  Trash2, AlertTriangle, UserCircle, Pencil, Phone, Briefcase, Mail,
  History, ArrowRight, ArrowLeft, AtSign, LogOut
} from 'lucide-react';
import SignOutModal from '../components/SignOutModal';
import { authService, type AuthUser, type UserRole, AuthError } from '../services/authService';

type AuditAction = 'invite' | 'signup' | 'role_change' | 'user_deleted' | 'password_change' | 'login';

type AuditEntry = {
  id: string;
  actor: string;
  action: AuditAction;
  target: string;
  timestamp: string;
};

const AUDIT_META: Record<AuditAction, { label: string; className: string }> = {
  invite: { label: 'Invite Generated', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  signup: { label: 'Personnel Sign Up', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  role_change: { label: 'Role Change', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  user_deleted: { label: 'User Deleted', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  password_change: { label: 'Password Changed', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
  login: { label: 'Sign In', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const formatRelative = (iso: string) => {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff} min ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`;
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'
          }`}
      />
    </button>
  );
}

function Card({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] p-6">
      <div className="flex items-center gap-2 mb-5">
        <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${active
        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
        : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
      }`}>
      <Wifi className="w-3 h-3" />
      {active ? 'Connected' : 'Disconnected'}
    </span>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { user: currentUser, logout } = useAuth();
  const userRole = (currentUser?.role || '').toLowerCase().trim();
  const canViewUsers = userRole === 'super_admin' || userRole === 'admin';

  const [pushNotif, setPushNotif] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [botConnected] = useState(true);
  const [scraperConnected] = useState(true);

  // -- User Management State --
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<'staff' | 'admin'>('staff');
  const [generatedInvite, setGeneratedInvite] = useState<{ invite_url: string; expires_in: string } | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Role Edit Modal (Password confirmation required)
  const [roleModalUser, setRoleModalUser] = useState<AuthUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [rolePassword, setRolePassword] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Profile State (local only)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profile, setProfile] = useState({
    fullName: currentUser?.full_name || '',
    phone: '',
    position: 'MDRRMO Personnel',
  });
  const [profileDraft, setProfileDraft] = useState(profile);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setTimeout(() => {
      setProfile(profileDraft);
      setIsSavingProfile(false);
      setIsEditingProfile(false);
      showSuccessFeedback('Profile updated successfully.');
    }, 600);
  };

  // Audit Log (mock, Super Admin only)
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([
    { id: 'a1', actor: currentUser?.full_name || 'Super Admin', action: 'login', target: 'Authenticated via 2FA from Windows PC (Chrome)', timestamp: minutesAgo(4) },
    { id: 'a2', actor: 'Sedrick Amote', action: 'signup', target: 'Completed registration via Staff invite token', timestamp: minutesAgo(35) },
    { id: 'a3', actor: currentUser?.full_name || 'Super Admin', action: 'role_change', target: 'Promoted Juan Dela Cruz: Staff → Admin', timestamp: minutesAgo(110) },
    { id: 'a4', actor: currentUser?.full_name || 'Super Admin', action: 'invite', target: 'Generated 24-hr Staff invite URL', timestamp: minutesAgo(60 * 3) },
    { id: 'a5', actor: 'Maria Santos', action: 'password_change', target: 'Account password updated securely', timestamp: minutesAgo(60 * 8) },
    { id: 'a6', actor: currentUser?.full_name || 'Super Admin', action: 'invite', target: 'Generated 24-hr Admin invite URL', timestamp: minutesAgo(60 * 28) },
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
      showSuccessFeedback(`${deletedName} has been deleted successfully.`);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setIsDeletingUser(false);
      setDeleteModalUser(null);
    }
  };

  // Mobile Sign Out State
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

  // Delete My Account (Self-Deletion via Password & Email OTP)
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
      setDeleteSelfPasswordError('Please enter your account password to continue.');
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
        target: `${actorName} (${userDisplayRole} self-deleted account via Password & OTP)`,
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

  // Change Password Modal State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const resetPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsSubmittingPassword(false);
    setPasswordModalOpen(false);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
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
      setPasswordError('New passwords do not match. Please re-enter.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setIsSubmittingPassword(true);
    // Client-side simulation as requested (no backend auth call)
    setTimeout(() => {
      setIsSubmittingPassword(false);
      setPasswordSuccess('Password successfully updated! Your credentials have been saved.');
      setAuditLogs(prev => [{
        id: `a${Date.now()}`,
        actor: currentUser?.full_name || 'Super Admin',
        action: 'password_change',
        target: 'User changed account password',
        timestamp: new Date().toISOString(),
      }, ...prev]);
      showSuccessFeedback('Password changed successfully');
      setTimeout(() => {
        resetPasswordModal();
      }, 1600);
    }, 700);
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
      setRoleError('Please confirm your current administrator password.');
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

    // When the logged-in user is an Admin (not a Super Admin), filter out Super Admin users completely
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
    <div className="space-y-6 pb-28 sm:pb-32 md:pb-8">

      {/* PROFILE CARD */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Profile</h3>
          </div>
          {!isEditingProfile && (
            <button
              type="button"
              onClick={() => { setProfileDraft(profile); setIsEditingProfile(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-5">
          <div className="flex sm:flex-col items-center gap-3 sm:w-36 shrink-0">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={profile.fullName || 'Profile'}
                className="w-20 h-20 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white font-bold text-2xl flex items-center justify-center shadow-md">
                {(profile.fullName || currentUser?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${userRole === 'super_admin'
                  ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800'
                  : userRole === 'admin'
                    ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800'
                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
            >
              {userRole === 'super_admin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : 'Staff'}
            </span>
          </div>

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={profileDraft.fullName}
                  onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Username <span className="text-[10px] text-slate-400 font-normal lowercase">(read-only)</span>
                </label>
                <input
                  type="text"
                  value={usernameDisplay}
                  disabled
                  readOnly
                  title="Username cannot be changed"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email <span className="text-[10px] text-slate-400 font-normal lowercase">(read-only)</span>
                </label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  readOnly
                  title="Email cannot be changed here"
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Contact Number</label>
                <input
                  type="tel"
                  value={profileDraft.phone}
                  onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })}
                  placeholder="09XX-XXX-XXXX"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Position</label>
                <input
                  type="text"
                  value={profileDraft.position}
                  onChange={(e) => setProfileDraft({ ...profileDraft, position: e.target.value })}
                  placeholder="e.g. Dispatcher, MDRRMO"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  disabled={isSavingProfile}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <dl className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {[
                { icon: UserCircle, label: 'Full Name', value: profile.fullName || currentUser?.full_name || 'Not set' },
                { icon: AtSign, label: 'Username', value: usernameDisplay },
                { icon: Mail, label: 'Email', value: currentUser?.email || 'Not set' },
                { icon: Phone, label: 'Contact Number', value: profile.phone || 'Not set' },
                { icon: Briefcase, label: 'Position', value: profile.position || 'Not set' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">{label}</dt>
                    <dd className={`text-sm truncate ${value === 'Not set' ? 'text-slate-400 italic' : 'text-slate-800 dark:text-slate-100 font-medium'}`}>
                      {value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card icon={isDark ? Moon : Sun} title="System Preferences">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isDark
                  ? <Moon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  : <Sun className="w-4 h-4 text-slate-500" />}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Dark Mode</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Switch between light and dark themes</p>
                </div>
              </div>
              <Toggle checked={isDark} onChange={toggleTheme} />
            </div>
          </div>
        </Card>

        <Card icon={Bell} title="Notifications">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Push Notification</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Browser alerts for new incidents</p>
              </div>
              <Toggle checked={pushNotif} onChange={() => setPushNotif(!pushNotif)} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Critical Alerts</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Priority warnings for high-urgency reports</p>
              </div>
              <Toggle checked={criticalAlerts} onChange={() => setCriticalAlerts(!criticalAlerts)} />
            </div>
          </div>
        </Card>

        <Card icon={Shield} title="Security">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Two-Factor Authentication</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">6-digit email code on manual sign-in and password resets</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Active
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Change Password</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Update your account password to keep your credentials secure</p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow"
              >
                Change Password
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Delete Account</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Permanently delete your personal account with password &amp; OTP</p>
              </div>
              <button
                type="button"
                onClick={openDeleteMyAccountModal}
                className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900 rounded-xl transition-all cursor-pointer shadow-xs hover:shadow flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </Card>

        <Card icon={Database} title="Data Sources">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Messenger Bot</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Facebook Messenger integration</p>
                </div>
              </div>
              <StatusBadge active={botConnected} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <Database className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Facebook Scraper</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">MDRRMO page monitor</p>
                </div>
              </div>
              <StatusBadge active={scraperConnected} />
            </div>
          </div>
        </Card>
      </div>

      {/* USER MANAGEMENT SECTION */}
      {canViewUsers && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                  User Management &amp; Access Control
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Manage personnel, generate invitation links, and assign administrative roles.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Refresh user list"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              </button>
              {currentUser?.role === 'super_admin' && (
                <button
                  onClick={() => {
                    setInviteModalOpen(true);
                    setGeneratedInvite(null);
                    setCopied(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm shadow-blue-700/20 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite New User</span>
                </button>
              )}
            </div>
          </div>

          {userError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{userError}</span>
            </div>
          )}

          {/* Search bar */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or username..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline-block">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'personnel' : 'personnel'}
            </span>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/60">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Last Login</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                      Loading system users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No users found.
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
                      disabledReason = 'Read-only view';
                    }

                    return (
                      <tr key={u.user_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.full_name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                                {(u.full_name || u.email || 'U')[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-100">
                                {u.full_name || 'Unnamed Personnel'}
                                {isSelf && (
                                  <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    You
                                  </span>
                                )}
                              </div>
                              {u.username && (
                                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                    @{u.username}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.role === 'super_admin'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : u.role === 'admin'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                          >
                            {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Staff'}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleString('en-US', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                            : 'Never'}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditDisabled ? (
                              <div
                                className="inline-flex items-center gap-1.5"
                                title={disabledReason}
                              >
                                <button
                                  type="button"
                                  disabled
                                  title={disabledReason}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/60 rounded-lg cursor-not-allowed opacity-60"
                                >
                                  Edit Role
                                </button>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                                  ({disabledReason})
                                </span>
                              </div>
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
                                className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                              >
                                Edit Role
                              </button>
                            )}

                            {/* Super Admin Delete Action */}
                            {currentUser?.role === 'super_admin' && (
                              u.role === 'super_admin' ? (
                                <button
                                  type="button"
                                  disabled
                                  title="Super Admin accounts are protected and cannot be deleted"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 dark:text-slate-600 bg-slate-100/50 dark:bg-slate-800/30 rounded-lg cursor-not-allowed opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteModalUser(u)}
                                  title={`Delete ${u.role === 'admin' ? 'Admin' : 'Staff'} ${u.full_name || u.username}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              )
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
        </div>
      )}

      {/* AUDIT LOG (Super Admin Only) */}
      {userRole === 'super_admin' && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">Audit Log</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Record of security, authentication, and access control events across the system.
              </p>
            </div>
            <select
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value as AuditAction | 'all')}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs sm:text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All actions</option>
              {(Object.keys(AUDIT_META) as AuditAction[]).map((key) => (
                <option key={key} value={key}>{AUDIT_META[key].label}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/60">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">Performed By</th>
                  <th className="px-4 py-3 font-semibold text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">No activity for this filter.</td>
                  </tr>
                ) : (
                  visibleAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${AUDIT_META[log.action].className}`}>
                          {AUDIT_META[log.action].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{log.target}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{log.actor}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap">{formatRelative(log.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DANGER ZONE SECTION */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-rose-200 dark:border-rose-900/40 shadow-[0_4px_24px_rgba(244,63,94,0.06)] dark:shadow-[0_4px_24px_rgba(244,63,94,0.15)] p-6">
        <div className="flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">Danger Zone</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Irreversible and permanent actions regarding your personal credentials and system access.
        </p>

        <div className="pt-4 border-t border-rose-100 dark:border-rose-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Delete My Account</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mt-0.5">
              Permanently delete your personal {userRole === 'super_admin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : 'Staff'} account ({currentUser?.email}). Because administrators cannot delete a Super Admin from the personnel directory, you can securely self-delete your account here after confirming your password and email OTP.
            </p>
          </div>
          <button
            type="button"
            onClick={openDeleteMyAccountModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-white bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-600 dark:hover:bg-rose-600 border border-rose-200 dark:border-rose-800 rounded-xl transition-all shadow-xs cursor-pointer shrink-0 active:scale-[0.98]"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete My Account</span>
          </button>
        </div>
      </div>

      {/* MOBILE-ONLY SIGN OUT BUTTON (Cellphone view) */}
      <div className="md:hidden pt-3 pb-8 mb-4">
        <button
          type="button"
          onClick={() => setSignOutModalOpen(true)}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 text-sm font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-[#111827] hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl transition-all shadow-xs active:scale-[0.98] cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* SUCCESS TOAST */}
      {actionSuccess && (
        <div className="fixed bottom-6 right-6 z-[250] px-4 py-3 rounded-xl bg-white dark:bg-[#111827] border border-green-200 dark:border-green-800 shadow-xl flex items-center gap-2 text-green-700 dark:text-green-300 text-xs sm:text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* INVITE NEW USER MODAL */}
      {canViewUsers && inviteModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  Generate Invitation Link
                </h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Generate a secure 15-minute invitation link to send directly to new command center personnel.
              Only personnel with an authorized invitation link can create an account.
            </p>

            {!generatedInvite ? (
              <form onSubmit={handleGenerateInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Assign Role for New User
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'staff' | 'admin')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="staff">Staff (Dashboard &amp; Incident Viewer)</option>
                    <option value="admin">Admin (Manage Data, Reports, &amp; Staff)</option>
                  </select>
                  {currentUser?.role === 'admin' && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Note: Administrators can invite Staff or fellow Admins. Only Super Admins can assign the Super Admin role.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingInvite}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isGeneratingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Generate Invite Link</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl text-xs text-green-800 dark:text-green-300">
                  <p className="font-semibold mb-1">Invite link ready!</p>
                  <p className="text-[11px] opacity-90">
                    Share this link with the user. It expires in {generatedInvite.expires_in}.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Invitation Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInvite.invite_url}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedInvite(null);
                      setInviteModalOpen(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT ROLE MODAL */}
      {canViewUsers && roleModalUser && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  Change User Role
                </h3>
              </div>
              <button
                onClick={() => setRoleModalUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Changing role for: <strong className="text-slate-800 dark:text-slate-100">{roleModalUser.full_name || roleModalUser.username}</strong> ({roleModalUser.email})
            </p>

            {roleError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{roleError}</span>
              </div>
            )}

            {(() => {
              const isModalTargetSuperAdmin = roleModalUser.role === 'super_admin';
              const isAdminEditingSuperAdmin = currentUser?.role === 'admin' && isModalTargetSuperAdmin;
              const isModalSelf = roleModalUser.user_id === currentUser?.user_id;
              const isStaffViewer = currentUser?.role === 'staff';

              const isRoleSelectionDisabled = isAdminEditingSuperAdmin || isModalSelf || isStaffViewer;
              const roleDisabledTooltip = isAdminEditingSuperAdmin
                ? 'Insufficient permissions'
                : isModalSelf
                  ? 'You cannot edit your own role'
                  : isStaffViewer
                    ? 'Read-only view'
                    : undefined;

              return (
                <form onSubmit={handleSaveRole} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Select New Role
                      </label>
                      {isAdminEditingSuperAdmin && (
                        <span
                          className="text-[11px] text-amber-600 dark:text-amber-400 font-medium italic"
                          title="Insufficient permissions"
                        >
                          Insufficient permissions
                        </span>
                      )}
                      {isModalSelf && (
                        <span
                          className="text-[11px] text-slate-400 dark:text-slate-500 italic"
                          title="You cannot edit your own role"
                        >
                          You cannot edit your own role
                        </span>
                      )}
                      {isStaffViewer && (
                        <span
                          className="text-[11px] text-slate-400 dark:text-slate-500 italic"
                          title="Read-only view"
                        >
                          Read-only view
                        </span>
                      )}
                    </div>
                    <div
                      className="space-y-2"
                      title={roleDisabledTooltip}
                    >
                      <label
                        title={roleDisabledTooltip}
                        className={`flex items-center gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl ${isRoleSelectionDisabled
                            ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900'
                            : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                      >
                        <input
                          type="radio"
                          name="roleOption"
                          value="staff"
                          disabled={isRoleSelectionDisabled}
                          checked={selectedRole === 'staff'}
                          onChange={() => !isRoleSelectionDisabled && setSelectedRole('staff')}
                          className="text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Staff</p>
                          <p className="text-[11px] text-slate-400">Dashboard &amp; Incident Viewer (read-only)</p>
                        </div>
                      </label>

                      <label
                        title={roleDisabledTooltip}
                        className={`flex items-center gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl ${isRoleSelectionDisabled
                            ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900'
                            : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                      >
                        <input
                          type="radio"
                          name="roleOption"
                          value="admin"
                          disabled={isRoleSelectionDisabled}
                          checked={selectedRole === 'admin'}
                          onChange={() => !isRoleSelectionDisabled && setSelectedRole('admin')}
                          className="text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Admin</p>
                          <p className="text-[11px] text-slate-400">Manage data, accept staff, and promote admins</p>
                        </div>
                      </label>

                      <label
                        title={roleDisabledTooltip}
                        className={`flex items-center gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl ${!isRoleSelectionDisabled && currentUser?.role === 'super_admin'
                            ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
                            : 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900'
                          }`}
                      >
                        <input
                          type="radio"
                          name="roleOption"
                          value="super_admin"
                          disabled={isRoleSelectionDisabled || currentUser?.role !== 'super_admin'}
                          checked={selectedRole === 'super_admin'}
                          onChange={() => !isRoleSelectionDisabled && setSelectedRole('super_admin')}
                          className="text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            Super Admin {currentUser?.role !== 'super_admin' && '(Super Admin only)'}
                          </p>
                          <p className="text-[11px] text-slate-400">Full system access</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Password confirmation */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Your Password Confirmation <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="password"
                        value={rolePassword}
                        onChange={(e) => setRolePassword(e.target.value)}
                        placeholder="Enter your current password"
                        disabled={isRoleSelectionDisabled}
                        required
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setRoleModalUser(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isRoleSelectionDisabled || isUpdatingRole}
                      title={roleDisabledTooltip}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isUpdatingRole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>Save Role</span>
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}


      {/* CHANGE PASSWORD MODAL */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                    Change Password
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update account credentials for security
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetPasswordModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Password Updated
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  {passwordSuccess}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={resetPasswordModal}
                    className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {passwordError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {/* Current Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      required
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 8 characters)"
                      required
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter & Checklist */}
                  {newPassword.length > 0 && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Password Strength:</span>
                        <span className={`font-semibold ${newPassword.length >= 8 && (/\d/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword))
                            ? (newPassword.length >= 10 && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword)
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400')
                            : 'text-rose-500 dark:text-rose-400'
                          }`}>
                          {newPassword.length >= 8 && (/\d/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword))
                            ? (newPassword.length >= 10 && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword)
                              ? 'Strong'
                              : 'Good')
                            : 'Weak'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${newPassword.length >= 10 && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword)
                              ? 'w-full bg-emerald-500'
                              : newPassword.length >= 8 && (/\d/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword))
                                ? 'w-2/3 bg-amber-500'
                                : 'w-1/3 bg-rose-500'
                            }`}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
                        <div className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className={`w-3 h-3 ${newPassword.length >= 8 ? 'opacity-100' : 'opacity-40'}`} />
                          <span>8+ characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${/\d/.test(newPassword) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          <Check className={`w-3 h-3 ${/\d/.test(newPassword) ? 'opacity-100' : 'opacity-40'}`} />
                          <span>Contains number</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px]">
                      {newPassword === confirmPassword ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Passwords match
                        </span>
                      ) : (
                        <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Passwords do not match
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={resetPasswordModal}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmittingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL (Super Admin Only) */}
      {currentUser?.role === 'super_admin' && deleteModalUser && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                    Delete Personnel Account
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Super Admin exclusive action
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isDeletingUser && setDeleteModalUser(null)}
                disabled={isDeletingUser}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete this user account? This action will revoke their access to the Responde portal immediately.
              </p>

              {/* Target User Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center gap-3">
                {deleteModalUser.avatar_url ? (
                  <img
                    src={deleteModalUser.avatar_url}
                    alt={deleteModalUser.full_name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-sm flex items-center justify-center shrink-0">
                    {(deleteModalUser.full_name || deleteModalUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">
                      {deleteModalUser.full_name || 'Unnamed Personnel'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${deleteModalUser.role === 'admin'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                      {deleteModalUser.role === 'admin' ? 'Admin' : 'Staff'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {deleteModalUser.email}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  This is a local demonstration action. The user will be removed from your active personnel directory.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalUser(null)}
                  disabled={isDeletingUser}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isDeletingUser}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-red-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isDeletingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{isDeletingUser ? 'Deleting...' : 'Delete User'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MY ACCOUNT MODAL (Self Deletion with Password & Email OTP) */}
      {deleteSelfModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 transition-all">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl ${deleteSelfStep === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'}`}>
                  {deleteSelfStep === 'success' ? <CheckCircle2 className="w-5 h-5" /> : deleteSelfStep === 'otp' ? <Mail className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                    Delete My Account
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {deleteSelfStep === 'password' ? 'Step 1 of 2: Password Confirmation' : deleteSelfStep === 'otp' ? 'Step 2 of 2: Email OTP Verification' : 'Account Removal Complete'}
                  </p>
                </div>
              </div>
              {deleteSelfStep !== 'success' && (
                <button
                  type="button"
                  onClick={closeDeleteMyAccountModal}
                  disabled={isConfirmingDelete}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* STEP 1: PASSWORD CONFIRMATION */}
            {deleteSelfStep === 'password' && (
              <form onSubmit={handlePasswordConfirmAndRequestOtp} className="space-y-4">
                {/* Warning Card */}
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div>
                    <span className="font-semibold block mb-0.5">Permanent &amp; Irreversible Action</span>
                    This will permanently delete your account and revoke your access. To prevent accidental deletion, you must confirm your password and enter an email OTP.
                  </div>
                </div>

                {/* Account Details Card */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center gap-3">
                  {currentUser?.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.full_name || 'User'}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {(currentUser?.full_name || currentUser?.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">
                        {currentUser?.full_name || currentUser?.username || 'Personnel'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${userRole === 'super_admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' : userRole === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {userRole === 'super_admin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : 'Staff'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {currentUser?.email}
                    </p>
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Enter Your Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showDeleteSelfPassword ? 'text' : 'password'}
                      value={deleteSelfPassword}
                      onChange={e => {
                        setDeleteSelfPassword(e.target.value);
                        if (deleteSelfPasswordError) setDeleteSelfPasswordError(null);
                      }}
                      placeholder="Current account password"
                      autoFocus
                      required
                      className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${deleteSelfPasswordError ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20' : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeleteSelfPassword(!showDeleteSelfPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showDeleteSelfPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {deleteSelfPasswordError && (
                    <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {deleteSelfPasswordError}
                    </p>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={closeDeleteMyAccountModal}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRequestingOtp}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isRequestingOtp ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Email OTP</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: EMAIL OTP VERIFICATION */}
            {deleteSelfStep === 'otp' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5 leading-relaxed">
                  <Mail className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  <div>
                    A 6-digit confirmation code was sent to <strong className="font-semibold text-slate-800 dark:text-slate-100">{deleteSelfMaskedEmail}</strong>. Enter the code below to finalize deletion.
                  </div>
                </div>

                {/* OTP Digits Input Boxes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 text-center">
                    6-Digit Verification Code
                  </label>
                  <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                    {deleteSelfOtp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={el => { otpInputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                        className={`w-11 h-12 text-center text-lg font-bold font-mono bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all ${deleteSelfOtpError ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20' : 'border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'}`}
                      />
                    ))}
                  </div>

                  {deleteSelfOtpError && (
                    <p className="text-xs text-rose-500 mt-2 text-center flex items-center justify-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {deleteSelfOtpError}
                    </p>
                  )}

                  {/* Resend Link */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-3 px-1">
                    <span>Didn&apos;t receive code?</span>
                    {otpCooldown > 0 ? (
                      <span className="font-mono text-slate-400">Resend in {otpCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendDeleteOtp}
                        disabled={isRequestingOtp}
                        className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {isRequestingOtp ? 'Sending...' : 'Resend Code'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteSelfStep('password');
                      setDeleteSelfOtpError(null);
                    }}
                    disabled={isConfirmingDelete}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeDeleteMyAccountModal}
                      disabled={isConfirmingDelete}
                      className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleFinalDeleteSelf}
                      disabled={isConfirmingDelete || deleteSelfOtp.join('').length !== 6}
                      className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isConfirmingDelete ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Permanently Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS STATE */}
            {deleteSelfStep === 'success' && (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-50 dark:ring-emerald-950/20 animate-pulse">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  Account Successfully Deleted
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Your credentials and session have been cleared. Redirecting you to the sign-in page...
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing out</span>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* SIGN OUT CONFIRMATION MODAL */}
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
