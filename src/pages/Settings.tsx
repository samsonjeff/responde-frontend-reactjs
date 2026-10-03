import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../components/ThemeContent';
import { useAuth } from '../context/AuthContext';
import {
  Moon, Sun, Bell, Shield, Database, Users,
  RefreshCw, Wifi, Check, X, UserPlus, Copy,
  CheckCircle2, AlertCircle, ShieldCheck,
  Search, Lock, KeyRound, Loader2
} from 'lucide-react';
import { authService, type AuthUser, type UserRole, AuthError } from '../services/authService';

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
  const userRole = (currentUser?.role || '').toLowerCase().trim();
  const canViewUsers = userRole === 'super_admin' || userRole === 'admin';

  const [pushNotif, setPushNotif] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
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

  // Role Edit Modal
  const [roleModalUser, setRoleModalUser] = useState<AuthUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [rolePassword, setRolePassword] = useState('');
  const [roleOtp, setRoleOtp] = useState('');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

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
    setRoleOtp('');
    setRoleError(null);
    setOtpSent(false);
  };

  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setRoleError(null);
    try {
      await authService.requestOtp();
      setOtpSent(true);
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Failed to send OTP code');
    } finally {
      setIsSendingOtp(false);
    }
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
    if (selectedRole === 'super_admin' && !roleOtp) {
      setRoleError('OTP code from your email is required to promote to Super Admin.');
      return;
    }

    setIsUpdatingRole(true);
    setRoleError(null);
    try {
      await authService.updateUserRole(
        roleModalUser.user_id,
        selectedRole,
        rolePassword,
        roleOtp || undefined
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

  // Filtered Users List
  const selfUser = users.find((u) => u.user_id === currentUser?.user_id);
  const effectiveRole = (selfUser?.role || currentUser?.role || userRole || '').toLowerCase().trim();

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
    <div className="space-y-6">

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
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Two-Factor Auth</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add extra layer of account security</p>
              </div>
              <Toggle checked={twoFactor} onChange={() => setTwoFactor(!twoFactor)} />
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

          {actionSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2 text-green-700 text-xs dark:bg-green-900/30 dark:border-green-800 dark:text-green-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

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
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              u.role === 'super_admin'
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
                        className={`flex items-center gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl ${
                          isRoleSelectionDisabled
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
                        className={`flex items-center gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl ${
                          isRoleSelectionDisabled
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
                        className={`flex items-center gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl ${
                          !isRoleSelectionDisabled && currentUser?.role === 'super_admin'
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
                          <p className="text-[11px] text-slate-400">Full system access + OTP required to promote</p>
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

                  {/* OTP Code if promoting to super_admin */}
                  {selectedRole === 'super_admin' && !isRoleSelectionDisabled && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Supabase OTP Code <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={isSendingOtp}
                          className="text-[11px] text-blue-600 hover:underline font-medium"
                        >
                          {isSendingOtp ? 'Sending...' : otpSent ? 'Resend Code' : 'Send Code to Email'}
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={roleOtp}
                          onChange={(e) => setRoleOtp(e.target.value)}
                          placeholder="6-digit code"
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {otpSent && (
                        <p className="text-[11px] text-green-600 mt-1">
                          OTP code has been sent to your email. Check your inbox.
                        </p>
                      )}
                    </div>
                  )}

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

    </div>
  );
}
