import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Eye, EyeOff, Lock, Palette, Bell, LifeBuoy, ShieldCheck,
  ChevronRight, Sun, Moon, Monitor, Save, Loader2, CheckCircle2,
  AlertCircle, LogOut, Clock, Send, ArrowLeft, RefreshCw, X,
  Laptop, Smartphone, Tablet, ExternalLink, ShieldAlert, Copy
} from 'lucide-react';
import { supabase, createTemporaryAuthClient, dbService, SupportTicket, LocalProfile } from '../../lib/supabase';
import { validatePassword } from '../../lib/passwordValidation';
import { notificationService, NotificationPreferences } from '../../lib/notificationService';
import { UserSettings, UserLoginActivity, DeactivationStatusResponse } from '../../types';

/* ------------------------------------------------------------------ */
/* Helpers / sub-components                                             */
/* ------------------------------------------------------------------ */

function maskIpAddress(ip?: string | null): string {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return 'Hidden IP';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.xxx.xxx.${parts[3]}`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 2) return `${parts[0]}:xxxx:xxxx:${parts[parts.length - 1]}`;
  }
  return 'Protected IP';
}

function formatLocation(activity: UserLoginActivity): string {
  const parts = [activity.city, activity.region, activity.country].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return 'Location unavailable';
}

function formatDeviceTitle(activity: UserLoginActivity): string {
  const browser = activity.browser || 'Browser';
  const os = activity.os || 'Device';
  return `${browser} on ${os}`;
}

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB]/15 to-[#7C3AED]/15 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#2563EB] dark:text-[#60A5FA]" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function ToggleRow({
  label, sublabel, checked, onChange, disabled = false, disabledLabel
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        {sublabel && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sublabel}</p>}
        {disabled && disabledLabel && (
          <span className="inline-block mt-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {disabledLabel}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={disabled ? undefined : onChange}
        disabled={disabled}
        aria-checked={checked}
        role="switch"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
        } ${checked ? 'bg-gradient-to-r from-[#2563EB] to-[#7C3AED]' : 'bg-slate-200 dark:bg-slate-700'}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function SelectRow({ label, sublabel, value, onChange, options }: {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        {sublabel && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs rounded-xl border border-slate-200 dark:border-[#273449] bg-slate-50 dark:bg-[#0d1524] text-slate-800 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
      Coming later
    </span>
  );
}

function SaveButton({
  saving, saved, onClick, label = 'Save Changes'
}: {
  saving: boolean;
  saved: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="mt-4 flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white text-sm font-semibold shadow hover:opacity-95 transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
      {saving ? 'Saving…' : saved ? 'Saved!' : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                       */
/* ------------------------------------------------------------------ */

type ActiveSection =
  | 'account' | 'visibility' | 'privacy' | 'appearance'
  | 'notifications' | 'support' | 'security';

const NAV_ITEMS: { id: ActiveSection; label: string; icon: React.ElementType }[] = [
  { id: 'account',       label: 'Account',              icon: User },
  { id: 'visibility',    label: 'Profile & Visibility',  icon: Eye },
  { id: 'privacy',       label: 'Privacy',               icon: Lock },
  { id: 'appearance',    label: 'Appearance',            icon: Palette },
  { id: 'notifications', label: 'Notifications',         icon: Bell },
  { id: 'support',       label: 'Support',               icon: LifeBuoy },
  { id: 'security',      label: 'Security',              icon: ShieldCheck },
];

const NAV_DESCRIPTIONS: Record<ActiveSection, string> = {
  account:       'Name, OpenComm ID, email, account type',
  visibility:    'Profile visibility, online status, location',
  privacy:       'Messages, hire requests, search indexing',
  appearance:    'System, light, or dark theme',
  notifications: 'In-app, email, and notification types',
  support:       'Submit a ticket or view ticket history',
  security:      'Email, auth provider, sign out',
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveSection>('account');
  // Mobile-only: null = show list, string = show detail
  const [mobileSection, setMobileSection] = useState<ActiveSection | null>(null);

  // ── Data ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [copiedOpenCommId, setCopiedOpenCommId] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [authMeta, setAuthMeta] = useState<{ email: string; provider: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Local edits ────────────────────────────────────────────────────
  const [settingsEdit, setSettingsEdit] = useState<Partial<UserSettings>>({});
  const [notifEdit, setNotifEdit] = useState<Partial<NotificationPreferences>>({});

  // ── UI state ───────────────────────────────────────────────────────
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [savedNotif, setSavedNotif] = useState(false);

  // ── Support form ───────────────────────────────────────────────────
  const [ticketForm, setTicketForm] = useState({
    subject: '', category: 'general', description: ''
  });
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // ── Login Activity & Deactivation State ─────────────────────────────
  const [loginActivities, setLoginActivities] = useState<UserLoginActivity[]>([]);
  const [loadingLogins, setLoadingLogins] = useState(false);
  const [loginActivityError, setLoginActivityError] = useState<string | null>(null);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  const [deactivationModalOpen, setDeactivationModalOpen] = useState(false);
  const [deactivationStep, setDeactivationStep] = useState<'checking' | 'blocked' | 'confirm'>('checking');
  const [deactivationStatus, setDeactivationStatus] = useState<DeactivationStatusResponse | null>(null);
  const [deactivateConfirmInput, setDeactivateConfirmInput] = useState('');
  const [deactivatingAccount, setDeactivatingAccount] = useState(false);
  const [deactivationError, setDeactivationError] = useState<string | null>(null);

  // ── Change Password Modal State ─────────────────────────────────────
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [submittingChangePass, setSubmittingChangePass] = useState(false);
  const [changePassError, setChangePassError] = useState<string | null>(null);
  const [changePassSuccess, setChangePassSuccess] = useState<string | null>(null);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError(null);
    setChangePassSuccess(null);

    const isEmailProvider = !authMeta?.provider || authMeta.provider === 'email';
    if (!isEmailProvider) {
      setChangePassError('Password change is unavailable for this sign-in method.');
      return;
    }

    if (!currentPassword) {
      setChangePassError('Current password is required.');
      return;
    }

    const passVal = validatePassword(newPassword);
    if (!passVal.isValid) {
      setChangePassError(passVal.error);
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePassError('New passwords do not match.');
      return;
    }

    setSubmittingChangePass(true);
    try {
      // 1. Get current user email
      let userEmail = authMeta?.email || profile?.email || '';
      if (!userEmail && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        userEmail = user?.email || '';
      }

      if (!userEmail) {
        throw new Error('User email address could not be verified.');
      }

      // 2. Verify current password using isolated temporary client
      const tempClient = createTemporaryAuthClient();
      if (!tempClient) {
        throw new Error('Could not initialize verification client.');
      }

      const { data: verifyData, error: verifyErr } = await tempClient.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (verifyErr || !verifyData?.user) {
        setChangePassError('Current password is incorrect.');
        setSubmittingChangePass(false);
        return;
      }

      // 3. Update password on main authenticated client
      if (!supabase) {
        throw new Error('Supabase client unavailable.');
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        if (updateErr.message?.toLowerCase().includes('same') || updateErr.message?.toLowerCase().includes('previous')) {
          setChangePassError('New password cannot be the same as your current password.');
        } else {
          setChangePassError(updateErr.message);
        }
        setSubmittingChangePass(false);
        return;
      }

      // 4. Success flow
      setChangePassSuccess('Password changed successfully! Redirecting to Sign In...');
      setSubmittingChangePass(false);

      // Auto sign-out and redirect to /login after 2 seconds
      setTimeout(async () => {
        try {
          if (supabase) await supabase.auth.signOut();
        } catch (_) {}
        localStorage.clear();
        window.location.href = '/login';
      }, 2000);

    } catch (err: any) {
      console.error('Failed to change password:', err);
      setChangePassError(err?.message || 'Failed to change password. Please try again.');
      setSubmittingChangePass(false);
    }
  };

  const fetchLogins = useCallback(async () => {
    setLoadingLogins(true);
    setLoginActivityError(null);
    try {
      const logs = await dbService.getLoginActivity();
      setLoginActivities(logs);
    } catch (err: any) {
      console.error('Failed to load login activity:', err);
      setLoginActivityError(err?.message || 'Failed to load login activity history.');
    } finally {
      setLoadingLogins(false);
    }
  }, []);

  useEffect(() => {
    const isSecurityVisible = active === 'security' || mobileSection === 'security';
    if (isSecurityVisible) {
      fetchLogins();
    }
  }, [active, mobileSection, fetchLogins]);

  const handleSignOutOthers = async () => {
    setSigningOutOthers(true);
    try {
      if (supabase) {
        await supabase.auth.signOut({ scope: 'others' });
      }
      fetchLogins();
    } catch (err: any) {
      console.error('Sign out other sessions error:', err);
    } finally {
      setSigningOutOthers(false);
    }
  };

  const handleStartDeactivationFlow = async () => {
    setDeactivationModalOpen(true);
    setDeactivationStep('checking');
    setDeactivateConfirmInput('');
    setDeactivationError(null);
    try {
      const statusRes = await dbService.getAccountDeactivationStatus();
      setDeactivationStatus(statusRes);
      if (!statusRes.can_deactivate) {
        setDeactivationStep('blocked');
      } else {
        setDeactivationStep('confirm');
      }
    } catch (err: any) {
      console.error('Deactivation check failed:', err);
      setDeactivationError(err?.message || 'Failed to check deactivation status.');
      setDeactivationStep('confirm');
    }
  };

  const handleConfirmDeactivation = async () => {
    if (deactivateConfirmInput.trim().toUpperCase() !== 'DEACTIVATE') return;
    setDeactivatingAccount(true);
    setDeactivationError(null);
    try {
      await dbService.deactivateMyAccount();
      setDeactivationModalOpen(false);
      handleLogout();
    } catch (err: any) {
      console.error('Failed to deactivate account:', err);
      setDeactivationError(err?.message || 'Failed to deactivate account. Please try again.');
    } finally {
      setDeactivatingAccount(false);
    }
  };

  // ── Fetch all data ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setProfileError(null);
    try {
      const [profileData, settingsData, notifData, ticketsData] = await Promise.allSettled([
        (async () => {
          if (supabase) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              setAuthMeta({
                email: user.email || '',
                provider: user.app_metadata?.provider || 'email'
              });
              return dbService.getProfile(user.id);
            }
          }
          const localId = localStorage.getItem('opencomm_user_id') || '';
          if (localId) return dbService.getProfile(localId);
          return null;
        })(),
        dbService.getMyUserSettings(),
        notificationService.getPreferences(),
        dbService.getMySupportTickets(),
      ]);

      if (profileData.status === 'fulfilled' && profileData.value) {
        setProfile(profileData.value);
      } else if (profileData.status === 'rejected' || !profileData.value) {
        setProfileError("We couldn't load your account details. Please retry.");
      }

      if (settingsData.status === 'fulfilled' && settingsData.value) {
        setSettings(settingsData.value);
        setSettingsEdit(settingsData.value);
      }
      if (notifData.status === 'fulfilled' && notifData.value) {
        setNotifPrefs(notifData.value);
        setNotifEdit(notifData.value);
      }
      if (ticketsData.status === 'fulfilled') setTickets(ticketsData.value);
    } catch (err) {
      console.error('SettingsPage load error:', err);
      setProfileError("We couldn't load your account details. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Settings save ──────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSavedSettings(false);
    try {
      await dbService.updateMyUserSettings(settingsEdit);
      // Apply theme immediately
      if (settingsEdit.themePreference) {
        localStorage.setItem('opencomm_user_theme', settingsEdit.themePreference);
        const root = document.documentElement;
        if (settingsEdit.themePreference === 'dark') root.classList.add('dark');
        else if (settingsEdit.themePreference === 'light') root.classList.remove('dark');
        else {
          if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
          else root.classList.remove('dark');
        }
      }
      setSavedSettings(true);
      setTimeout(() => setSavedSettings(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Notification save ──────────────────────────────────────────────
  const handleSaveNotif = async () => {
    setSavingNotif(true);
    setSavedNotif(false);
    try {
      const merged = { ...(notifPrefs || {}), ...notifEdit } as NotificationPreferences;
      await notificationService.updatePreferences(merged);
      setSavedNotif(true);
      setTimeout(() => setSavedNotif(false), 2500);
    } catch (err) {
      console.error('Failed to save notifications:', err);
    } finally {
      setSavingNotif(false);
    }
  };

  // ── Support ticket submit ──────────────────────────────────────────
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      setTicketError('Please fill in subject and message.');
      return;
    }
    setSubmittingTicket(true);
    setTicketError(null);
    setTicketSuccess(null);
    try {
      await dbService.createSupportTicket(ticketForm);
      setTicketSuccess('Ticket submitted! We\'ll get back to you soon.');
      setTicketForm({ subject: '', category: 'general', description: '' });
      // Refresh tickets list
      const refreshed = await dbService.getMySupportTickets();
      setTickets(refreshed);
      setTimeout(() => setTicketSuccess(null), 5000);
    } catch (err: any) {
      setTicketError(err?.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      if (supabase) await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/';
    } catch (err) {
      window.location.href = '/';
    }
  };

  // ── Helper to update settingsEdit ──────────────────────────────────
  const setSetting = (key: keyof UserSettings, val: any) =>
    setSettingsEdit(prev => ({ ...prev, [key]: val }));

  const setNotif = (key: keyof NotificationPreferences, val: any) =>
    setNotifEdit(prev => ({ ...prev, [key]: val }));

  /* ── Skeleton loader ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading settings…</p>
        </div>
      </div>
    );
  }

  /* ── Sections ────────────────────────────────────────────────────── */

  const currentTheme = settingsEdit.themePreference || 'system';

  const handleCopyOpenCommId = (idString: string) => {
    if (!idString) return;
    navigator.clipboard.writeText(idString);
    setCopiedOpenCommId(true);
    setTimeout(() => setCopiedOpenCommId(false), 2000);
  };

  const renderAccount = () => {
    const hasOpenCommId = Boolean(profile?.opencomm_id);
    const openCommIdValue = profile?.opencomm_id || 'Not assigned yet';
    return (
      <div>
        <SectionHeader icon={User} title="Account" description="Your account details and identity" />
        {profileError && (
          <div className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{profileError}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchAll()}
              className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}
        <Card>
          <div className="space-y-0">
            {/* Full Name */}
            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Full Name</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{profile?.full_name || '—'}</span>
            </div>

            {/* OpenComm ID */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 gap-1">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">OpenComm ID</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Your permanent OpenComm account identifier.</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0 pt-1 sm:pt-0">
                <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                  {openCommIdValue}
                </span>
                {hasOpenCommId && (
                  <button
                    type="button"
                    onClick={() => handleCopyOpenCommId(openCommIdValue)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Copy OpenComm ID"
                  >
                    {copiedOpenCommId ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{profile?.email || authMeta?.email || '—'}</span>
            </div>

            {/* Account Type */}
            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Account Type</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {profile?.profile_type
                  ? profile.profile_type.charAt(0).toUpperCase() + profile.profile_type.slice(1)
                  : '—'}
              </span>
            </div>

            {/* Member Since */}
            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Member Since</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
                  : '—'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl border border-[#2563EB]/40 text-[#2563EB] dark:text-[#60A5FA] text-sm font-semibold hover:bg-[#2563EB]/5 transition-all cursor-pointer"
          >
            <User className="w-4 h-4" />
            Edit Profile
            <ChevronRight className="w-4 h-4" />
          </button>
        </Card>
      </div>
    );
  };

  const renderVisibility = () => (
    <div>
      <SectionHeader icon={Eye} title="Profile & Visibility" description="Control who can see you and your profile" />
      <Card>
        <SelectRow
          label="Profile Visibility"
          sublabel="Who can view your full profile"
          value={settingsEdit.profileVisibility || 'public'}
          onChange={v => setSetting('profileVisibility', v)}
          options={[
            { value: 'public', label: 'Everyone (Public)' },
            { value: 'registered', label: 'Registered users only' },
            { value: 'private', label: 'Private (hidden)' },
          ]}
        />
        <ToggleRow
          label="Show Online Status"
          sublabel="Let others see when you're active"
          checked={settingsEdit.showOnlineStatus ?? true}
          onChange={() => setSetting('showOnlineStatus', !(settingsEdit.showOnlineStatus ?? true))}
        />
        <ToggleRow
          label="Show Exact Location"
          sublabel="Display city/state on your public profile"
          checked={settingsEdit.showExactLocation ?? false}
          onChange={() => setSetting('showExactLocation', !(settingsEdit.showExactLocation ?? false))}
        />
        {profile?.profile_type === 'worker' && (
          <ToggleRow
            label="Worker Listing Visibility"
            sublabel="Appear in the Workers directory for employers to find"
            checked={profile?.is_worker_listed ?? true}
            onChange={() => {/* handled separately via profile update */}}
          />
        )}
        <SaveButton saving={savingSettings} saved={savedSettings} onClick={handleSaveSettings} />
      </Card>
    </div>
  );

  const renderPrivacy = () => (
    <div>
      <SectionHeader icon={Lock} title="Privacy" description="Control how others can interact with you" />
      <Card>
        <SelectRow
          label="Message Permissions"
          sublabel="Who can send you direct messages"
          value={settingsEdit.messagePermissions || 'everyone'}
          onChange={v => setSetting('messagePermissions', v)}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'connections', label: 'Connections only' },
            { value: 'nobody', label: 'Nobody' },
          ]}
        />
        <SelectRow
          label="Hire Request Permissions"
          sublabel="Who can send you hire requests"
          value={settingsEdit.hireRequestPermissions || 'everyone'}
          onChange={v => setSetting('hireRequestPermissions', v)}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'verified', label: 'Verified users only' },
            { value: 'nobody', label: 'Nobody' },
          ]}
        />
        <ToggleRow
          label="Search Engine Indexing"
          sublabel="Allow search engines to index your public profile"
          checked={settingsEdit.searchEngineIndexing ?? true}
          onChange={() => setSetting('searchEngineIndexing', !(settingsEdit.searchEngineIndexing ?? true))}
        />
        <SaveButton saving={savingSettings} saved={savedSettings} onClick={handleSaveSettings} />
      </Card>
    </div>
  );

  const renderAppearance = () => (
    <div>
      <SectionHeader icon={Palette} title="Appearance" description="Personalise how OpenComm looks for you" />
      <Card>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Theme</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'system', label: 'System', icon: Monitor },
            { id: 'light',  label: 'Light',  icon: Sun },
            { id: 'dark',   label: 'Dark',   icon: Moon },
          ].map(({ id, label, icon: Icon }) => {
            const selected = currentTheme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSetting('themePreference', id)}
                className={`flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 transition-all cursor-pointer ${
                  selected
                    ? 'border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB] dark:text-[#60A5FA]'
                    : 'border-slate-200 dark:border-[#273449] text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Theme is saved to your account and applied immediately. Falls back to localStorage when offline.
        </p>
        <SaveButton saving={savingSettings} saved={savedSettings} onClick={handleSaveSettings} label="Apply Theme" />
      </Card>
    </div>
  );

  const renderNotifications = () => {
    const merged = { ...(notifPrefs || {}), ...notifEdit } as NotificationPreferences;
    return (
      <div>
        <SectionHeader icon={Bell} title="Notifications" description="Choose what you want to be notified about" />
        <Card>
          <ToggleRow
            label="In-App Notifications"
            sublabel="Show notification bell and real-time alerts inside the app"
            checked={merged.in_app_enabled ?? true}
            onChange={() => setNotif('in_app_enabled', !(merged.in_app_enabled ?? true))}
          />
          <ToggleRow
            label="Email Notifications"
            sublabel="Preference only — exact delivery depends on your email provider"
            checked={merged.email_enabled ?? true}
            onChange={() => setNotif('email_enabled', !(merged.email_enabled ?? true))}
          />
          <div className="mt-4 mb-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Notification Types</p>
          </div>
          <ToggleRow
            label="Hire Requests"
            sublabel="When someone sends you a hire request"
            checked={merged.hire_notifications ?? true}
            onChange={() => setNotif('hire_notifications', !(merged.hire_notifications ?? true))}
          />
          <ToggleRow
            label="Job Applications"
            sublabel="When someone applies to your job posts"
            checked={merged.application_notifications ?? true}
            onChange={() => setNotif('application_notifications', !(merged.application_notifications ?? true))}
          />
          <ToggleRow
            label="Contracts"
            sublabel="Contract confirmations, completion requests, and cancellations"
            checked={merged.contract_notifications ?? true}
            onChange={() => setNotif('contract_notifications', !(merged.contract_notifications ?? true))}
          />
          <ToggleRow
            label="Messages"
            sublabel="New direct and contract messages"
            checked={merged.message_notifications ?? true}
            onChange={() => setNotif('message_notifications', !(merged.message_notifications ?? true))}
          />
          <ToggleRow
            label="Marketing & Updates"
            sublabel="Product updates, tips, and platform announcements"
            checked={merged.marketing_notifications ?? true}
            onChange={() => setNotif('marketing_notifications', !(merged.marketing_notifications ?? true))}
          />
          <SaveButton saving={savingNotif} saved={savedNotif} onClick={handleSaveNotif} />
        </Card>
      </div>
    );
  };

  const TICKET_CATEGORIES = [
    { value: 'general', label: 'General Enquiry' },
    { value: 'account', label: 'Account Issue' },
    { value: 'billing', label: 'Billing / Payment' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'abuse', label: 'Report Abuse' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'other', label: 'Other' },
  ];

  const STATUS_COLORS: Record<string, string> = {
    open: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
    in_progress: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
    waiting_on_user: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
    resolved: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    closed: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
  };

  const renderSupport = () => (
    <div className="space-y-6">
      <SectionHeader icon={LifeBuoy} title="Support" description="Get help or report an issue" />

      {/* Ticket Form */}
      <Card>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">New Support Ticket</h3>
        <form onSubmit={handleSubmitTicket} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Category</label>
            <select
              value={ticketForm.category}
              onChange={e => setTicketForm(p => ({ ...p, category: e.target.value }))}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-[#273449] bg-slate-50 dark:bg-[#0d1524] text-slate-800 dark:text-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              {TICKET_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Subject</label>
            <input
              type="text"
              value={ticketForm.subject}
              onChange={e => setTicketForm(p => ({ ...p, subject: e.target.value }))}
              placeholder="Brief summary of your issue"
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-[#273449] bg-slate-50 dark:bg-[#0d1524] text-slate-800 dark:text-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB] placeholder:text-slate-400"
              maxLength={120}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Message</label>
            <textarea
              value={ticketForm.description}
              onChange={e => setTicketForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe your issue in detail…"
              rows={4}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-[#273449] bg-slate-50 dark:bg-[#0d1524] text-slate-800 dark:text-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB] placeholder:text-slate-400 resize-y"
            />
          </div>
          {ticketError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {ticketError}
            </div>
          )}
          {ticketSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {ticketSuccess}
            </div>
          )}
          <button
            type="submit"
            disabled={submittingTicket}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white text-sm font-semibold shadow hover:opacity-95 transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {submittingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submittingTicket ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>
      </Card>

      {/* Ticket History */}
      <Card>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Your Tickets</h3>
        {tickets.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">No tickets yet.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map(ticket => (
              <div key={ticket.id} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{ticket.subject}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{ticket.category.replace('_', ' ')}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[ticket.status] || STATUS_COLORS.closed}`}>
                    {ticket.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(ticket.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  const renderSecurity = () => {
    const isEmailProvider = !authMeta?.provider || authMeta.provider === 'email';

    return (
      <div className="space-y-6">
        <SectionHeader icon={ShieldCheck} title="Security" description="Manage your account security and authentication" />
        <Card>
          <div className="space-y-0">
            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Email Address</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{authMeta?.email || profile?.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Auth Provider</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{authMeta?.provider || 'Email / Password'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Change Password</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isEmailProvider ? 'Update your account password' : 'Password change is unavailable for this sign-in method.'}
                </p>
              </div>
              <div>
                {isEmailProvider ? (
                  <button
                    type="button"
                    onClick={() => {
                      setChangePasswordModalOpen(true);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setChangePassError(null);
                      setChangePassSuccess(null);
                    }}
                    className="text-xs font-semibold text-[#2563EB] hover:text-[#1d4ed8] dark:text-[#60A5FA] border border-[#2563EB]/30 dark:border-[#60A5FA]/30 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer hover:bg-[#2563EB]/5"
                  >
                    Change
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    Not Applicable
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Two-Factor Authentication</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Add an extra layer of security</p>
              </div>
              <ComingSoonBadge />
            </div>
          </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </Card>

      {/* LOGIN ACTIVITY */}
      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Login Activity</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Recent successful OpenComm login sessions</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => fetchLogins()}
              disabled={loadingLogins}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh Login Activity"
            >
              <RefreshCw className={`w-4 h-4 ${loadingLogins ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleSignOutOthers}
              disabled={signingOutOthers}
              className="text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] border border-[#2563EB]/30 hover:bg-[#2563EB]/5 px-3.5 py-1.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              {signingOutOthers ? 'Revoking…' : 'Sign out other sessions'}
            </button>
          </div>
        </div>

        {loadingLogins ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
          </div>
        ) : loginActivityError ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{loginActivityError}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchLogins()}
              className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        ) : loginActivities.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500 dark:text-slate-400">
            No login history has been recorded yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {loginActivities.map((act, idx) => {
              const isCurrent = act.is_current_hint === true || (idx === 0 && act.is_current_hint !== false);
              const DeviceIcon = act.device_type === 'Mobile' ? Smartphone : act.device_type === 'Tablet' ? Tablet : Laptop;
              return (
                <div key={act.id || idx} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0d1524]/40">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-9 h-9 rounded-xl bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                      <DeviceIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">{formatDeviceTitle(act)}</span>
                        {isCurrent ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Current
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            Recent
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                        <span>{formatLocation(act)}</span>
                        <span>•</span>
                        <span>{new Date(act.logged_in_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(act.logged_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{maskIpAddress(act.ip_address)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ACCOUNT STATUS & DEACTIVATION */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Account Status</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">
                {profile?.account_status || 'Active'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStartDeactivationFlow}
            disabled={deactivatingAccount}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            Deactivate Account
          </button>
        </div>
      </Card>

      {/* DEACTIVATION MODALS */}
      {deactivationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8">
            {deactivationStep === 'checking' && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563EB] mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Checking account eligibility…</p>
              </div>
            )}

            {deactivationStep === 'blocked' && (
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Account deactivation is currently unavailable
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  You have unfinished work commitments.
                </p>

                <div className="space-y-2 mb-6">
                  {deactivationStatus?.blockers.active_contracts! > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs">
                      <span className="font-semibold text-amber-800 dark:text-amber-300">
                        {deactivationStatus.blockers.active_contracts} Active Contract{deactivationStatus.blockers.active_contracts > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setDeactivationModalOpen(false); navigate('/contracts'); }}
                        className="font-bold text-[#2563EB] dark:text-[#60A5FA] underline flex items-center gap-1 cursor-pointer"
                      >
                        Manage Contract <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {deactivationStatus?.blockers.pending_completion! > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs">
                      <span className="font-semibold text-amber-800 dark:text-amber-300">
                        {deactivationStatus.blockers.pending_completion} Completion Request Pending
                      </span>
                      <button
                        type="button"
                        onClick={() => { setDeactivationModalOpen(false); navigate('/contracts'); }}
                        className="font-bold text-[#2563EB] dark:text-[#60A5FA] underline flex items-center gap-1 cursor-pointer"
                      >
                        View Work <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {deactivationStatus?.blockers.pending_cancellation! > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs">
                      <span className="font-semibold text-amber-800 dark:text-amber-300">
                        {deactivationStatus.blockers.pending_cancellation} Cancellation Request Pending
                      </span>
                      <button
                        type="button"
                        onClick={() => { setDeactivationModalOpen(false); navigate('/contracts'); }}
                        className="font-bold text-[#2563EB] dark:text-[#60A5FA] underline flex items-center gap-1 cursor-pointer"
                      >
                        View Work <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {deactivationStatus?.blockers.disputed_contracts! > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs">
                      <span className="font-semibold text-red-800 dark:text-red-300">
                        {deactivationStatus.blockers.disputed_contracts} Disputed Contract{deactivationStatus.blockers.disputed_contracts > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setDeactivationModalOpen(false); navigate('/contracts'); }}
                        className="font-bold text-[#2563EB] dark:text-[#60A5FA] underline flex items-center gap-1 cursor-pointer"
                      >
                        View Work <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {deactivationStatus?.blockers.active_hire_commitments! > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs">
                      <span className="font-semibold text-amber-800 dark:text-amber-300">
                        {deactivationStatus.blockers.active_hire_commitments} Active Hire Commitment{deactivationStatus.blockers.active_hire_commitments > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setDeactivationModalOpen(false); navigate('/hire-requests'); }}
                        className="font-bold text-[#2563EB] dark:text-[#60A5FA] underline flex items-center gap-1 cursor-pointer"
                      >
                        View Hire Requests <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {deactivationStatus?.blockers.active_application_commitments! > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs">
                      <span className="font-semibold text-amber-800 dark:text-amber-300">
                        {deactivationStatus.blockers.active_application_commitments} Active Application Commitment{deactivationStatus.blockers.active_application_commitments > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setDeactivationModalOpen(false); navigate('/my-applications'); }}
                        className="font-bold text-[#2563EB] dark:text-[#60A5FA] underline flex items-center gap-1 cursor-pointer"
                      >
                        View Applications <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDeactivationModalOpen(false)}
                    className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {deactivationStep === 'confirm' && (
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  Deactivate Your Account?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  Deactivating your account takes your profile offline temporarily. You can reactivate anytime by logging back in.
                </p>

                <div className="p-3.5 mb-5 rounded-2xl bg-slate-50 dark:bg-[#0d1524] border border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <p className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    Profile and worker listing will be hidden from public discovery.
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    Active job posts will be archived.
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    Users will no longer be able to hire, contact, or apply through this account.
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    Historical contracts, conversations, and reviews remain safely stored.
                  </p>
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Type <span className="font-bold text-slate-900 dark:text-white">DEACTIVATE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deactivateConfirmInput}
                    onChange={e => setDeactivateConfirmInput(e.target.value)}
                    placeholder="DEACTIVATE"
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-[#273449] bg-slate-50 dark:bg-[#0d1524] text-slate-800 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                {deactivationError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{deactivationError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeactivationModalOpen(false)}
                    disabled={deactivatingAccount}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeactivation}
                    disabled={deactivateConfirmInput.trim().toUpperCase() !== 'DEACTIVATE' || deactivatingAccount}
                    className="px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold shadow hover:bg-amber-700 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {deactivatingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {deactivatingAccount ? 'Deactivating…' : 'DEACTIVATE'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
    );
  };

  const renderSection = () => {
    switch (active) {
      case 'account':       return renderAccount();
      case 'visibility':    return renderVisibility();
      case 'privacy':       return renderPrivacy();
      case 'appearance':    return renderAppearance();
      case 'notifications': return renderNotifications();
      case 'support':       return renderSupport();
      case 'security':      return renderSecurity();
    }
  };

  // ── Mobile: detail view ───────────────────────────────────────────
  const renderMobileDetail = (section: ActiveSection) => {
    const item = NAV_ITEMS.find(n => n.id === section)!;
    const Icon = item.icon;
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-[#080B18] pb-28">
        {/* Mobile detail header */}
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#080B18]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#273449]/40">
          <div className="h-14 flex items-center gap-3 px-4">
            <button
              type="button"
              onClick={() => setMobileSection(null)}
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              aria-label="Back to settings list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
              <h1 className="text-base font-bold text-slate-900 dark:text-white">{item.label}</h1>
            </div>
          </div>
        </div>
        <div className="px-4 py-5 w-full max-w-full min-w-0">
          {renderSection()}
        </div>
      </div>
    );
  };

  // ── Mobile: list view ─────────────────────────────────────────────
  const renderMobileList = () => (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-[#080B18] pb-28">
      {/* Mobile list header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#080B18]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#273449]/40">
        <div className="h-14 flex items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-white">Settings</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-[#2563EB]" />
        </div>
      ) : (
        <div className="py-3">
          {NAV_ITEMS.map(({ id, label, icon: Icon }, idx) => (
            <button
              key={id}
              type="button"
              onClick={() => { setActive(id); setMobileSection(id); }}
              className={`w-full flex items-center gap-4 px-5 py-4 bg-white dark:bg-[#111827] active:bg-slate-50 dark:active:bg-[#0d1524] transition-colors cursor-pointer text-left
                ${ idx < NAV_ITEMS.length - 1 ? 'border-b border-slate-100 dark:border-[#1e2d45]' : '' }
                ${ idx === 0 ? 'rounded-t-2xl' : '' }
                ${ idx === NAV_ITEMS.length - 1 ? 'rounded-b-2xl' : '' }
              `}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB]/15 to-[#7C3AED]/15 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {NAV_DESCRIPTIONS[id]}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── MOBILE layout (< md) ───────────────────────────────────── */}
      <div className="md:hidden w-full max-w-full min-w-0 overflow-x-hidden">
        {mobileSection === null
          ? renderMobileList()
          : renderMobileDetail(mobileSection)
        }
      </div>

      {/* ── DESKTOP layout (md+) ──────────────────────────────────── */}
      <div className="hidden md:block min-h-screen bg-slate-50 dark:bg-[#080B18] pb-10">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#080B18]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#273449]/40">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Settings</h1>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex gap-6">
            {/* Sidebar nav */}
            <aside className="w-56 shrink-0">
              <nav className="sticky top-24 space-y-0.5">
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActive(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${
                      active === id
                        ? 'bg-gradient-to-r from-[#2563EB]/10 to-[#7C3AED]/10 text-[#2563EB] dark:text-[#60A5FA] font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <main className="flex-1 min-w-0">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-7 h-7 animate-spin text-[#2563EB]" />
                </div>
              ) : renderSection()}
            </main>
          </div>
        </div>
      </div>

      {/* ── CHANGE PASSWORD MODAL ───────────────────────────────────── */}
      {changePasswordModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-password-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs"
          onClick={() => {
            if (!submittingChangePass) {
              setChangePasswordModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-left relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="change-password-title" className="text-base font-bold text-slate-900 dark:text-white">
                    Change Password
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update your OpenComm account password
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submittingChangePass}
                onClick={() => setChangePasswordModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {changePassError && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{changePassError}</span>
              </div>
            )}

            {changePassSuccess && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{changePassSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    disabled={submittingChangePass || Boolean(changePassSuccess)}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    disabled={submittingChangePass || Boolean(changePassSuccess)}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 chars (1 upper, 1 lower, 1 number)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    disabled={submittingChangePass || Boolean(changePassSuccess)}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  disabled={submittingChangePass || Boolean(changePassSuccess)}
                  onClick={() => setChangePasswordModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingChangePass || Boolean(changePassSuccess)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  {submittingChangePass ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating…</span>
                    </>
                  ) : (
                    <span>Change Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
