import React, { useState, useEffect } from 'react';
import { supabase, dbService } from '../../lib/supabase';
import { useAdminSession } from '../../hooks/useAdminSession';
import { ShieldCheck, Search, ShieldAlert, UserX, UserCheck, ExternalLink, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { getInitials, getDisplayEmail, getDisplayName } from '../../lib/admin-utils';
import { Link } from 'react-router-dom';

export default function AdminUsers() {
  const { adminUser } = useAdminSession();
  const isSuperAdmin = adminUser?.role === 'super_admin';
  const isAdmin = adminUser?.role === 'admin' || isSuperAdmin;

  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Moderation Modal State
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'reactivate'>('suspend');
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    if (!supabase) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (pErr) throw pErr;

      const { data: admins } = await supabase
        .from('admin_members')
        .select('id, role, is_active');

      const mergedUsers = (profiles || []).map(p => {
        const adminData = admins?.find(a => a.id === p.id);
        return {
          ...p,
          admin_member: adminData || null
        };
      });

      setUsers(mergedUsers);
    } catch (err: any) {
      console.error('Load users error:', err);
      setError(err.message || 'Failed to load user profiles.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !reasonInput.trim()) return;

    if (targetUser.id === adminUser?.id) {
      setError('Self-suspension is strictly prohibited.');
      setTargetUser(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (actionType === 'suspend') {
        await dbService.adminSuspendUser(targetUser.id, reasonInput.trim());
        setToastMsg(`User ${targetUser.full_name || targetUser.email} has been suspended.`);
      } else {
        await dbService.adminReactivateUser(targetUser.id, reasonInput.trim());
        setToastMsg(`User ${targetUser.full_name || targetUser.email} has been reactivated.`);
      }
      setTargetUser(null);
      setReasonInput('');
      await loadUsers();
    } catch (err: any) {
      console.error('User moderation error:', err);
      setError(err.message || `Failed to ${actionType} user.`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.id || '').includes(search)
  );

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">User Account Management</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">View registered profiles, inspect roles, and execute hardened status moderation</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2 font-bold">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Read-Only Access: Support role accounts may lookup user profiles but cannot modify user status.</span>
        </div>
      )}

      {toastMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="px-5 py-3">User Profile</th>
                <th className="px-5 py-3">Account Type</th>
                <th className="px-5 py-3">Admin Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Joined Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">Loading user accounts...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">No user accounts found.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const adminRole = user.admin_member?.role;
                  const isActive = user.is_active !== false;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold shrink-0">
                            {getInitials(user.full_name, user.email)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{getDisplayName(user)}</p>
                            <p className="text-[11px] text-slate-400">{getDisplayEmail(user.email)}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3 capitalize font-semibold text-slate-700 dark:text-slate-300">
                        {user.profile_type || 'Basic'} Member
                      </td>

                      <td className="px-5 py-3">
                        {adminRole ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{adminRole.replace('_', ' ')}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-mono">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}>
                          {isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-slate-400 font-mono text-[10px]">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/profile/${user.id}`}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="View Public Profile"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          {isAdmin && user.id !== adminUser?.id && (
                            isActive ? (
                              <button
                                onClick={() => {
                                  setTargetUser(user);
                                  setActionType('suspend');
                                  setReasonInput('');
                                }}
                                className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                                title="Suspend User Account"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setTargetUser(user);
                                  setActionType('reactivate');
                                  setReasonInput('');
                                }}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                                title="Reactivate Account"
                              >
                                <UserCheck className="w-4 h-4" />
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

      {/* Moderation Modal */}
      {targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              {actionType === 'suspend' ? (
                <UserX className="w-4 h-4 text-rose-500" />
              ) : (
                <UserCheck className="w-4 h-4 text-emerald-500" />
              )}
              <span>{actionType === 'suspend' ? 'Suspend Account' : 'Reactivate Account'}</span>
            </h3>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Target: <strong className="text-slate-900 dark:text-white">{targetUser.full_name || targetUser.email}</strong>
            </p>

            <form onSubmit={handleActionSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mandatory Audit Reason</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder={`Explain why this account is being ${actionType}ed...`}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetUser(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reasonInput.trim()}
                  className={`px-5 py-2 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 ${
                    actionType === 'suspend' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {submitting ? 'Executing...' : `Confirm ${actionType === 'suspend' ? 'Suspension' : 'Reactivation'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
