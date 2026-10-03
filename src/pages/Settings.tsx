import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../components/ThemeContent';
import { useAuth } from '../context/AuthContext';
import {
  Moon, Sun, Bell, Shield, Database, Users,
  RefreshCw, Wifi, Check, X, UserPlus, Copy,
  CheckCircle2, AlertCircle, Clock, ShieldCheck,
  Search, Lock, KeyRound, Loader2, UserCheck
} from 'lucide-react';
import { authService, type AuthUser, type UserRole, AuthError } from '../services/authService';
import { EmailVerificationModal } from '../components/EmailVerificationModal';

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
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
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
      active
        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
        : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
    }`}>
      <Wifi className="w-3 h-3" />
      {active ? 'Connected' : 'Disconnected'}
    </span>
  );
}

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { user: currentUser } = useAuth();
  const canManageUsers = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  const [pushNotif, setPushNotif] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [botConnected] = useState(true);
  const [scraperConnected] = useState(true);

  // -- User Management State --
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'inactive'>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<'staff' | 'admin'>('staff');
  const [generatedInvite, setGeneratedInvite] = useState<{ invite_url: string; expires_in: string } | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Role Edit Modal (Enforces Email OTP for all role changes)
  const [roleModalUser, setRoleModalUser] = useState<AuthUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [rolePassword, setRolePassword] = useState('');
  const [roleOtp, setRoleOtp] = useState('');
  const [roleChallengeToken, setRoleChallengeToken] = useState<string>('');
  const [roleMaskedEmail, setRoleMaskedEmail] = useState<string>('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Email Verification Test Modal (Step 7 in User Settings)
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [testChallengeToken, setTestChallengeToken] = useState<string>('');
  const [testMaskedEmail, setTestMaskedEmail] = useState<string>('');

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  // Cooldown countdown for role OTP resend
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const fetchUsers = useCallback(async () => {
    if (!canManageUsers) return;
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
  }, [canManageUsers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showSuccessFeedback = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // Accept / Approve Pending User or Toggle Active
  const handleToggleStatus = async (targetUser: AuthUser, newStatus: boolean) => {
    setStatusUpdatingId(targetUser.user_id);
    try {
      await authService.updateUserStatus(targetUser.user_id, newStatus);
      showSuccessFeedback(
        newStatus
          ? `User "${targetUser.full_name || targetUser.username}" was accepted and activated.`
          : `User "${targetUser.full_name || targetUser.username}" was deactivated.`
      );
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user status');
    } finally {
      setStatusUpdatingId(null);
    }
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

  // Role Edit Handlers (MANDATORY Email Verification for ALL Role Changes)
  const openRoleModal = (u: AuthUser) => {
    setRoleModalUser(u);
    setSelectedRole(u.role);
    setRolePassword('');
    setRoleOtp('');
    setRoleChallengeToken('');
    setRoleMaskedEmail('');
    setRoleError(null);
    setOtpSent(false);
    setOtpCooldown(0);
  };

  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setRoleError(null);
    try {
      const res = await authService.requestOtp();
      setOtpSent(true);
      if (res.challenge_token) {
        setRoleChallengeToken(res.challenge_token);
      }
      setRoleMaskedEmail(res.masked_email || currentUser?.email || '');
      setOtpCooldown(60);
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Failed to send OTP code');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser) return;
    if (!rolePassword) {
      setRoleError('Please confirm your current administrator password.');
      return;
    }
    if (!roleOtp.trim()) {
      setRoleError('Email verification code is required. Click "Send Code to Email" and enter the 6-digit code.');
      return;
    }

    setIsUpdatingRole(true);
    setRoleError(null);
    try {
      await authService.updateUserRole(
        roleModalUser.user_id,
        selectedRole,
        rolePassword,
        roleOtp.trim(),
        roleChallengeToken || undefined
      );
      showSuccessFeedback(`Role for ${roleModalUser.full_name || roleModalUser.username} updated to ${selectedRole}.`);
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

  // Email Delivery Test Handlers (Step 7 in User Settings)
  const handleStartEmailTest = async () => {
    try {
      const res = await authService.sendVerificationCode('settings_change');
      setTestChallengeToken(res.challenge_token);
      setTestMaskedEmail(res.masked_email || currentUser?.email || '');
      setVerifyModalOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send verification code.');
    }
  };

  const handleVerifyTestCode = async (code: string) => {
    await authService.verifyCode(testChallengeToken, code, 'settings_change');
    showSuccessFeedback('Brevo SMTP email verification succeeded! Test completed successfully.');
    setVerifyModalOpen(false);
  };

  const handleResendTestCode = async () => {
    const res = await authService.sendVerificationCode('settings_change');
    setTestChallengeToken(res.challenge_token);
    setTestMaskedEmail(res.masked_email || currentUser?.email || '');
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q);

    if (statusFilter === 'pending') return matchesSearch && !u.is_active;
    if (statusFilter === 'active') return matchesSearch && u.is_active;
    return matchesSearch;
  });

  const pendingCount = users.filter((u) => !u.is_active).length;

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {actionSuccess && (
        <div className="fixed top-5 right-5 z-50 bg-green-600 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* SYSTEM CONFIGURATION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card icon={Moon} title="Appearance">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isDark
                  ? <Moon className="w-4 h-4 text-blue-400" />
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Email Digest</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Periodic summary reports via email</p>
              </div>
              <Toggle checked={emailDigest} onChange={() => setEmailDigest(!emailDigest)} />
            </div>
          </div>
        </Card>

        <Card icon={Shield} title="Security & Email Authentication (Step 7)">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Two-Factor Authentication (2FA)</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">6-digit email verification via Brevo SMTP on manual sign-ins and role changes</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Active
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Brevo SMTP Delivery Test</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify real-time code receipt for: <strong className="font-semibold">{currentUser?.email}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartEmailTest}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
              >
                Test Code Delivery
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Active Session Lifetime</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Multi-device persistent session duration</p>
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                7 Days
              </span>
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

      {/* USER MANAGEMENT SECTION (Super Admin & Admin Only) */}
      {canManageUsers && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                  User Management &amp; Access Control
                </h3>
                {pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 animate-pulse">
                    <Clock className="w-3 h-3" />
                    {pendingCount} Pending Approval
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Manage command center personnel, invite new team members, and authorize role modifications with 2FA email verification.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                title="Refresh user list"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeneratedInvite(null);
                  setInviteModalOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-blue-600/20 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite New User</span>
              </button>
            </div>
          </div>

          {userError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{userError}</span>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email, or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                All ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Active ({users.filter((u) => u.is_active).length})
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/60">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Last Login</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                      Loading system users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isPending = !u.is_active;
                    const isSelf = u.user_id === currentUser?.user_id;

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
                                {u.full_name || u.username} {isSelf && '(You)'}
                              </div>
                              <div className="text-slate-400 text-xs">
                                {u.email} &bull; <span className="font-mono">@{u.username}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'super_admin'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200'
                              : u.role === 'admin'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200'
                          }`}>
                            {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Staff'}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300">
                              <Clock className="w-3 h-3" />
                              Pending Approval
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200">
                              <Check className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 hidden md:table-cell text-slate-500 dark:text-slate-400 text-xs">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Never'}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <button
                                type="button"
                                disabled={statusUpdatingId === u.user_id}
                                onClick={() => handleToggleStatus(u, true)}
                                className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                {statusUpdatingId === u.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                                <span>Accept</span>
                              </button>
                            )}

                            {/* Edit Role Button */}
                            {(!isSelf || currentUser?.role === 'super_admin') && (
                              <button
                                type="button"
                                onClick={() => openRoleModal(u)}
                                className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 font-medium transition-colors"
                              >
                                Edit Role
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
        </div>
      )}

      {/* INVITE NEW USER MODAL */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
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
              Generate a secure 1-hour invitation link to send directly to new command center personnel.
              Users who register via an invite link are pre-approved.
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
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-sm cursor-pointer"
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
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT ROLE MODAL (Mandatory 2FA Code Email Verification For All Roles) */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  Change User Role (2FA Protected)
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
              Modifying role for: <strong className="text-slate-800 dark:text-slate-100">{roleModalUser.full_name || roleModalUser.username}</strong> ({roleModalUser.email})
            </p>

            {roleError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{roleError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select New Role
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="roleOption"
                      value="staff"
                      checked={selectedRole === 'staff'}
                      onChange={() => setSelectedRole('staff')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Staff</p>
                      <p className="text-[11px] text-slate-400">View incidents, geospatial analytics, and feeds</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="roleOption"
                      value="admin"
                      checked={selectedRole === 'admin'}
                      onChange={() => setSelectedRole('admin')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Admin</p>
                      <p className="text-[11px] text-slate-400">Manage data, accept users, and manage staff</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl ${
                      currentUser?.role === 'super_admin'
                        ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
                        : 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="roleOption"
                      value="super_admin"
                      disabled={currentUser?.role !== 'super_admin'}
                      checked={selectedRole === 'super_admin'}
                      onChange={() => setSelectedRole('super_admin')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Super Admin {currentUser?.role !== 'super_admin' && '(Super Admin only)'}
                      </p>
                      <p className="text-[11px] text-slate-400">Full system access and master authorization</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Password confirmation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Your Administrator Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="password"
                    value={rolePassword}
                    onChange={(e) => setRolePassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 6-digit Email Verification OTP (MANDATORY FOR ALL ROLE CHANGES) */}
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                    Email Verification Code <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp || otpCooldown > 0}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSendingOtp ? 'animate-spin' : ''}`} />
                    {isSendingOtp ? 'Sending...' : otpCooldown > 0 ? `Resend (${otpCooldown}s)` : otpSent ? 'Resend Code' : 'Send Code to Email'}
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={roleOtp}
                    onChange={(e) => setRoleOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    required
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {otpSent && (
                  <p className="text-[11px] text-green-700 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Code sent to {roleMaskedEmail || currentUser?.email}. Valid for 10 minutes.</span>
                  </p>
                )}
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
                  disabled={isUpdatingRole}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingRole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMAIL VERIFICATION TEST MODAL (Step 7 in User Settings) */}
      <EmailVerificationModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        onVerify={handleVerifyTestCode}
        onResend={handleResendTestCode}
        title="Brevo SMTP Email Verification Test"
        subtitle="We sent a real-time 6-digit code to verify your email delivery configuration."
        maskedEmail={testMaskedEmail}
        actionButtonText="Confirm Delivery"
      />
    </div>
  );
}
