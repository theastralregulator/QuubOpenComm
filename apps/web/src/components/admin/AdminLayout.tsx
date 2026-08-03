import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, Users, User, Briefcase, Building2, 
  CheckCircle, AlertOctagon, MessageSquare, LifeBuoy, FileText, 
  Megaphone, Settings, ShieldAlert, Activity, Search, Bell, 
  Menu, X, LogOut, ExternalLink, ShieldCheck, Star, ToggleLeft, Radio
} from 'lucide-react';
import { useAdminSession } from '../../hooks/useAdminSession';
import { supabase } from '../../lib/supabase';
import { getInitials, getDisplayEmail, getDisplayName } from '../../lib/admin-utils';

const ADMIN_NAVIGATION = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, exact: true, roles: ['support', 'moderator', 'admin', 'super_admin'] },
  { name: 'Users', path: '/admin/users', icon: Users, roles: ['support', 'admin', 'super_admin'] },
  { name: 'Workers', path: '/admin/workers', icon: User, roles: ['moderator', 'admin', 'super_admin'] },
  { name: 'Jobs', path: '/admin/jobs', icon: Briefcase, roles: ['moderator', 'admin', 'super_admin'] },
  { name: 'Companies', path: '/admin/companies', icon: Building2, roles: ['admin', 'super_admin'] },
  { name: 'Verifications', path: '/admin/verifications', icon: CheckCircle, roles: ['moderator', 'admin', 'super_admin'] },
  { name: 'Reports', path: '/admin/reports', icon: AlertOctagon, roles: ['moderator', 'admin', 'super_admin'] },
  { name: 'Contracts', path: '/admin/contracts', icon: FileText, roles: ['admin', 'super_admin'] },
  { name: 'Reviews', path: '/admin/reviews', icon: Star, roles: ['moderator', 'admin', 'super_admin'] },
  { name: 'Message Moderation', path: '/admin/messages', icon: MessageSquare, roles: ['moderator', 'admin', 'super_admin'] },
  { name: 'Notifications', path: '/admin/notifications', icon: Bell, roles: ['admin', 'super_admin'] },
  { name: 'Support', path: '/admin/support', icon: LifeBuoy, roles: ['support', 'moderator', 'admin', 'super_admin'] },
  { name: 'Content', path: '/admin/content', icon: FileText, roles: ['moderator', 'admin', 'super_admin'] },
  { name: 'Announcements', path: '/admin/announcements', icon: Megaphone, roles: ['admin', 'super_admin'] },
  { name: 'Site Settings', path: '/admin/settings', icon: Settings, roles: ['admin', 'super_admin'] },
  { name: 'Feature Flags', path: '/admin/feature-flags', icon: ToggleLeft, roles: ['super_admin'] },
  { name: 'Admin Management', path: '/admin/admins', icon: ShieldAlert, roles: ['super_admin'] },
  { name: 'Audit Logs', path: '/admin/audit-logs', icon: Activity, roles: ['admin', 'super_admin'] },
  { name: 'Security Logs', path: '/admin/security-logs', icon: ShieldAlert, roles: ['super_admin'] },
  { name: 'System Health', path: '/admin/system-health', icon: Radio, roles: ['admin', 'super_admin'] },
];

export default function AdminLayout() {
  const { adminUser, isAdminLoading } = useAdminSession();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isAdminLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <ShieldCheck className="w-12 h-12 text-indigo-500 animate-pulse mb-4" />
        <h2 className="text-slate-900 dark:text-white font-bold text-lg">Authenticating Admin Session</h2>
        <p className="text-slate-500 text-sm mt-2">Verifying credentials and permissions...</p>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center text-left p-4">
        <AlertOctagon className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-slate-900 dark:text-white font-bold text-lg">Access Denied</h2>
        <p className="text-slate-500 text-sm mt-2">You do not have permission to access the control center.</p>
        <button onClick={() => navigate('/')} className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold cursor-pointer">Return to Home</button>
      </div>
    );
  }

  const role = adminUser.role;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col md:flex-row font-sans">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span className="font-black text-slate-900 dark:text-white">Admin Control</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-500">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* SIDEBAR */}
      <AnimatePresence>
        {(mobileMenuOpen || window.innerWidth >= 768) && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col ${
              mobileMenuOpen ? 'block' : 'hidden md:flex'
            } md:relative`}
          >
            <div className="p-6 hidden md:flex items-center space-x-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-black text-slate-900 dark:text-white text-sm tracking-tight leading-none">OpenComm</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Control Center</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {ADMIN_NAVIGATION.map((item) => {
                if (role !== 'super_admin' && !item.roles.includes(role)) return null;
                
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    end={item.exact}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                        isActive 
                          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' 
                          : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-zinc-800 text-left">
              <div className="mb-3 px-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Logged in as</p>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{getDisplayEmail(adminUser.email)}</p>
                <div className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 mt-1">
                  {role.replace('_', ' ')}
                </div>
              </div>
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors mb-1 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Return to OpenComm</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* TOPBAR */}
        <header className="hidden md:flex h-16 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 items-center justify-between px-8 shrink-0 z-10">
          <div className="flex-1 max-w-xl text-left">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Global admin search (User ID, Email, Username, Report ID...)"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center space-x-6 ml-8">
            <div className="flex items-center space-x-3 pl-6 border-l border-slate-200 dark:border-zinc-800">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{getDisplayName(adminUser)}</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase">{role.replace('_', ' ')}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                {getInitials(null, adminUser.email)}
              </div>
            </div>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

    </div>
  );
}
