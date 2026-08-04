import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Eye, Lock, Palette, Bell, LifeBuoy, ShieldCheck,
  ChevronRight, Sun, Moon, Monitor, Save, Loader2, CheckCircle2,
  AlertCircle, LogOut, Clock, Send, ArrowLeft
} from 'lucide-react';
import { supabase, dbService, SupportTicket, LocalProfile } from '../../lib/supabase';
import { notificationService, NotificationPreferences } from '../../lib/notificationService';
import { UserSettings } from '../../types';

/* ------------------------------------------------------------------ */
/* Helpers / sub-components                                             */
/* ------------------------------------------------------------------ */

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
  account:       'Name, username, email, account type',
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

  // ── Fetch all data ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
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

      if (profileData.status === 'fulfilled') setProfile(profileData.value);
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

  const renderAccount = () => (
    <div>
      <SectionHeader icon={User} title="Account" description="Your account details and identity" />
      <Card>
        <div className="space-y-0">
          {[
            { label: 'Full Name', value: profile?.full_name || '—' },
            { label: 'Username', value: profile?.username ? `@${profile.username}` : '—' },
            { label: 'Email', value: profile?.email || authMeta?.email || '—' },
            {
              label: 'Account Type',
              value: profile?.profile_type
                ? profile.profile_type.charAt(0).toUpperCase() + profile.profile_type.slice(1)
                : '—'
            },
            {
              label: 'Member Since',
              value: profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—'
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</span>
            </div>
          ))}
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

  const renderSecurity = () => (
    <div>
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
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Password reset via email link</p>
            </div>
            <div className="flex items-center gap-2">
              <ComingSoonBadge />
              <button
                type="button"
                disabled
                className="text-xs font-semibold text-slate-400 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl cursor-not-allowed opacity-50"
              >
                Change
              </button>
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
    </div>
  );

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
    </>
  );
}
