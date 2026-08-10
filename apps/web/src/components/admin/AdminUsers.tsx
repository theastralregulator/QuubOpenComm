import React, { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import { useAdminSession } from '../../hooks/useAdminSession';
import {
  ShieldCheck, Search, ShieldAlert, UserX, UserCheck, ExternalLink, AlertCircle,
  CheckCircle2, Lock, ChevronLeft, ChevronRight, Eye, User, MapPin, Briefcase,
  Calendar, Shield, Layers, Activity, Smartphone, Info, X
} from 'lucide-react';
import { getInitials, getDisplayEmail, getDisplayName } from '../../lib/admin-utils';
import { Link } from 'react-router-dom';

export default function AdminUsers() {
  const { adminUser } = useAdminSession();
  const isSuperAdmin = adminUser?.role === 'super_admin';
  const isAdmin = adminUser?.role === 'admin' || isSuperAdmin;

  // Data & Pagination State
  const [users, setUsers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Moderation Modal State
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'reactivate'>('suspend');
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin User Details Drawer/Modal State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Load user list on page or search change
  useEffect(() => {
    loadUsers();
  }, [page, debouncedSearch]);

  async function loadUsers() {
    setIsLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * limit;
      const res = await dbService.adminListUsers({
        search: debouncedSearch,
        limit,
        offset
      });
      setUsers(res.users || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      console.error('Load users error:', err);
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleOpenDetails = async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingDetails(true);
    setDetailsError(null);
    setUserDetails(null);
    setShowTechnicalDetails(false);
    try {
      const details = await dbService.adminGetUserDetails(userId);
      setUserDetails(details);
    } catch (err: any) {
      console.error('Fetch user details error:', err);
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('not found') || msg.includes('p0002')) {
        setDetailsError('User account could not be found.');
      } else {
        setDetailsError('Unable to load user details. Please try again.');
      }
    } finally {
      setLoadingDetails(false);
    }
  };

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
      if (selectedUserId === targetUser.id) {
        await handleOpenDetails(targetUser.id);
      }
    } catch (err: any) {
      console.error('User moderation error:', err);
      setError(err.message || `Failed to ${actionType} user.`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="space-y-6 text-left">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            User Account Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            View permanent OpenComm IDs, inspect account states, and manage status moderation
          </p>
        </div>
      </div>

      {!isAdmin && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2 font-bold">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Read-Only Access: Support role accounts may lookup user accounts but cannot modify status.</span>
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

      {/* Main Table Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-2xs">
        {/* Search Bar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by OpenComm ID, Name, Email, or UUID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white"
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
            Showing {users.length > 0 ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, totalCount)} of {totalCount} users
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="px-5 py-3">OpenComm ID</th>
                <th className="px-5 py-3">User</th>
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
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading user accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No user accounts found.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const adminRole = user.admin_role;
                  const status = user.account_status || 'active';
                  const isSuspended = status === 'suspended';

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetails(user.id)}
                    >
                      {/* OpenComm ID */}
                      <td className="px-5 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {user.opencomm_id || 'USER-000000'}
                      </td>

                      {/* User (Name & Email) */}
                      <td className="px-5 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold shrink-0">
                            {getInitials(user.full_name, user.email)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {getDisplayName(user)}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {getDisplayEmail(user.email)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Account Type */}
                      <td className="px-5 py-3 capitalize font-semibold text-slate-700 dark:text-slate-300">
                        {user.profile_type || 'Basic'} Account
                      </td>

                      {/* Admin Role */}
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

                      {/* Status */}
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : status === 'suspended'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}>
                          {status}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="px-5 py-3 text-slate-400 font-mono text-[10px]">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(user.id)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="View Identity Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <Link
                            to={`/profile/${user.username || user.id}`}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="View Public Profile"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          {isAdmin && user.id !== adminUser?.id && (
                            !isSuspended ? (
                              <button
                                type="button"
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
                                type="button"
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

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-950/50">
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            Page <strong className="text-slate-900 dark:text-white">{page}</strong> of <strong className="text-slate-900 dark:text-white">{totalPages}</strong>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer flex items-center space-x-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ADMIN USER DETAILS MODAL */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs text-left animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-2xl w-full space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    User Identity & Account Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Comprehensive admin identity summary
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                Loading detailed account identity...
              </div>
            ) : detailsError ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300">
                {detailsError}
              </div>
            ) : userDetails ? (
              <div className="space-y-5 text-xs">

                {/* Section A: Account Identity */}
                <div className="p-4 bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/60 pb-2">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <Shield className="w-4 h-4 text-indigo-500" />
                      <span>Account Identity</span>
                    </span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200/60 dark:border-indigo-900/60">
                      {userDetails.account_identity?.opencomm_id}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Full Name</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{userDetails.account_identity?.full_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Email Address</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{userDetails.account_identity?.email || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Phone Number</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{userDetails.account_identity?.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Account Type / Status</span>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">{userDetails.account_identity?.profile_type}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          userDetails.account_identity?.account_status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}>
                          {userDetails.account_identity?.account_status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Member Since</span>
                      <span className="text-slate-700 dark:text-slate-300">{new Date(userDetails.account_identity?.created_at).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Preferred Language</span>
                      <span className="text-slate-700 dark:text-slate-300">{userDetails.account_identity?.preferred_language || 'English'}</span>
                    </div>
                  </div>

                  {/* Verification Badges */}
                  <div className="flex items-center space-x-3 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                      userDetails.account_identity?.email_verified_for_actions
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Email Verified</span>
                    </span>

                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                      userDetails.account_identity?.phone_verified_for_actions
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Phone Verified</span>
                    </span>
                  </div>
                </div>

                {/* Section B: Technical Identity (Collapsible) */}
                <div className="p-4 bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="w-full flex items-center justify-between font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <span className="flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-purple-500" />
                      <span>Technical Identity Map</span>
                    </span>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                      {showTechnicalDetails ? 'Hide UUIDs' : 'Show Technical UUIDs'}
                    </span>
                  </button>

                  {showTechnicalDetails && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60 font-mono text-[11px]">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-400">Auth User ID:</span>
                        <span className="text-slate-800 dark:text-slate-200 select-all">{userDetails.technical_identity?.auth_user_id}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-400">Profiles Table ID:</span>
                        <span className="text-slate-800 dark:text-slate-200 select-all">{userDetails.technical_identity?.profile_id}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-400">Worker Profile ID:</span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {userDetails.technical_identity?.worker_profile_id || 'None (Basic Account)'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-400">Directory Sync Status:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {userDetails.technical_identity?.has_profile_directory ? 'Synced to Directory' : 'Not Synced'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section C: Location Data */}
                <div className="p-4 bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl space-y-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5 mb-2">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    <span>Location Summary</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">City</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{userDetails.location?.city || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">District</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{userDetails.location?.district || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">State</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{userDetails.location?.state || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Country</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{userDetails.location?.country || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Section D: Worker Profile Summary (if exists) */}
                {userDetails.worker_summary && (
                  <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl space-y-2">
                    <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center space-x-1.5 mb-2">
                      <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Worker Profile Overview</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-indigo-900/60 dark:text-indigo-300/60 text-[10px] uppercase font-bold tracking-wider block">Profession</span>
                        <span className="font-bold text-indigo-950 dark:text-indigo-100">{userDetails.worker_summary.profession || '—'}</span>
                      </div>
                      <div>
                        <span className="text-indigo-900/60 dark:text-indigo-300/60 text-[10px] uppercase font-bold tracking-wider block">Availability</span>
                        <span className="font-semibold text-indigo-950 dark:text-indigo-100">{userDetails.worker_summary.availability || 'Available'}</span>
                      </div>
                      <div>
                        <span className="text-indigo-900/60 dark:text-indigo-300/60 text-[10px] uppercase font-bold tracking-wider block">Hourly Rate</span>
                        <span className="font-bold text-indigo-950 dark:text-indigo-100">
                          {userDetails.worker_summary.hourly_rate ? `₹${userDetails.worker_summary.hourly_rate}/hr` : '—'}
                        </span>
                      </div>
                    </div>
                    {userDetails.worker_summary.skills?.length > 0 && (
                      <div className="pt-2">
                        <span className="text-indigo-900/60 dark:text-indigo-300/60 text-[10px] uppercase font-bold tracking-wider block mb-1">Skills</span>
                        <div className="flex flex-wrap gap-1">
                          {userDetails.worker_summary.skills.map((skill: string, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-indigo-900/60 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Section E: Login Activity Summary */}
                {userDetails.recent_logins?.length > 0 && (
                  <div className="p-4 bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl space-y-2">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5 mb-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <span>Security & Recent Login Activity</span>
                    </span>
                    <div className="space-y-1.5 divide-y divide-slate-200/60 dark:divide-zinc-800/60">
                      {userDetails.recent_logins.slice(0, 5).map((log: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center pt-1.5 text-[11px]">
                          <div className="flex items-center space-x-2">
                            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {log.device_type || 'Desktop'} ({log.os || 'OS'}, {log.browser || 'Browser'})
                            </span>
                          </div>
                          <span className="text-slate-400 font-mono">
                            {new Date(log.logged_in_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

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
              Target: <strong className="text-slate-900 dark:text-white">{targetUser.full_name || targetUser.email}</strong> ({targetUser.opencomm_id || 'ID'})
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
